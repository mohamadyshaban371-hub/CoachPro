import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, TrendingDown, Minus, Upload, Camera,
  Activity, BarChart3, X, Check, ChevronRight,
} from 'lucide-react';
import { UserProfile, MeasurementHistory } from '../types';
import { compressImage } from '../lib/imageUtils';
import { createTransformationSessionFromMeasurementHistory } from '../lib/transformation';
import { enqueueOfflineAction, saveOfflineSnapshot } from '../lib/offline';
import { sanitizeUserContent } from '../lib/sanitize';

interface Props {
  profile: UserProfile;
  onClose: () => void;
}

export default function ProgressUpdate({ profile, onClose }: Props) {
  const [step, setStep] = useState<'form' | 'compare' | 'done'>('form');
  const [saving, setSaving] = useState(false);

  // Measurements form
  const [measurements, setMeasurements] = useState({
    weight: '',
    fatPercentage: '',
    muscleMass: '',
    waterPercentage: '',
    protein: '',
  });

  // Photos
  const [photos, setPhotos] = useState<{
    front?: string;
    side?: string;
    back?: string;
    inBody?: string;
  }>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<MeasurementHistory | null>(null);

  const last = profile.measurementHistory?.[profile.measurementHistory.length - 1];
  const previous = profile.measurementHistory?.[profile.measurementHistory.length - 2];

  const uploadToStorage = async (base64DataUrl: string, path: string): Promise<string> => {
    const apiBase = (import.meta as any).env?.BASE_URL || '/';
    const res = await fetch(`${apiBase}api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64DataUrl, path, contentType: 'image/jpeg', allowBase64Fallback: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `فشل رفع الصورة (${res.status})`);
    }
    const { url } = await res.json();
    return url as string;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: 'front' | 'side' | 'back' | 'inBody') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(key);
    try {
      const compressed = await compressImage(file, key === 'inBody' ? 1600 : 1100, 0.85);
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(compressed);
      });
      const ts = Date.now();
      const url = await uploadToStorage(dataUrl, `progress/${profile.uid}/${key}_${ts}.jpg`);
      setPhotos(p => ({ ...p, [key]: url }));
    } catch (err: any) {
      alert('خطأ في رفع الصورة: ' + (err.message || String(err)));
    } finally {
      setUploading(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    const w = Number(measurements.weight);
    if (!w || w < 20) { alert('يرجى إدخال الوزن'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const dateStr = now.slice(0, 10);

      const entry: MeasurementHistory = {
        date: dateStr,
        weight: w,
        fatPercentage: Number(measurements.fatPercentage) || 0,
        muscleMass: Number(measurements.muscleMass) || 0,
        waterPercentage: Number(measurements.waterPercentage) || 0,
        protein: Number(measurements.protein) || 0,
        photos: {
          front: photos.front || '',
          side: photos.side || '',
          inBody: photos.inBody || '',
        },
      };

      const safeEntry: MeasurementHistory = {
        ...entry,
        photos: {
          front: photos.front || '',
          side: photos.side || '',
          inBody: photos.inBody || '',
        },
      };
      const safeNotes = sanitizeUserContent('Progress entry captured from the dashboard update flow.');
      const safeTransformation = createTransformationSessionFromMeasurementHistory({
        userId: profile.uid,
        current: safeEntry,
        previous: previous,
        notes: safeNotes,
      });

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveOfflineSnapshot('measurements', safeEntry);
        enqueueOfflineAction({
          id: `${profile.uid}-${Date.now()}`,
          action: 'save-measurement',
          payload: { uid: profile.uid, measurement: safeEntry, timestamp: now },
          createdAt: now,
        });
      } else {
        await updateDoc(doc(db, 'users', profile.uid), {
          measurementHistory: arrayUnion(safeEntry),
          lastMeasurementSubmittedAt: now,
          transformationSessions: arrayUnion(safeTransformation),
        });
      }

      setNewEntry(entry);
      setStep('compare');
    } catch (err: any) {
      alert('خطأ في الحفظ: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const diff = (curr: number, prev: number | undefined) => {
    if (!prev || !curr) return null;
    return curr - prev;
  };

  const DiffBadge = ({ value, invert = false }: { value: number | null; invert?: boolean }) => {
    if (value === null || value === 0) return <span className="text-slate-500 text-sm">—</span>;
    const good = invert ? value < 0 : value > 0;
    return (
      <span className={`flex items-center gap-1 text-sm font-bold ${good ? 'text-green-400' : 'text-red-400'}`}>
        {value > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
    );
  };

  const PhotoUploadBox = ({
    label, field, icon,
  }: {
    label: string;
    field: 'front' | 'side' | 'back' | 'inBody';
    icon: React.ReactNode;
  }) => (
    <div className="relative">
      <input
        id={`photo-${field}`}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handlePhotoUpload(e, field)}
        disabled={!!uploading}
      />
      <label
        htmlFor={`photo-${field}`}
        className="flex flex-col items-center justify-center gap-2 bg-slate-800/60 border border-dashed border-slate-600 rounded-2xl p-4 cursor-pointer hover:border-blue-500 transition-colors text-center min-h-[100px]"
      >
        {photos[field] ? (
          <img src={photos[field]} alt={label} className="w-full h-20 object-cover rounded-xl" />
        ) : uploading === field ? (
          <div className="text-blue-400 text-sm">جاري الرفع...</div>
        ) : (
          <>
            <div className="text-slate-400">{icon}</div>
            <p className="text-slate-400 text-xs">{label}</p>
          </>
        )}
      </label>
    </div>
  );

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-lg max-h-[92vh] overflow-y-auto"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 'form' ? 'تحديث البيانات' : step === 'compare' ? 'نتائج التقدم' : 'تم!'}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {step === 'form' ? 'أدخل قياساتك الجديدة وصورك' : 'مقارنة مع آخر قياس'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              {/* Previous values hint */}
              {last && (
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">آخر قياس ({last.date})</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div>
                      <p className="text-slate-400">الوزن</p>
                      <p className="text-white font-bold">{last.weight} كجم</p>
                    </div>
                    <div>
                      <p className="text-slate-400">الدهون</p>
                      <p className="text-white font-bold">{last.fatPercentage}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400">العضلات</p>
                      <p className="text-white font-bold">{last.muscleMass} كجم</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Measurements */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Activity size={15} className="text-blue-400" />
                  القياسات الجديدة
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'weight', label: 'الوزن (كجم)', placeholder: '0.0' },
                    { key: 'fatPercentage', label: 'الدهون %', placeholder: '0.0' },
                    { key: 'muscleMass', label: 'العضلات (كجم)', placeholder: '0.0' },
                    { key: 'waterPercentage', label: 'الماء %', placeholder: '0.0' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                      <input
                        type="number"
                        value={measurements[f.key as keyof typeof measurements]}
                        onChange={e => setMeasurements(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        step="0.1"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Camera size={15} className="text-purple-400" />
                  الصور (اختياري)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <PhotoUploadBox label="صورة أمامية" field="front" icon={<Camera size={24} />} />
                  <PhotoUploadBox label="صورة جانبية" field="side" icon={<Camera size={24} />} />
                  <PhotoUploadBox label="صورة خلفية" field="back" icon={<Camera size={24} />} />
                  <PhotoUploadBox label="تقرير InBody" field="inBody" icon={<Activity size={24} />} />
                </div>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !!uploading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {saving ? 'جاري الحفظ...' : (
                  <>
                    <BarChart3 size={18} />
                    حفظ وعرض التقدم
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 'compare' && newEntry && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              {/* Success Banner */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={32} className="text-green-400" />
                </div>
                <p className="text-white font-bold text-lg">تم حفظ قياساتك!</p>
                <p className="text-slate-400 text-sm">تاريخ التحديث: {newEntry.date}</p>
              </div>

              {/* Comparison Table */}
              {last && (
                <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-4 bg-slate-700/50 p-3 text-xs font-bold text-slate-300 text-center">
                    <span className="text-right">القياس</span>
                    <span>السابق</span>
                    <span>الجديد</span>
                    <span>التغيير</span>
                  </div>
                  {[
                    { label: 'الوزن', prev: last.weight, curr: newEntry.weight, unit: 'كجم', invert: true },
                    { label: 'الدهون', prev: last.fatPercentage, curr: newEntry.fatPercentage, unit: '%', invert: true },
                    { label: 'العضلات', prev: last.muscleMass, curr: newEntry.muscleMass, unit: 'كجم', invert: false },
                    { label: 'الماء', prev: last.waterPercentage, curr: newEntry.waterPercentage, unit: '%', invert: false },
                  ].map((row, i) => {
                    const d = diff(row.curr, row.prev);
                    return (
                      <div key={i} className={`grid grid-cols-4 p-3 text-sm text-center ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                        <span className="text-slate-300 text-right text-xs">{row.label}</span>
                        <span className="text-slate-400">{row.prev}{row.unit}</span>
                        <span className="text-white font-semibold">{row.curr}{row.unit}</span>
                        <span className="flex justify-center">
                          <DiffBadge value={d} invert={row.invert} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Before/After Photos */}
              {(last?.photos?.front || newEntry.photos?.front) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">مقارنة الصور (قبل / بعد)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-2 text-center">قبل ({last?.date})</p>
                      {last?.photos?.front ? (
                        <img src={last.photos.front} alt="قبل" className="w-full h-48 object-cover rounded-2xl" />
                      ) : (
                        <div className="w-full h-48 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 text-xs">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2 text-center">بعد ({newEntry.date})</p>
                      {newEntry.photos?.front ? (
                        <img src={newEntry.photos.front} alt="بعد" className="w-full h-48 object-cover rounded-2xl" />
                      ) : (
                        <div className="w-full h-48 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 text-xs">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-bold transition-colors"
              >
                إغلاق
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
