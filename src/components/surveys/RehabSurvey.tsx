import React, { useState, useEffect } from 'react';
import { Activity, FileText, Upload, Plus, Trash2, Image as ImageIcon, Check, CircleAlert } from 'lucide-react';
import { RehabSurveyData, RehabInjury } from '../../types';
import { compressImage } from '../../lib/imageUtils';
import { BodyMap } from '../BodyMap';
import { motion, AnimatePresence } from 'motion/react';

interface RehabSurveyProps {
  userId: string;
  painPoints?: string[];
  initialData?: RehabSurveyData;
  onComplete: (data: RehabSurveyData) => void;
  isLoading?: boolean;
}

export default function RehabSurvey({ userId, painPoints: onboardingPainPoints, initialData, onComplete, isLoading }: RehabSurveyProps) {
  const [hasInjuries, setHasInjuries] = useState<boolean>(initialData?.hasInjuries ?? (onboardingPainPoints && onboardingPainPoints.length > 0 ? true : false));
  const [selectedPainPoints, setSelectedPainPoints] = useState<string[]>(initialData?.painPoints || onboardingPainPoints || []);
  // Start at 0 — user must move the slider to register actual pain.
  const [painIntensity, setPainIntensity] = useState<number>(initialData?.painIntensity ?? 0);
  const [injuryDescription, setInjuryDescription] = useState<string>(initialData?.injuryDescription || '');

  // Empty injury skeleton — no pre-selected `intervention` or
  // `painDescription` so the coach sees only what the client typed.
  const [injuries, setInjuries] = useState<RehabInjury[]>(initialData?.injuries || [
    { id: '1', date: '', intervention: '' as any, painDescription: '' as any, previousSteps: '', media: {} }
  ]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});

  const togglePainPoint = (part: string) => {
    setSelectedPainPoints(prev => 
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  };

  const addInjury = () => {
    setInjuries([...injuries, { 
      id: Math.random().toString(36).substr(2, 9), 
      date: '', 
      intervention: 'none', 
      painDescription: 'sharp', 
      previousSteps: '', 
      media: {} 
    }]);
  };

  const removeInjury = (id: string) => {
    if (injuries.length > 1) {
      setInjuries(injuries.filter(i => i.id !== id));
    }
  };

  const updateInjury = (id: string, field: keyof RehabInjury, value: any) => {
    setInjuries(injuries.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleFileUpload = async (injuryId: string, type: 'mri' | 'xray' | 'pdf' | 'recentPhoto', file: File) => {
    const key = `${injuryId}-${type}`;
    setUploading(key);
    
    // 1. Create immediate local preview
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [key]: previewUrl }));

    try {
      // 2. Process file
      let resultData: string;
      
      if (type === 'pdf') {
        // Raw Base64 for PDFs
        const reader = new FileReader();
        resultData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        // Compress and Base64 for images (Max 600px for legibility vs size)
        const compressed = await compressImage(file, 600, 0.5);
        const reader = new FileReader();
        resultData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });
      }
      
      // 3. Update injury state with Base64
      setInjuries(prev => prev.map(i => {
        if (i.id === injuryId) {
          const media = { ...i.media };
          if (type === 'recentPhoto') {
            media.recentPhoto = resultData;
          } else {
            // Check if resultData is already in the array to avoid duplicates
            const currentArr = media[type] || [];
            if (!currentArr.includes(resultData)) {
              media[type] = [...currentArr, resultData];
            }
          }
          return { ...i, media };
        }
        return i;
      }));

    } catch (error) {
      console.error("Upload/Processing error:", error);
      alert("حدث خطأ أثناء معالجة الملف. يرجى المحاولة مرة أخرى.");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({ 
      hasInjuries,
      painPoints: selectedPainPoints,
      painIntensity,
      injuryDescription,
      injuries 
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
          <Activity size={24} /> الإصابات والآلام العضلية
        </h3>
        
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-300">هل تعاني من أي إصابات أو آلام عضلية حالياً؟</p>
          <div className="flex gap-3">
            <button
              onClick={() => setHasInjuries(true)}
              className={`flex-1 py-4 rounded-2xl font-bold border transition-all ${hasInjuries ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              نعم
            </button>
            <button
              onClick={() => {
                setHasInjuries(false);
                setSelectedPainPoints([]);
                setInjuryDescription('');
              }}
              className={`flex-1 py-4 rounded-2xl font-bold border transition-all ${!hasInjuries ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/20' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              لا
            </button>
          </div>
        </div>

        <AnimatePresence>
          {hasInjuries && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="space-y-8 overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold text-red-400">حدد أماكن الألم بدقة</h4>
                   <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{selectedPainPoints.length} مناطق محددة</span>
                </div>
                <BodyMap 
                  selectedParts={selectedPainPoints} 
                  onTogglePart={togglePainPoint} 
                />
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-bold text-slate-400">مستوى شدة الألم</span>
                      <span className={`text-2xl font-black ${painIntensity > 7 ? 'text-red-500' : painIntensity > 4 ? 'text-orange-500' : 'text-green-500'}`}>{painIntensity}</span>
                   </div>
                   <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="1"
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                      style={{ accentColor: '#ef4444' }}
                      value={painIntensity}
                      onChange={(e) => setPainIntensity(parseInt(e.target.value))}
                   />
                   <div className="flex justify-between px-1">
                      {[1,2,3,4,5,6,7,8,9,10].map(v => (
                        <div key={v} className="flex flex-col items-center gap-1">
                           <div className={`w-1 h-1 rounded-full ${painIntensity === v ? 'bg-red-500' : 'bg-slate-700'}`} />
                           <span className={`text-[10px] ${painIntensity === v ? 'text-red-500 font-bold' : 'text-slate-600'}`}>{v}</span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-xs text-slate-500 font-bold pr-1 block">اشرح لنا بالتفصيل طبيعة الإصابة أو أي معلومات إضافية تود ذكرها كابتن</label>
                   <textarea 
                      placeholder="مثلاً: نوع الإصابة، تاريخها، هل أجريت أي عمليات جراحية؟" 
                      className="w-full bg-slate-800 border border-white/10 rounded-[2rem] p-6 h-40 outline-none focus:border-red-500 transition-all resize-none text-white leading-relaxed text-sm"
                      value={injuryDescription}
                      onChange={e => setInjuryDescription(e.target.value)}
                   />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileText size={24} className="text-blue-500" /> التقارير الطبية السابقة
          </h3>
          <button
            type="button"
            onClick={addInjury}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all"
          >
            <Plus size={16} /> إضافة سجل جديد
          </button>
        </div>

        {injuries.map((injury, idx) => (
          <div key={injury.id} className="bg-slate-900/50 border border-white/10 p-8 rounded-[2.5rem] space-y-8 relative group">
            <div className="absolute top-6 left-6 text-slate-800 font-black text-4xl opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity">0{idx + 1}</div>
            
            {injuries.length > 1 && (
              <button
                type="button"
                onClick={() => removeInjury(injury.id)}
                className="absolute top-6 left-6 p-2 text-slate-500 hover:text-red-500 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-400 block px-1">تاريخ الإصابة التقديري</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border-none rounded-2xl p-4 outline-none focus:border-blue-500 transition-all text-white"
                  value={injury.date}
                  onChange={(e) => updateInjury(injury.id, 'date', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-400 block px-1">التدخل المسبق</label>
                <div className="flex gap-2">
                  {[
                    { id: 'surgery', label: 'جراحة' },
                    { id: 'physio', label: 'علاج طبيعي' },
                    { id: 'none', label: 'لا شيء' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateInjury(injury.id, 'intervention', opt.id)}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${injury.intervention === opt.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 block px-1">طبيعة الألم</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'sharp', label: 'حاد / طعنات' },
                  { id: 'heavy', label: 'ثقل' },
                  { id: 'throbbing', label: 'نبض' },
                  { id: 'other', label: 'غير ذلك' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateInjury(injury.id, 'painDescription', opt.id)}
                    className={`px-6 py-3 rounded-xl text-xs font-bold transition-all border ${injury.painDescription === opt.id ? 'bg-slate-800 border-blue-500 text-blue-400' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 block px-1">ما الذي تم فعله مسبقاً؟ (اختياري)</label>
              <textarea
                placeholder="أدوية، راحة، تمارين معينة..."
                className="w-full bg-slate-800 border-none rounded-3xl p-4 h-24 outline-none focus:border-blue-500 transition-all resize-none text-white text-sm"
                value={injury.previousSteps}
                onChange={(e) => updateInjury(injury.id, 'previousSteps', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { type: 'recentPhoto', label: 'صورة حديثة', icon: <ImageIcon size={20} /> },
                { type: 'mri', label: 'رنين مغناطيسي', icon: <Activity size={20} /> },
                { type: 'xray', label: 'أشعة X', icon: <FileText size={20} /> },
                { type: 'pdf', label: 'تقرير طبي PDF', icon: <FileText size={20} /> }
              ].map((upload) => (
                <div key={upload.type} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = upload.type === 'pdf' ? '.pdf' : 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileUpload(injury.id, upload.type as any, file);
                      };
                      input.click();
                    }}
                    disabled={uploading === `${injury.id}-${upload.type}`}
                    className={`w-full aspect-square flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed transition-all relative overflow-hidden ${localPreviews[`${injury.id}-${upload.type}`] ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}
                  >
                    {uploading === `${injury.id}-${upload.type}` ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <div className={`${localPreviews[`${injury.id}-${upload.type}`] ? 'text-blue-500' : 'text-slate-600'}`}>
                          {upload.icon}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{upload.label}</span>
                      </>
                    )}
                    {localPreviews[`${injury.id}-${upload.type}`] && (
                      <div className="absolute inset-0">
                        <img 
                          src={localPreviews[`${injury.id}-${upload.type}`]} 
                          className="w-full h-full object-cover opacity-30" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                           <Check className="text-blue-500" size={24} />
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isLoading}
        onClick={() => {
          onComplete({ 
            hasInjuries,
            painPoints: selectedPainPoints,
            painIntensity,
            injuryDescription,
            injuries 
          });
        }}
        className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-[2rem] text-xl font-black text-white shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-4 group mt-12 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span>جاري الحفظ...</span>
          </>
        ) : (
          <>
            <span>حفظ ومتابعة</span>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:px-4 transition-all">
              <Check size={24} />
            </div>
          </>
        )}
      </button>
    </div>
  );
}
