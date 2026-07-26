import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, Camera, Sparkles, TrendingDown, TrendingUp, Weight, Droplets, Flame, HeartPulse } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useProgress } from '../hooks/useProgress';
import { MeasurementHistory, UserProfile } from '../types';
import { calculateBodyMetrics } from '../lib/progress';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

interface ProgressTabProps {
  profile: UserProfile;
}

export default function ProgressTab({ profile }: ProgressTabProps) {
  const { history, latestEntry, previousEntry, latestMetrics, comparison, saveEntry, isSaving, error } = useProgress(profile);
  const [form, setForm] = useState({
    weight: '',
    fatPercentage: '',
    muscleMass: '',
    waterPercentage: '',
    protein: '',
  });
  const [photos, setPhotos] = useState({ front: '', side: '', inBody: '' });
  const [saving, setSaving] = useState(false);

  const chartData = useMemo(() => {
    return (history || []).map((entry) => ({
      date: entry.date.slice(5),
      weight: entry.weight,
      fatPercentage: entry.fatPercentage,
      muscleMass: entry.muscleMass,
      waterPercentage: entry.waterPercentage,
    }));
  }, [history]);

  const handleSave = async () => {
    const entry: MeasurementHistory = {
      date: new Date().toISOString(),
      weight: Number(form.weight) || 0,
      fatPercentage: Number(form.fatPercentage) || 0,
      muscleMass: Number(form.muscleMass) || 0,
      waterPercentage: Number(form.waterPercentage) || 0,
      protein: Number(form.protein) || 0,
      photos: {
        front: photos.front || '',
        side: photos.side || '',
        inBody: photos.inBody || '',
      },
    };

    setSaving(true);
    try {
      await saveEntry(entry);
      setForm({ weight: '', fatPercentage: '', muscleMass: '', waterPercentage: '', protein: '' });
      setPhotos({ front: '', side: '', inBody: '' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: 'front' | 'side' | 'inBody') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => ({ ...prev, [key]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-slate-900/60 border border-white/5 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-white">تتبع التقدم</h3>
            <p className="text-sm text-slate-400">أحدث قياسات الجسم + مؤشرات سريعة</p>
          </div>
          <div className="rounded-2xl bg-blue-500/10 border border-blue-400/20 px-3 py-2 text-blue-300 text-sm font-semibold">
            <Sparkles size={14} className="inline mr-1" /> تحديثات دورية
          </div>
        </div>

        {latestMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="BMI" value={`${latestMetrics.bmi}`} icon={<Weight size={15} />} />
            <MetricCard label="BMR" value={`${latestMetrics.bmr}`} icon={<Flame size={15} />} />
            <MetricCard label="TDEE" value={`${latestMetrics.tdee}`} icon={<HeartPulse size={15} />} />
            <MetricCard label="العضلات الخالية" value={`${latestMetrics.leanMass} كجم`} icon={<Activity size={15} />} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <BarChart3 size={16} className="text-blue-400" /> إدخال قياس جديد
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['weight', 'الوزن (كجم)'],
                ['fatPercentage', 'الدهون %'],
                ['muscleMass', 'العضلات (كجم)'],
                ['waterPercentage', 'الماء %'],
                ['protein', 'البروتين (جم)'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</label>
                  <input
                    type="number"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full mt-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['front', 'side', 'inBody'] as const).map((key) => (
                <label key={key} className="cursor-pointer rounded-xl border border-white/10 bg-slate-900/70 p-2 text-center text-[11px] text-slate-400">
                  <Camera size={14} className="mx-auto mb-1" />
                  {key === 'front' ? 'أمامي' : key === 'side' ? 'جانبي' : 'InBody'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, key)} />
                </label>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving || isSaving} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 font-bold text-sm transition">
              {saving || isSaving ? 'جاري الحفظ...' : 'حفظ التقدم'}
            </button>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <TrendingUp size={16} className="text-emerald-400" /> المقارنة السريعة
            </div>
            {comparison && latestEntry && previousEntry ? (
              <div className="space-y-2 text-sm">
                <Row label="الوزن" value={comparison.weight} unit="كجم" positive={comparison.weight < 0} />
                <Row label="الدهون" value={comparison.fatPercentage} unit="%" positive={comparison.fatPercentage < 0} />
                <Row label="العضلات" value={comparison.muscleMass} unit="كجم" positive={comparison.muscleMass > 0} />
                <Row label="الماء" value={comparison.waterPercentage} unit="%" positive={comparison.waterPercentage > 0} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">سجل قياس سابق واحد على الأقل لعرض التقدم.</p>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-3xl bg-slate-900/60 border border-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-black text-white">المنحنى الأسبوعي</h3>
            <p className="text-sm text-slate-400">تتبع الوزن والدهون بمرور الوقت</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fatPercentage" stroke="#fb923c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-widest">{icon}{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function Row({ label, value, unit, positive }: { label: string; value: number; unit: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className={`font-bold flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {value > 0 ? <TrendingUp size={14} /> : value < 0 ? <TrendingDown size={14} /> : null}
        {value > 0 ? '+' : ''}{value}{unit}
      </span>
    </div>
  );
}
