import React, { useState } from 'react';
import { Dumbbell, Activity, MapPin, Target, CircleAlert, HeartPulse, Moon, Brain, Home, Building2 } from 'lucide-react';
import { WorkoutSurveyData, UserProfile } from '../../types';
import GeneralMedicalForm from './GeneralMedicalForm';
import { playClick, playSuccess } from '../../lib/sounds';

interface WorkoutSurveyProps {
  profile: UserProfile;
  initialData?: WorkoutSurveyData;
  onComplete: (data: WorkoutSurveyData) => void;
  isLoading?: boolean;
}

export default function WorkoutSurvey({ profile, initialData, onComplete, isLoading }: WorkoutSurveyProps) {
  const [data, setData] = useState<WorkoutSurveyData>(initialData || {
    health: { bloodPressure: false, diabetes: false },
    medical: { bloodPressure: false, diabetes: false, surgeries: false, surgeryDetails: '' },
    level: '' as any,
    injuryUpdate: { additionalPain: '' },
    environment: { location: '' as any, homeEquipment: '', gymDays: [], homeDays: [], availableDays: [], preferredTime: '' },
    goals: [],
  });

  const getBodyPartName = (id: string) => {
    const parts: Record<string, string> = {
      head: 'الرأس', neck: 'الرقبة', chest: 'الصدر', 
      l_shoulder: 'الكتف الأيسر', r_shoulder: 'الكتف الأيمن',
      l_arm: 'الذراع الأيسر', r_arm: 'الذراع الأيمن',
      abs: 'البطن', l_thigh: 'الفخذ الأيسر', r_thigh: 'الفخذ الأيمن',
      l_knee: 'الركبة اليسرى', r_knee: 'الركبة اليمنى',
      l_leg: 'الساق اليسرى', r_leg: 'الساق اليمنى'
    };
    return parts[id] || id;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playSuccess();
    onComplete(data);
  };

  const toggleGoal = (goal: string) => {
    playClick();
    const next = data.goals.includes(goal)
      ? data.goals.filter(g => g !== goal)
      : [...data.goals, goal];
    setData({...data, goals: next});
  };

  const toggleDay = (day: string) => {
    playClick();
    const next = data.environment.availableDays.includes(day)
      ? data.environment.availableDays.filter(d => d !== day)
      : [...data.environment.availableDays, day];
    setData({...data, environment: {...data.environment, availableDays: next}});
  };

  const toggleGymDay = (day: string) => {
    playClick();
    const curr = data.environment.gymDays || [];
    const next = curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day];
    setData({...data, environment: {...data.environment, gymDays: next, availableDays: [...new Set([...next, ...(data.environment.homeDays || [])])]}});
  };

  const toggleHomeDay = (day: string) => {
    playClick();
    const curr = data.environment.homeDays || [];
    const next = curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day];
    setData({...data, environment: {...data.environment, homeDays: next, availableDays: [...new Set([...(data.environment.gymDays || []), ...next])]}});
  };

  const toggleLocation = (loc: 'gym' | 'home') => {
    playClick();
    const cur = data.environment.location;
    let next: 'gym' | 'home' | 'both';
    if (cur === loc) {
      next = '' as any;
    } else if (cur === 'both') {
      next = loc === 'gym' ? 'home' : 'gym';
    } else if ((cur as string) === '' || cur === undefined) {
      next = loc;
    } else if ((cur === 'gym' && loc === 'home') || (cur === 'home' && loc === 'gym')) {
      next = 'both';
    } else {
      next = loc;
    }
    setData({...data, environment: {...data.environment, location: next}});
  };

  const hasGym = data.environment.location === 'gym' || data.environment.location === 'both';
  const hasHome = data.environment.location === 'home' || data.environment.location === 'both';

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <GeneralMedicalForm 
        medicalData={data.medical || { bloodPressure: false, diabetes: false, surgeries: false }}
        gender={profile.gender}
        onChange={(med) => setData({...data, medical: med})}
      />

      {/* ─── STEP 0 — Scientific Engine Readiness Inputs ──────────── */}
      <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-400/20 p-6 rounded-3xl space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
            <HeartPulse size={20} className="text-emerald-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-emerald-300">جاهزيتك اليوم (Readiness Check)</h3>
            <p className="text-xs text-slate-400 mt-1">
              المحرك العلمي بيستخدم الأرقام دي عشان يحدد شدة التمرين تلقائياً.
              لو الضغط أعلى من 8 أو النوم أقل من 5 ساعات أو الألم أعلى من 6 — هيتم تخفيض الشدة 30%.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Stress — start blank (no pre-selected midpoint) so we don't
              tell the engine the user reported "5/10 stress" when they
              never touched the slider. Same applies to sleep + pain. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <Brain size={16} className="text-amber-300" /> مستوى الضغط النفسي
              </label>
              <span className="text-lg font-black text-amber-300 tabular-nums">
                {data.readiness?.stress != null
                  ? <>{data.readiness.stress}<span className="text-xs text-slate-500">/10</span></>
                  : <span className="text-slate-600">—</span>}
              </span>
            </div>
            <input
              type="range" min={1} max={10} step={1}
              value={data.readiness?.stress ?? 5}
              onChange={(e) => setData({
                ...data,
                readiness: { ...(data.readiness || {}), stress: Number(e.target.value) },
              })}
              className={`w-full accent-amber-400 ${data.readiness?.stress == null ? 'opacity-60' : ''}`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>هادي</span><span>متوسط</span><span>عالي جداً</span>
            </div>
          </div>

          {/* Sleep */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <Moon size={16} className="text-blue-300" /> ساعات النوم الليلة الماضية
              </label>
              <span className="text-lg font-black text-blue-300 tabular-nums">
                {data.readiness?.sleepHours != null
                  ? <>{data.readiness.sleepHours}<span className="text-xs text-slate-500">س</span></>
                  : <span className="text-slate-600">—</span>}
              </span>
            </div>
            <input
              type="range" min={0} max={12} step={0.5}
              value={data.readiness?.sleepHours ?? 7}
              onChange={(e) => setData({
                ...data,
                readiness: { ...(data.readiness || {}), sleepHours: Number(e.target.value) },
              })}
              className={`w-full accent-blue-400 ${data.readiness?.sleepHours == null ? 'opacity-60' : ''}`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0س</span><span>6س</span><span>12س</span>
            </div>
          </div>

          {/* Pain */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <CircleAlert size={16} className="text-red-300" /> مستوى الألم الحالي
              </label>
              <span className="text-lg font-black text-red-300 tabular-nums">
                {data.readiness?.pain != null
                  ? <>{data.readiness.pain}<span className="text-xs text-slate-500">/10</span></>
                  : <span className="text-slate-600">—</span>}
              </span>
            </div>
            <input
              type="range" min={0} max={10} step={1}
              value={data.readiness?.pain ?? 0}
              onChange={(e) => setData({
                ...data,
                readiness: { ...(data.readiness || {}), pain: Number(e.target.value) },
              })}
              className={`w-full accent-red-400 ${data.readiness?.pain == null ? 'opacity-60' : ''}`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>لا يوجد</span><span>متوسط</span><span>شديد</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
          <Activity size={24} /> المستوى الرياضي الحالي
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-slate-500 mb-3">مستواك الرياضي الحالي</label>
            <div className="flex flex-col gap-2">
              {[
                { id: 'beginner', label: 'مبتدئ (0-6 أشهر)' },
                { id: 'intermediate', label: 'متوسط (6-18 شهر)' },
                { id: 'advanced', label: 'متقدم (أكثر من سنتين)' }
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setData({...data, level: lvl.id as any})}
                  className={`p-3 rounded-xl text-right text-sm font-bold border transition-all ${
                    data.level === lvl.id 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                      : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
          <CircleAlert size={24} /> تحديث الإصابات
        </h3>
        {profile.onboardingData?.hasInjury ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <p className="text-sm text-red-400 mb-2 font-bold">لقد حددت مسبقاً آلاماً في المناطق التالية:</p>
              <div className="flex flex-wrap gap-2">
                {profile.onboardingData.painPoints?.map(p => (
                  <span key={p} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold">
                    {getBodyPartName(p)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400 italic">وصفك السابق: {profile.onboardingData.injuryDescription}</p>
            </div>
            <textarea 
              placeholder="هل توجد تفاصيل إضافية أو إصابات أخرى تريد إضافتها؟"
              className="w-full bg-slate-800 border-none rounded-xl p-3 text-white h-24"
              value={data.injuryUpdate.additionalPain}
              onChange={e => setData({...data, injuryUpdate: {...data.injuryUpdate, additionalPain: e.target.value}})}
            />
          </div>
        ) : (
          <p className="text-slate-500 italic text-sm">لم تسجل أي إصابات في مرحلة التسجيل.</p>
        )}
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
          <MapPin size={24} /> البيئة التدريبية
        </h3>
        <p className="text-xs text-slate-500">يمكنك اختيار الجيم والبيت معاً — سيتم عمل برنامج لكل بيئة بشكل منفصل</p>
        
        {/* Location checkboxes — support gym + home simultaneously */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'gym', label: 'الجيم (Gym)', icon: <Building2 size={20} />, color: 'blue' },
            { id: 'home', label: 'البيت (Home)', icon: <Home size={20} />, color: 'emerald' },
          ].map(loc => {
            const isSelected = loc.id === 'gym' ? hasGym : hasHome;
            const colorClass = isSelected
              ? loc.color === 'blue'
                ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                : 'bg-emerald-600/10 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700';
            const iconClass = isSelected
              ? (loc.color === 'blue' ? 'text-blue-400' : 'text-emerald-400')
              : 'text-slate-500';
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleLocation(loc.id as 'gym' | 'home')}
                className={`py-5 rounded-2xl font-bold transition-all border-2 flex flex-col items-center gap-2 ${colorClass}`}
              >
                <span className={iconClass}>{loc.icon}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? (loc.color === 'blue' ? 'bg-blue-500 border-blue-500' : 'bg-emerald-500 border-emerald-500') : 'border-slate-500'}`}>
                    {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                  </div>
                  <span className="text-sm">{loc.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Home equipment — shown when home is selected */}
        {hasHome && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
            <label className="block text-xs font-bold text-emerald-400 flex items-center gap-2">
              <Home size={14} /> الأدوات المتاحة في البيت
            </label>
            <textarea 
              placeholder="اكتب الأدوات اللي عندك فعلاً (مثلاً: دامبلز 5 و10 كجم، حبال مقاومة، عقلة، بنش...)"
              className="w-full bg-slate-800/80 border border-emerald-500/20 rounded-xl p-3 text-white h-20 text-sm outline-none focus:border-emerald-500 transition-all resize-none"
              value={data.environment.homeEquipment}
              onChange={e => setData({...data, environment: {...data.environment, homeEquipment: e.target.value}})}
            />
          </div>
        )}

        {/* Separate day pickers per environment */}
        <div className="space-y-5">
          {hasGym && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Building2 size={14} /> أيام الجيم
              </label>
              <div className="flex flex-wrap gap-2">
                {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleGymDay(day)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      (data.environment.gymDays || []).includes(day)
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasHome && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Home size={14} /> أيام البيت
              </label>
              <div className="flex flex-wrap gap-2">
                {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleHomeDay(day)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      (data.environment.homeDays || []).includes(day)
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasGym && !hasHome && (
            <div className="text-center py-6 text-slate-500 text-sm">
              اختر بيئة تدريبية من الأعلى
            </div>
          )}
        </div>

        <input 
          type="text" 
          placeholder="الوقت المفضل للحصة (مثلاً: 6 مساءً)"
          className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white"
          value={data.environment.preferredTime}
          onChange={e => setData({...data, environment: {...data.environment, preferredTime: e.target.value}})}
        />
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-blue-400">
          <Target size={24} /> الأهداف التدريبية
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['بناء عضلي', 'خسارة دهون', 'زيادة قوة وتحمل', 'لياقة عامة', 'مرونة وتوازن'].map(goal => (
            <button
              key={goal}
              type="button"
              onClick={() => toggleGoal(goal)}
              className={`p-4 rounded-2xl text-sm font-bold transition-all border ${
                data.goals.includes(goal)
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>جاري الحفظ...</span>
          </>
        ) : (
          "حفظ استبيان التمارين والانتقال للتالي"
        )}
      </button>
    </form>
  );
}
