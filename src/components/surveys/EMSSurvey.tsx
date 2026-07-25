import React, { useState } from 'react';
import { Zap, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { EMSSurveyData } from '../../types';
import GeneralMedicalForm from './GeneralMedicalForm';
import { EMS_MAX_RPE } from '../../lib/emsProtocol';

interface EMSSurveyProps {
  gender: 'male' | 'female';
  initialData?: EMSSurveyData;
  onComplete: (data: EMSSurveyData) => void;
  isLoading?: boolean;
}

export default function EMSSurvey({ gender, initialData, onComplete, isLoading }: EMSSurveyProps) {
  const [data, setData] = useState<EMSSurveyData>(initialData || {
    safety: { pacemaker: false, epilepsy: false, pregnancy: false, metalImplants: false },
    medical: { bloodPressure: false, diabetes: false, surgeries: false, surgeryDetails: '' },
    // Empty pain row — no pre-filled intensity of 5 (looked like the
    // client had already reported pain when they hadn't).
    painPoints: [{ location: '', intensity: 0 }]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(data);
  };

  const addPainPoint = () => {
    setData({ ...data, painPoints: [...data.painPoints, { location: '', intensity: 0 }] });
  };

  const removePainPoint = (index: number) => {
    if (data.painPoints.length > 1) {
      setData({ ...data, painPoints: data.painPoints.filter((_, i) => i !== index) });
    }
  };

  const updatePainPoint = (index: number, field: string, value: any) => {
    const next = [...data.painPoints];
    next[index] = { ...next[index], [field]: value };
    setData({ ...data, painPoints: next });
  };

  // Detect any pain point at the danger threshold (RPE 10) — EMS protocol
  // bans 10/10 effort, so we surface a hard warning before submission.
  const hasDangerRPE = data.painPoints.some(p => p.intensity >= EMS_MAX_RPE + 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <GeneralMedicalForm 
        medicalData={data.medical || { bloodPressure: false, diabetes: false, surgeries: false }}
        gender={gender}
        onChange={(med) => setData({...data, medical: med})}
      />

      {/* Simple client-facing safety note — technical protocol details are coach-only */}
      <div className="bg-purple-600/5 border border-purple-500/20 p-5 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-purple-600/20 rounded-2xl shrink-0 mt-0.5">
          <Zap size={20} className="text-purple-400" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-purple-300">ملاحظة سلامة</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            جهاز EMS يستخدم نبضات كهربائية آمنة لتحفيز العضلات. الكوتش هو من سيحدد الإعدادات المناسبة لك بناءً على إجاباتك أدناه. لا حاجة لخبرة سابقة.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400">
          <ShieldAlert size={24} /> موانع الاستخدام (إقرار طبي)
        </h3>
        <p className="text-xs text-slate-500">يرجى تحديد أي من الحالات التالية إذا كانت تنطبق عليك (إلزامي):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: 'pacemaker', label: 'جهاز تنظيم ضربات قلب' },
            { id: 'epilepsy', label: 'صرع' },
            { id: 'pregnancy', label: 'حمل' },
            { id: 'metalImplants', label: 'وجود معادن/شرائح في الجسم' }
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-colors group">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg bg-slate-700 border-none text-purple-500 focus:ring-0"
                checked={data.safety[item.id as keyof typeof data.safety]}
                onChange={e => setData({...data, safety: {...data.safety, [item.id]: e.target.checked}})}
              />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400">
          <Zap size={24} /> تحديد الألم (لضبط كثافة النبضات)
        </h3>
        <div className="space-y-4">
          {data.painPoints.map((point, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-4 items-end bg-slate-800/30 p-4 rounded-2xl relative">
              <div className="flex-1 w-full">
                <label className="block text-[10px] text-slate-500 mb-2 uppercase">مكان الألم</label>
                <input 
                  type="text" 
                  placeholder="مثلاً: أسفل الظهر"
                  className="w-full bg-slate-800 border-none rounded-xl p-3 text-white"
                  value={point.location}
                  onChange={e => updatePainPoint(index, 'location', e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-[10px] text-slate-500 mb-2 uppercase">شدة الألم (1-10)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="10"
                    className="flex-1 accent-purple-500"
                    value={point.intensity}
                    onChange={e => updatePainPoint(index, 'intensity', parseInt(e.target.value))}
                  />
                  <span className="text-xl font-black text-purple-400 w-8">{point.intensity}</span>
                </div>
              </div>
              {data.painPoints.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => removePainPoint(index)}
                  className="p-3 text-slate-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addPainPoint}
            className="w-full py-3 border border-dashed border-white/10 hover:border-purple-500/50 text-slate-500 hover:text-purple-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={16} /> إضافة منطقة ألم أخرى
          </button>
        </div>
      </div>

      {hasDangerRPE && (
        <div className="bg-red-600/10 border border-red-500/40 p-4 rounded-2xl text-sm text-red-300 flex items-start gap-3">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1">RPE 10 ممنوع للـ EMS</strong>
            هذه الشدة خطرة على الأنسجة العضلية. الحد الأقصى المسموح به هو {EMS_MAX_RPE}/10. خفّف الشدة قبل الحفظ.
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || hasDangerRPE}
        className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>جاري الحفظ...</span>
          </>
        ) : (
          "حفظ استبيان EMS وإكمال الملف"
        )}
      </button>
    </form>
  );
}
