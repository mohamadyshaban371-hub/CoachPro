import React, { useState, useEffect } from 'react';
import { UserProfile, FullQuestionnaire } from '../types';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, getDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, Activity, Utensils, Dumbbell, Zap, Heart, ArrowRight, ArrowLeft, CircleAlert, Calendar } from 'lucide-react';
import { playClick, playSuccess } from '../lib/sounds';

import NutritionSurvey from './surveys/NutritionSurvey';
import WorkoutSurvey from './surveys/WorkoutSurvey';
import RehabSurvey from './surveys/RehabSurvey';
import EMSSurvey from './surveys/EMSSurvey';

function stripBase64<T>(obj: T): T {
  if (typeof obj === 'string') {
    return (obj.startsWith('data:') ? '' : obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripBase64) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = stripBase64(v);
    }
    return out as T;
  }
  return obj;
}

interface SurveyManagerProps {
  profile: UserProfile;
  onComplete: () => void;
}

export default function SurveyManager({ profile, onComplete }: SurveyManagerProps) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Partial<FullQuestionnaire>>({
    userId: profile.uid,
    submittedAt: new Date().toISOString()
  });
  const [loadingDraft, setLoadingDraft] = useState(true);

  // ─── Menstrual cycle step (female clients only) ─────────────────────────
  // Shown AFTER all surveys complete, BEFORE final submission.
  const [showCycleStep, setShowCycleStep] = useState(false);
  const [pendingFinalData, setPendingFinalData] = useState<Partial<FullQuestionnaire> | null>(null);
  const savedCycle = (profile as any).cycleLog || {};
  const [cycleData, setCycleData] = useState({
    lastPeriodStart: savedCycle.lastPeriodStart || '',
    cycleLength: savedCycle.cycleLength || 28,
  });

  // Load draft from Firestore if exists
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const qDoc = await getDoc(doc(db, 'questionnaires', profile.uid));
        if (qDoc.exists()) {
          setQuestionnaire(qDoc.data() as FullQuestionnaire);
        }
      } catch (err) {
        console.error("Error loading questionnaire draft:", err);
      } finally {
        setLoadingDraft(false);
      }
    };
    loadDraft();
  }, [profile.uid]);

  // Determine which surveys are needed based on packages
  const neededSurveys = [];
  if (profile.packages?.nutrition) neededSurveys.push('nutrition');
  if (profile.packages?.workout) neededSurveys.push('workout');
  if (profile.packages?.rehab) neededSurveys.push('rehab');
  if (profile.packages?.ems) neededSurveys.push('ems');

  const currentSurvey = neededSurveys[step] as string | undefined;

  if (loadingDraft) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-bold">جاري تحميل بياناتك...</p>
      </div>
    );
  }

  if (neededSurveys.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-600/30">
          <CheckCircle2 size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">لا توجد استبيانات مطلوبة</h2>
        <p className="text-slate-400 max-w-sm">لم يتم تفعيل أي باقة بعد. بمجرد تفعيل الكوتش لباقتك ستظهر هنا استبياناتك.</p>
        <button onClick={() => { playClick(); onComplete(); }} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all">
          متابعة
        </button>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-lg w-full bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/40"
          >
            <Activity size={48} className="text-white" />
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white">
              أهلاً وسهلاً، {profile.name}! 🎉
            </h1>
            <p className="text-blue-400 font-bold text-lg">مرحباً بك في عائلة كوتش برو</p>
            <p className="text-slate-400 leading-relaxed text-base">
              قررت تاخد خطوة صح نحو حياة أفضل وصحة أقوى. إحنا معاك في كل خطوة على طريق وصولك لهدفك! 💪
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: <Dumbbell size={20} />, label: 'تدريب احترافي', color: 'blue' },
              { icon: <Utensils size={20} />, label: 'تغذية مخصصة', color: 'green' },
              { icon: <Zap size={20} />, label: 'متابعة مستمرة', color: 'purple' },
            ].map((item, i) => (
              <div key={i} className={`p-4 bg-${item.color}-600/10 border border-${item.color}-500/20 rounded-2xl text-center`}>
                <div className={`text-${item.color}-400 flex justify-center mb-2`}>{item.icon}</div>
                <p className={`text-[11px] font-bold text-${item.color}-300`}>{item.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-300 text-sm leading-relaxed font-medium">
              الخطوة الجاية هي ملء الاستبيانات الصحية حتى يقدر الكوتش يصمم برنامجك المخصص بأعلى دقة.
              فقط خليك صادق في إجاباتك! ✨
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSuccess(); setShowWelcome(false); }}
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-black text-lg shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3"
          >
            <ArrowRight size={22} />
            يلا نبدأ! 🚀
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const handleBack = () => {
    if (step > 0) {
      playClick();
      setStep(step - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSurveyComplete = async (data: any) => {
    if (!currentSurvey) return;
    setIsSaving(true);
    setError(null);
    const updatedQuestionnaire = { ...questionnaire, [currentSurvey]: data };
    setQuestionnaire(updatedQuestionnaire);

    // Save photos to a dedicated collection BEFORE stripping (so admin can see them).
    const photos = updatedQuestionnaire.nutrition?.photos;
    if (photos && (photos.front || photos.side || photos.inBody)) {
      try {
        await setDoc(doc(db, 'client_photos', profile.uid), {
          front:  photos.front  || '',
          side:   photos.side   || '',
          inBody: photos.inBody || '',
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Failed to save client photos:", err);
      }
    }

    // Save draft to Firestore — strip base64 photos first (Firestore 1MB limit).
    try {
      await setDoc(doc(db, 'questionnaires', profile.uid), stripBase64(updatedQuestionnaire));
    } catch (err) {
      console.warn("Failed to save draft:", err);
    }

    if (step < neededSurveys.length - 1) {
      setStep(step + 1);
      setIsSaving(false);
      window.scrollTo(0, 0);
    } else {
      // For female clients: pause before final submission to collect cycle data.
      // Check all possible locations where gender may be stored.
      const isFemale =
        profile.gender === 'female' ||
        (profile.onboardingData as any)?.gender === 'female';
      if (isFemale) {
        setPendingFinalData(updatedQuestionnaire);
        setIsSaving(false);
        setShowCycleStep(true);
        window.scrollTo(0, 0);
        return;
      }

      // Final submission
      await doFinalSubmit(updatedQuestionnaire);
    }
  };

  /** Saves cycleLog then triggers the final questionnaire submission. */
  const handleCycleSubmit = async () => {
    if (!pendingFinalData) return;
    setIsSaving(true);
    setError(null);
    try {
      if (cycleData.lastPeriodStart) {
        await updateDoc(doc(db, 'users', profile.uid), {
          cycleLog: {
            lastPeriodStart: cycleData.lastPeriodStart,
            cycleLength: Number(cycleData.cycleLength) || 28,
          },
        });
      }
      await doFinalSubmit(pendingFinalData);
    } catch (err: any) {
      setError('حدث خطأ أثناء حفظ بيانات الدورة. حاولي مرة أخرى.');
      setIsSaving(false);
    }
  };

  /** Performs the shared final-submission logic (questionnaire + notifications). */
  const doFinalSubmit = async (updatedQuestionnaire: Partial<FullQuestionnaire>) => {
    setIsSaving(true);
    setError(null);
    try {
        const obInBody =
          profile.onboardingData?.inBodyExtracted ||
          (profile.onboardingData as any)?.manualInBody as any;
        const nMeas = updatedQuestionnaire.nutrition?.measurements;

        // Only keep real https:// photo URLs — base64 blobs are too large for Firestore.
        const safePhoto = (url?: string) =>
          url && !url.startsWith('data:') ? url : '';

        const initialMeasurement = {
          date: new Date().toISOString(),
          weight:          nMeas?.weight          || obInBody?.weight          || profile.onboardingData?.weight || 0,
          fatPercentage:   nMeas?.fatPercentage   || obInBody?.fatPercentage   || 0,
          muscleMass:      nMeas?.muscleMass      || obInBody?.muscleMass      || 0,
          waterPercentage: nMeas?.waterPercentage || obInBody?.waterPercentage || 0,
          protein:         nMeas?.protein         || obInBody?.protein         || 0,
          photos: {
            front:  safePhoto(updatedQuestionnaire.nutrition?.photos?.front),
            side:   safePhoto(updatedQuestionnaire.nutrition?.photos?.side),
            inBody: safePhoto(updatedQuestionnaire.nutrition?.photos?.inBody) ||
                    safePhoto((profile.onboardingData as any)?.inBodyPhoto),
          },
        };

        // Strip all base64 strings from nutrition data before writing to user doc.
        const safeNutrition = updatedQuestionnaire.nutrition
          ? stripBase64(updatedQuestionnaire.nutrition)
          : null;

        // Mirror cycle fields from any GeneralMedicalForm section to cycleLog
        // so the Scientific Engine can always read them from the user doc.
        const anyMedical: any =
          updatedQuestionnaire.nutrition?.medical ||
          (updatedQuestionnaire.workout as any)?.medical ||
          (updatedQuestionnaire as any)?.ems?.medical ||
          {};
        const isFemaleProfile = profile.gender === 'female' || (profile.onboardingData as any)?.gender === 'female';
        const cyclePatch: Record<string, any> = {};
        if (isFemaleProfile && anyMedical.lastPeriodStart && !(profile as any).cycleLog?.lastPeriodStart) {
          cyclePatch.cycleLog = {
            lastPeriodStart: anyMedical.lastPeriodStart,
            cycleLength: Number(anyMedical.cycleLength) || 28,
          };
        }

        await updateDoc(doc(db, 'users', profile.uid), {
          questionnaireComplete: true,
          measurementHistory: [initialMeasurement],
          nutritionSurveyData: safeNutrition,
          inBodyData: obInBody || null,
          ...cyclePatch,
        });

        // Notify all admins that the client completed the questionnaire
        try {
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminSnap = await getDocs(adminQuery);
          const notifPromises = adminSnap.docs.map(adminDoc =>
            addDoc(collection(db, 'users', adminDoc.id, 'notifications'), {
              title: '📋 استبيان جديد مكتمل',
              message: `${profile.name} أكمل/أكملت الاستبيانات وأصبحت البيانات جاهزة للمراجعة وإعداد الخطة.`,
              type: 'questionnaire',
              isRead: false,
              clientUid: profile.uid,
              clientName: profile.name,
              createdAt: new Date().toISOString(),
            })
          );
          await Promise.all(notifPromises);
        } catch (notifErr) {
          console.warn('Could not send admin notification:', notifErr);
        }

        playSuccess();
        onComplete();
      } catch (error) {
        console.error("Error saving questionnaire:", error);
        setError("حدث خطأ أثناء حفظ البيانات النهائية. يرجى مراجعة اتصال الإنترنت.");
        setIsSaving(false);
      }
  };

  const getSurveyTitle = (type: string) => {
    switch (type) {
      case 'nutrition': return 'استبيان التغذية الذكي';
      case 'workout': return 'استبيان التمارين المخصص';
      case 'rehab': return 'ملف التأهيل الطبي';
      case 'ems': return 'إقرار السلامة وجلسات EMS';
      default: return '';
    }
  };

  const getSurveyIcon = (type: string) => {
    switch (type) {
      case 'nutrition': return <Utensils className="text-green-400" />;
      case 'workout': return <Dumbbell className="text-blue-400" />;
      case 'rehab': return <Heart className="text-red-400" />;
      case 'ems': return <Zap className="text-purple-400" />;
      default: return null;
    }
  };

  // ─── Menstrual cycle step (female clients, shown after final survey) ────
  if (showCycleStep) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full space-y-6"
        >
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-pink-600/20 border border-pink-500/30 rounded-full flex items-center justify-center mx-auto">
              <Calendar size={28} className="text-pink-400" />
            </div>
            <h2 className="text-2xl font-black text-white">معلومات الدورة الشهرية</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              تساعد هذه المعلومات الذكاء الاصطناعي على تعديل شدة التمرين والتغذية تبعاً لمرحلة دورتك تلقائياً.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold">
              <CircleAlert size={18} />
              {error}
            </div>
          )}

          {/* Form */}
          <div className="bg-pink-600/10 border border-pink-500/20 rounded-[2rem] p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold block">تاريخ بدء آخر دورة</label>
                <input
                  type="date"
                  className="w-full bg-slate-800/80 border border-pink-500/20 rounded-2xl px-4 py-3 text-white outline-none focus:border-pink-500 transition-all text-sm"
                  value={cycleData.lastPeriodStart}
                  onChange={e => setCycleData(prev => ({ ...prev, lastPeriodStart: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold block">طول الدورة (يوم)</label>
                <input
                  type="number"
                  min={21}
                  max={40}
                  className="w-full bg-slate-800/80 border border-pink-500/20 rounded-2xl px-4 py-3 text-white outline-none focus:border-pink-500 transition-all text-sm"
                  value={cycleData.cycleLength}
                  onChange={e => setCycleData(prev => ({ ...prev, cycleLength: Number(e.target.value) }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              المعدل الطبيعي: 21–35 يوم. يمكنك تخطي هذه الخطوة وتحديثها لاحقاً من ملفك الشخصي.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCycleSubmit}
              disabled={isSaving}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-2xl font-black text-base shadow-xl shadow-pink-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {isSaving
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ...</>
                : <><CheckCircle2 size={18} /> حفظ وإرسال الملف</>}
            </motion.button>
            <button
              onClick={() => { setShowCycleStep(false); doFinalSubmit(pendingFinalData!); }}
              disabled={isSaving}
              className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors"
            >
              تخطي هذه الخطوة والمتابعة
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentSurvey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-600/30">
          <CheckCircle2 size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">تم إنهاء الاستبيانات</h2>
        <button onClick={onComplete} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all">
          متابعة للوحة التحكم
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold">
            <CircleAlert size={18} />
            {error}
          </div>
        )}
        {/* Progress Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">الخطوة الثانية</h1>
              <p className="text-slate-500 text-sm">بناء ملفك الرياضي المتكامل</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-blue-500 font-black text-2xl">{step + 1}</span>
            <span className="text-slate-600 font-bold"> / {neededSurveys.length}</span>
          </div>
        </div>

        {/* Survey Progress Bar */}
        <div className="flex gap-2 mb-8">
          {neededSurveys.map((s, i) => (
            <div 
              key={s} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-900'
              }`}
            />
          ))}
        </div>

        <motion.div
          key={currentSurvey}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between gap-4 p-4 sm:p-6 bg-slate-900/30 border border-white/5 rounded-[2rem]">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-3 sm:p-4 bg-slate-800 rounded-2xl shrink-0">
                {getSurveyIcon(currentSurvey)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate">{getSurveyTitle(currentSurvey)}</h2>
                <p className="text-slate-500 text-xs mt-1 hidden sm:block">يرجى ملء البيانات بدقة لضمان أفضل نتائج</p>
              </div>
            </div>
            {step > 0 && !isSaving && (
              <button
                type="button"
                onClick={handleBack}
                className="shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold border border-white/10 transition"
                title="رجوع للاستبيان السابق"
              >
                <ArrowRight size={14} />
                <span>رجوع</span>
              </button>
            )}
          </div>

          {currentSurvey === 'nutrition' && (() => {
            // Pre-populate InBody measurements from onboarding if the nutrition
            // survey draft doesn't have them yet. This ensures the numbers the
            // client entered / OCR-extracted during registration carry through.
            const obInBody =
              profile.onboardingData?.inBodyExtracted ||
              (profile.onboardingData as any)?.manualInBody as any;
            const qMeas = questionnaire.nutrition?.measurements;
            const hasMeas = qMeas && Object.values(qMeas).some((v: any) => Number(v) > 0);
            const enrichedNutrition: typeof questionnaire.nutrition = hasMeas
              ? questionnaire.nutrition
              : ({
                  ...questionnaire.nutrition,
                  measurements: {
                    chest: qMeas?.chest ?? 0,
                    waist: qMeas?.waist ?? 0,
                    arm:   qMeas?.arm   ?? 0,
                    thigh: qMeas?.thigh ?? 0,
                    weight:          obInBody?.weight          || qMeas?.weight          || 0,
                    fatPercentage:   obInBody?.fatPercentage   || qMeas?.fatPercentage   || 0,
                    muscleMass:      obInBody?.muscleMass      || qMeas?.muscleMass      || 0,
                    waterPercentage: obInBody?.waterPercentage || qMeas?.waterPercentage || 0,
                    protein:         obInBody?.protein         || qMeas?.protein         || 0,
                  },
                  // Also carry the InBody photo from onboarding
                  photos: {
                    front:  questionnaire.nutrition?.photos?.front  || '',
                    side:   questionnaire.nutrition?.photos?.side   || '',
                    inBody: questionnaire.nutrition?.photos?.inBody || (profile.onboardingData as any)?.inBodyPhoto || '',
                  },
                } as typeof questionnaire.nutrition);
            return <NutritionSurvey userId={profile.uid} gender={profile.gender} initialData={enrichedNutrition} onComplete={handleSurveyComplete} isLoading={isSaving} />;
          })()}
          {currentSurvey === 'workout' && <WorkoutSurvey profile={profile} initialData={questionnaire.workout} onComplete={handleSurveyComplete} isLoading={isSaving} />}
          {currentSurvey === 'rehab' && <RehabSurvey userId={profile.uid} painPoints={profile.onboardingData?.painPoints} initialData={questionnaire.rehab} onComplete={handleSurveyComplete} isLoading={isSaving} />}
          {currentSurvey === 'ems' && <EMSSurvey gender={profile.gender} initialData={questionnaire.ems} onComplete={handleSurveyComplete} isLoading={isSaving} />}
        </motion.div>
      </div>
    </div>
  );
}
