import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from '../firebase';
import { UserProfile, WeeklyPlan, DayPlan, Meal, Exercise, AppNotification } from '../types';
import { LogOut, ShieldAlert, Clock, CheckCircle2, Activity, Utensils, Dumbbell, Target, CircleAlert, MessageCircle, ChevronRight, ArrowRight, Scale, X, Download, Droplets, Heart, Check, ChevronLeft, Calendar, Zap, Frown, Meh, Smile, Volume2, Play, MessageSquare, RefreshCw, Bell, Eye, Crown, Refrigerator, FileText, User as UserIcon, Bot, Send, Camera } from 'lucide-react';
import CelebrationPopup from './CelebrationPopup';
import Chat from './Chat';
import { motion, AnimatePresence } from 'motion/react';
import SurveyManager from './SurveyManager';
import MeasurementUpdate from './MeasurementUpdate';
import ProgressUpdate from './ProgressUpdate';
import RecoveryWorkoutModal from './RecoveryWorkoutModal';
import MoodTrendChart from './MoodTrendChart';
import FalconEye from './FalconEye';
import ChampionsFeed from './ChampionsFeed';
import Profile from './Profile';
import FridgeScanner from './FridgeScanner';
import SmartwatchPanel from './SmartwatchPanel';
import PeriodTracker from './PeriodTracker';
import PointsBadge from './PointsBadge';
import DashboardShell, { ShellTab } from './DashboardShell';
import NotificationCenter from './NotificationCenter';
import { playClick, playNotify, playSuccess } from '../lib/sounds';
import { awardCoins } from '../lib/gamification';
import { useI18n } from '../lib/i18n';
import { doc, updateDoc, onSnapshot, collection, addDoc, setDoc, query, orderBy, getDoc } from 'firebase/firestore';
import type { FullQuestionnaire } from '../types';
import { logClientActivity } from '../lib/activityLog';
import { toClientIntensity, EMS_PRE_SESSION_CHECKLIST } from '../lib/emsProtocol';
// jsPDF + html2canvas are heavy (~800KB combined) and only needed when the
// user clicks Export PDF. They're imported dynamically inside generatePDF
// below so the initial dashboard bundle stays light.
import Markdown from 'react-markdown';
import { aiMasterEngine, handleAIError } from '../services/aiMasterEngine';
import {
  progressLoad,
  selectAdaptiveTests,
  computeRiskLevel,
  groupTestsByCategory,
  scoreCategorizedTest,
  computeFitnessAssessment,
  CATEGORY_NAMES,
  selectRehabTests,
  REHAB_CATEGORY_NAMES,
  type CategorizedTest,
  type TestCategory,
  type RehabTest,
} from '../lib/scientificEngine';
import { buildAdaptiveContext } from '../services/aiMasterEngine';
import AICoachDashboard from './AICoachDashboard';
import { useWorkoutBuilder } from '../hooks/useWorkoutBuilder';
import { useMealBuilder } from '../hooks/useMealBuilder';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ClientDashboardProps {
  profile: UserProfile;
}

const ARABIC_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ARABIC_DAY_NAMES: Record<string, string> = {
  Saturday: 'السبت',
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة'
};

export default function ClientDashboard({ profile: initialProfile }: ClientDashboardProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(initialProfile);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  const [currentTip, setCurrentTip] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSurvey, setShowSurvey] = useState(profile.isActivated && !profile.questionnaireComplete);
  const [showMeasurementUpdate, setShowMeasurementUpdate] = useState(false);
  const [showProgressUpdate, setShowProgressUpdate] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<'workout' | 'nutrition' | 'rehab' | 'weekly' | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  });

  const [substitutes, setSubstitutes] = useState<{mealIdx: number, list: string[]} | null>(null);
  const [groceryList, setGroceryList] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  // Flexible Modifications — exercise swap
  const [swapPrompt, setSwapPrompt] = useState<{ exIdx: number; original: Exercise } | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [swapProposal, setSwapProposal] = useState<{ exIdx: number; replacement: any } | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [budgetSubstitutes, setBudgetSubstitutes] = useState<{mealIdx: number, list: string[]} | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [showSocialAI, setShowSocialAI] = useState(false);
  const [socialAdvice, setSocialAdvice] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showMoodSurvey, setShowMoodSurvey] = useState(true);
  const [moodAdvice, setMoodAdvice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'analysis' | 'chat' | 'assessment' | 'injury' | 'falcon' | 'feed' | 'profile'>('today');
  const [showFridgeScanner, setShowFridgeScanner] = useState(false);
  const [showEmsSafety, setShowEmsSafety] = useState(false);
  const [emsCheckedItems, setEmsCheckedItems] = useState<Record<string, boolean>>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isFillingAssessment, setIsFillingAssessment] = useState<string | null>(null);
  const [assessmentResults, setAssessmentResults] = useState<{[key: string]: string | number}>({});
  const [adaptiveInputs, setAdaptiveInputs] = useState<Record<string, string>>({});
  const [savingAdaptive, setSavingAdaptive] = useState(false);
  const [selectedClientWorkout, setSelectedClientWorkout] = useState<any>(null);
  const { clientWorkouts, saveWorkout, markExerciseComplete } = useWorkoutBuilder(profile.uid);
  const { mealPlans, markMealComplete } = useMealBuilder(profile.uid);

  // Load questionnaire for adaptive test location awareness
  const [questionnaire, setQuestionnaire] = useState<FullQuestionnaire | undefined>(undefined);
  useEffect(() => {
    if (!profile.uid) return;
    getDoc(doc(db, 'questionnaires', profile.uid)).then(snap => {
      if (snap.exists()) setQuestionnaire(snap.data() as FullQuestionnaire);
    }).catch(() => {});
  }, [profile.uid]);

  useEffect(() => {
    if (!clientWorkouts.length) {
      setSelectedClientWorkout(null);
      return;
    }
    if (!selectedClientWorkout || !clientWorkouts.some((workout) => workout.id === selectedClientWorkout.id)) {
      setSelectedClientWorkout(clientWorkouts[0]);
    }
  }, [clientWorkouts, selectedClientWorkout]);

  const handleClientExerciseField = async (exerciseId: string, field: 'notes' | 'performedWeight', value: string) => {
    if (!selectedClientWorkout) return;
    const nextExercises = selectedClientWorkout.exercises.map((exercise: any) =>
      exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
    );
    const updated = { ...selectedClientWorkout, exercises: nextExercises };
    setSelectedClientWorkout(updated);
    await saveWorkout(updated);
  };

  const handleClientExerciseComplete = async (exerciseId: string) => {
    if (!selectedClientWorkout) return;
    const updated = await markExerciseComplete(selectedClientWorkout, exerciseId);
    if (updated) setSelectedClientWorkout(updated);
  };

  const handleClientMealComplete = async (plan: any, mealId: string) => {
    await markMealComplete(plan, mealId);
  };

  const activeMealPlan = useMemo(() => {
    const todayKey = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    return mealPlans.find((plan) => plan.day === todayKey) || mealPlans[0] || null;
  }, [mealPlans]);

  // Adaptive Test Selector — system picks safe tests based on profile + questionnaire location.
  const adaptiveCtx = useMemo(
    () => buildAdaptiveContext(profile, questionnaire, profile.experienceLevel as any),
    [profile, questionnaire]
  );
  const adaptiveTests = useMemo(() => selectAdaptiveTests(adaptiveCtx), [adaptiveCtx]);
  const adaptiveRiskLevel = useMemo(() => computeRiskLevel(adaptiveCtx), [adaptiveCtx]);
  const adaptiveGroups = useMemo(() => groupTestsByCategory(adaptiveTests), [adaptiveCtx]);

  // Rehab Test Selector — only for rehab package clients
  const isRehabOnly = !!(profile.packages?.rehab) && !profile.packages?.workout && !profile.packages?.ems;
  const hasEmsOrWorkout = !!(profile.packages?.ems || profile.packages?.workout);
  const rehabInjuryAreas = useMemo(() => {
    const od = profile.onboardingData as any;
    if (!od?.hasInjury) return [];
    return (od.injuryDescription || '').split(/[,،\n]/).map((s: string) => s.trim()).filter(Boolean);
  }, [profile]);
  const rehabTests = useMemo<RehabTest[]>(() => selectRehabTests(rehabInjuryAreas), [rehabInjuryAreas]);
  const [rehabInputs, setRehabInputs] = useState<Record<string, string>>({});
  const [savingRehab, setSavingRehab] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  useEffect(() => {
    if (!profile.uid) return;
    
    // Fetch notifications
    const notificationsRef = collection(db, 'users', profile.uid, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data);
    }, (error) => {
      console.error("Notifications listener error:", error);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Show a one-per-day login celebration popup
  useEffect(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    const celebKey = `cp.celebration.${profile.uid}.${todayKey}`;
    try {
      if (!localStorage.getItem(celebKey) && profile.isActivated) {
        localStorage.setItem(celebKey, '1');
        const delay = setTimeout(() => {
          setCelebrationMsg(t('celebration.login'));
          setShowCelebration(true);
        }, 1200);
        return () => clearTimeout(delay);
      }
    } catch (error) {
      console.warn('[ClientDashboard] celebration storage write failed:', error);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.uid, profile.isActivated]);

  // Ping the user softly when a brand-new unread notification arrives.
  // We track the previous unread count so the sound only fires on increase.
  const [prevUnread, setPrevUnread] = useState<number>(0);
  useEffect(() => {
    if (unreadCount > prevUnread) {
      playNotify();
    }
    setPrevUnread(unreadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const docRef = doc(db, 'users', profile.uid, 'notifications', notificationId);
      await updateDoc(docRef, { isRead: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleSaveAdaptive = async () => {
    try {
      // Convert text inputs → numbers
      const raw: Record<string, number> = {};
      for (const [id, v] of Object.entries(adaptiveInputs)) {
        const n = Number((v ?? '').toString().trim());
        if (!isNaN(n)) raw[id] = n;
      }
      if (Object.keys(raw).length === 0) {
        setMessage({ text: 'يرجى إدخال نتيجة واحدة على الأقل قبل الحفظ.', type: 'error' });
        setTimeout(() => setMessage(null), 4000);
        return;
      }

      setSavingAdaptive(true);
      const age = profile.onboardingData?.age || 30;
      const gender = (profile.onboardingData?.gender || profile.gender || 'male') as 'male' | 'female';
      const level = (profile.experienceLevel || 'intermediate') as 'beginner' | 'intermediate' | 'advanced';

      // Compute the deterministic 5-category fitness assessment
      const assessment = computeFitnessAssessment(raw, age, gender, level);

      const userRef = doc(db, 'users', profile.uid);
      const adaptiveCol = collection(userRef, 'adaptiveAssessments');
      const docPayload = JSON.parse(JSON.stringify({
        date: new Date().toISOString(),
        riskLevel: adaptiveRiskLevel,
        rawResults: raw,
        assessment,
      }));

      // Archive + latest pointer (idempotent overwrite of `latest`)
      await addDoc(adaptiveCol, docPayload);
      await setDoc(doc(adaptiveCol, 'latest'), docPayload);

      // Mirror into assessmentHistory so the AI engine + UI charts pick it up
      const newEntries = adaptiveTests
        .filter(t => raw[t.id] !== undefined)
        .map(t => ({
          date: new Date().toISOString(),
          testName: t.nameAr,
          value: String(raw[t.id]),
        }));

      const sanitized = JSON.parse(JSON.stringify({
        assessmentHistory: [...(profile.assessmentHistory || []), ...newEntries],
      }));
      await updateDoc(userRef, sanitized);

      setMessage({ text: 'تم حفظ نتائج الاختبارات التكيفية وإرسالها للمحرك العلمي.', type: 'success' });
      setAdaptiveInputs({});
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error('handleSaveAdaptive Error:', err);
      setMessage({ text: 'تعذّر حفظ النتائج. حاول مرة أخرى.', type: 'error' });
    } finally {
      setSavingAdaptive(false);
    }
  };

  const handleSaveRehab = async () => {
    if (Object.keys(rehabInputs).length === 0) return;
    setSavingRehab(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const rehabCol = collection(userRef, 'rehabAssessments');
      const results = Object.fromEntries(
        Object.entries(rehabInputs).map(([id, val]) => {
          const test = rehabTests.find(t => t.id === id);
          return [test?.nameAr || id, val];
        })
      );
      const docPayload = JSON.parse(JSON.stringify({
        date: new Date().toISOString(),
        injuryAreas: rehabInjuryAreas,
        rawResults: rehabInputs,
        results,
      }));
      await addDoc(rehabCol, docPayload);
      await setDoc(doc(rehabCol, 'latest'), docPayload);
      const newEntries = rehabTests
        .filter(t => rehabInputs[t.id] !== undefined)
        .map(t => ({
          date: new Date().toISOString(),
          testName: t.nameAr,
          value: String(rehabInputs[t.id]),
          unit: t.measurement,
        }));
      const sanitized = JSON.parse(JSON.stringify({
        assessmentHistory: [...(profile.assessmentHistory || []), ...newEntries],
      }));
      await updateDoc(userRef, sanitized);
      playSuccess();
      setMessage({ text: 'تم حفظ نتائج تقييم الإصابة وإرسالها للكوتش ✅', type: 'success' });
      setRehabInputs({});
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error('handleSaveRehab Error:', err);
      setMessage({ text: 'تعذّر حفظ النتائج. حاول مرة أخرى.', type: 'error' });
    } finally {
      setSavingRehab(false);
    }
  };

  const handleCompleteAssessment = async (requestId: string) => {
    try {
      setIsAiLoading(true);
      const userRef = doc(db, 'users', profile.uid);
      const assessmentsCol = collection(userRef, 'assessments');
      
      // Update the request status in the main profile
      const updatedRequests = profile.assessmentRequests?.map(req => 
        req.id === requestId ? { 
          ...req, 
          status: 'completed' as const, 
          completedAt: new Date().toISOString(),
          results: assessmentResults 
        } : req
      );

      // Prepare structured data for the assessments collection
      const rawAssessmentDoc = {
        requestId,
        date: new Date().toISOString(),
        templateName: profile.assessmentRequests?.find(r => r.id === requestId)?.templateName || 'Unknown',
        results: assessmentResults,
        calculatedMetrics: Object.entries(assessmentResults).reduce((acc, [test, val]) => {
          if (typeof val === 'string' && (val as string).includes(':')) {
            const [w, r] = (val as string).split(':').map(Number);
            if (!isNaN(w) && !isNaN(r)) {
              acc[`${test}_1RM`] = aiMasterEngine.calculate1RM(w, r);
            }
          }
          return acc;
        }, {} as any)
      };

      const assessmentDoc = JSON.parse(JSON.stringify(rawAssessmentDoc));

      // 1. Save to sub-collection (Archive AND Latest)
      await addDoc(assessmentsCol, assessmentDoc);
      await setDoc(doc(assessmentsCol, 'latest'), assessmentDoc);

      // 2. Update local history array for real-time UI without re-fetching
      const newHistoryEntries = Object.entries(assessmentResults).map(([testName, val]) => {
        let estimated1RM: number | undefined;
        if (typeof val === 'string' && (val as string).includes(':')) {
           const [w, r] = (val as string).split(':').map(Number);
           if (!isNaN(w) && !isNaN(r)) estimated1RM = aiMasterEngine.calculate1RM(w, r);
        }
        
        const entry: any = {
          date: new Date().toISOString(),
          testName,
          value: val || '',
        };
        if (estimated1RM !== undefined) entry.estimated1RM = estimated1RM;
        return entry;
      });

      // Clean update data for Firestore (removes any accidental undefined values)
      const sanitizedUpdate = JSON.parse(JSON.stringify({
        assessmentRequests: updatedRequests || [],
        assessmentHistory: [...(profile.assessmentHistory || []), ...newHistoryEntries]
      }));

      await updateDoc(userRef, sanitizedUpdate);

      // Notify admins that client completed assessment
      try {
        const { query: fsQuery, where: fsWhere, getDocs: fsGetDocs } = await import('firebase/firestore');
        const adminSnap = await fsGetDocs(fsQuery(collection(db, 'users'), fsWhere('role', '==', 'admin')));
        const req = profile.assessmentRequests?.find(r => r.id === requestId);
        await Promise.all(adminSnap.docs.map(adminDoc =>
          addDoc(collection(db, 'users', adminDoc.id, 'notifications'), {
            title: '💪 نتائج تقييم بدني',
            message: `${profile.name} أرسل/أرسلت نتائج التقييم البدني (${req?.templateName || 'تقييم'}) — راجع النتائج لتحديث الخطة.`,
            type: 'assessment_complete',
            isRead: false,
            clientUid: profile.uid,
            clientName: profile.name,
            createdAt: new Date().toISOString(),
          })
        ));
      } catch (notifErr) {
        console.warn('Could not notify admin:', notifErr);
      }

      playSuccess();
      setMessage({ text: 'تم إرسال النتائج بنجاح! سيقوم الكوتش بتحديث خطتك قريباً.', type: 'success' });
      setIsFillingAssessment(null);
      setAssessmentResults({});
      
      // Auto-hide message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      console.error("handleCompleteAssessment Error:", err);
      setMessage({ text: 'خطأ أثناء إرسال النتائج. يرجى المحاولة مرة أخرى.', type: 'error' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleMoodSelection = async (mood: string, energy: number) => {
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.getPsychologicalAdjustment(mood, energy);
      setMoodAdvice(result);
      setShowMoodSurvey(false);
    } catch (err) {
      console.error(err);
      setMoodAdvice(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGetBudgetSubstitutes = async (meal: Meal, idx: number) => {
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.generateBudgetSubstitutes(meal.name, meal.items);
      setBudgetSubstitutes({ mealIdx: idx, list: result });
    } catch (err) {
      console.error(err);
      alert(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePredict = async () => {
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.predictProgress(profile);
      setPrediction(result);
    } catch (err) {
      console.error(err);
      setPrediction(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const speakInstructions = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      window.speechSynthesis.speak(utterance);
    }
  };

  const getExerciseGif = (name: string) => {
    const n = name.toLowerCase();
    const commonGifs: Record<string, string> = {
      'push-up': 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmNXF5Z3p3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKMGpxV73BfH6F2/giphy.gif',
      'squat': 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmNXF5Z3p3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3vR8IAtvP75ePLNu/giphy.gif',
      'plank': 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmNXF5Z3p3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKVUn7iM8FMEU24/giphy.gif',
      'bench': 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmNXF5Z3p3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0Hlx0N0P0Gf0d9N6/giphy.gif'
    };

    if (n.includes('push') || n.includes('ضغط')) return commonGifs['push-up'];
    if (n.includes('squat') || n.includes('سكوات')) return commonGifs['squat'];
    if (n.includes('plank')) return commonGifs['plank'];
    if (n.includes('bench')) return commonGifs['bench'];

    // If no match, use a neutral exercise placeholder
    return 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmNXF5Z3p3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eXp3eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKVUn7iM8FMEU24/giphy.gif';
  };

  const handleGetSocialAdvice = async (event: string, cuisine: string) => {
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.getSocialEventAdvice(event, cuisine);
      setSocialAdvice(result);
    } catch (err) {
      console.error(err);
      setSocialAdvice(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleMealScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const result = await aiMasterEngine.analyzeMealImage(base64);
        setScanResult(result);
      } catch (err) {
        console.error(err);
        setScanResult(handleAIError(err));
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGetSubstitutes = async (meal: Meal, idx: number) => {
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.generateSmartSubstitutes(meal.name, meal.items);
      setSubstitutes({ mealIdx: idx, list: result });
    } catch (err) {
      console.error(err);
      alert(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGetGroceryList = async () => {
    if (!profile.plans?.weeklyPlan) {
      setGroceryList('لم يتم إعداد خطتك الأسبوعية بعد. يرجى الانتظار حتى يقوم الكوتش بتجهيزها.');
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await aiMasterEngine.generateGroceryList(profile.plans.weeklyPlan);
      setGroceryList(result);
    } catch (err) {
      console.error(err);
      setGroceryList(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAskBot = async () => {
    if (!chatQuestion.trim()) return;
    setIsAiLoading(true);
    setChatAnswer(null); // Reset
    try {
      // Add more context
      const latestStats = profile.measurementHistory?.[profile.measurementHistory.length - 1];
      const statsStr = latestStats ? `وزني: ${latestStats.weight}كجم، دهوني: ${latestStats.fatPercentage}%` : '';
      const contextQuestion = `أنا ${profile.name}، هدفي: ${profile.onboardingData?.goal || 'اللياقة'}. ${statsStr}. سؤالي هو: ${chatQuestion}`;
      
      const result = await aiMasterEngine.getQuickReply(contextQuestion, profile);
      setChatAnswer(result);
      setChatQuestion("");
    } catch (err) {
      console.error(err);
      setChatAnswer(handleAIError(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  // ── Flexible Modifications: client-driven exercise swap ────────────────────
  const handleRequestSwap = async () => {
    if (!swapPrompt) return;
    setIsSwapping(true);
    try {
      const replacement = await aiMasterEngine.swapExercise(profile, swapPrompt.original, swapReason);
      if (replacement) {
        setSwapProposal({ exIdx: swapPrompt.exIdx, replacement });
        await logClientActivity(
          profile.uid,
          profile.name || profile.email || 'Client',
          'modification_requested' as any,
          `طلب تبديل تمرين: ${swapPrompt.original.name} → ${replacement.name}`,
          { reason: swapReason }
        );
      }
    } catch (err) {
      console.error('swap error', err);
    } finally {
      setIsSwapping(false);
      setSwapPrompt(null);
      setSwapReason('');
    }
  };

  const handleApplySwap = async () => {
    if (!swapProposal) return;
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const weeklyPlan: any = { ...(profile.plans?.weeklyPlan as any) };
    const dayPlan = { ...(weeklyPlan[dayName] || { nutrition: [], workout: [] }) };
    const workout = [...(dayPlan.workout || [])];
    workout[swapProposal.exIdx] = {
      ...workout[swapProposal.exIdx],
      ...swapProposal.replacement,
      name: `${swapProposal.replacement.name} ✨`
    };
    dayPlan.workout = workout;
    weeklyPlan[dayName] = dayPlan;
    try {
      await updateDoc(doc(db, 'users', profile.uid), { 'plans.weeklyPlan': weeklyPlan });
      setSwapProposal(null);
    } catch (err) {
      console.error('apply swap error', err);
    }
  };

  const handleApplySubstituteSound = () => playSuccess();
  const handleApplySubstitute = async (mealIdx: number, newItems: string) => {
    handleApplySubstituteSound();
    if (!profile.plans?.weeklyPlan) {
      alert('لا توجد خطة أسبوعية مفعّلة حالياً.');
      return;
    }
    const dayName = selectedDay;
    const weeklyPlan = { ...profile.plans.weeklyPlan };
    const dayPlan = { ...(weeklyPlan[dayName as keyof WeeklyPlan] || { nutrition: [], workout: [] }) } as DayPlan;
    const nutrition = [...(dayPlan.nutrition || [])];
    
    nutrition[mealIdx] = {
      ...nutrition[mealIdx],
      items: newItems,
      name: `${nutrition[mealIdx].name} (معدل ذكياً ✨)`
    };

    dayPlan.nutrition = nutrition;
    weeklyPlan[dayName as keyof WeeklyPlan] = dayPlan;

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        'plans.weeklyPlan': weeklyPlan
      });
      setSubstitutes(null);
      setBudgetSubstitutes(null);
    } catch (err) {
      console.error("Apply Substitute Error:", err);
    }
  };

  const dailyProgress = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = profile.dailyProgress?.[today];
    if (!log) return 0;
    
    // Check if tasks exist for today in the weekly plan
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    const plan = profile.plans?.weeklyPlan?.[dayName as keyof WeeklyPlan];
    
    const totalMeals = plan?.nutrition?.length || log.totalMeals || 0;
    const totalExercises = plan?.workout?.length || log.totalExercises || 0;
    const totalTasks = totalMeals + totalExercises;
    
    if (totalTasks === 0) return 0;

    const completed = (log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0);
    return Math.round((completed / totalTasks) * 100);
  }, [profile.dailyProgress, profile.plans?.weeklyPlan]);

  /**
   * Returns the number of days since the most recent measurement entry.
   * `Infinity` when the client has never logged measurements but is otherwise
   * active — signals "no data yet, force first capture".
   */
  const daysSinceLastMeasurement = (): number => {
    if (!profile.isActivated || !profile.questionnaireComplete) return 0;
    if (!profile.measurementHistory || profile.measurementHistory.length === 0) return Infinity;
    const lastUpdate = new Date(profile.measurementHistory[profile.measurementHistory.length - 1].date);
    return Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  };
  const needsMeasurementUpdate = () => daysSinceLastMeasurement() >= 14;
  const measurementWarning = (() => {
    const d = daysSinceLastMeasurement();
    if (d === Infinity || d >= 14) return null; // already mandatory — banner replaced by modal
    if (d >= 10) return { days: d, remaining: 14 - d };
    return null;
  })();

  // 14-day enforcement — automatically open the measurement update modal the
  // moment the dashboard mounts if the client is overdue. The modal itself
  // hides its dismiss controls when `mandatory` is true so the only path
  // forward is to upload fresh InBody + measurements.
  useEffect(() => {
    if (needsMeasurementUpdate() && !showMeasurementUpdate) {
      setShowMeasurementUpdate(true);
    }
    // Re-run whenever the latest measurement timestamp or activation state
    // changes (e.g. immediately after a successful update).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.measurementHistory?.length, profile.isActivated, profile.questionnaireComplete]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleUpdateMood = async (field: 'moodScore' | 'energyLevel', value: number) => {
    const today = new Date().toISOString().split('T')[0];
    const userRef = doc(db, 'users', profile.uid);
    try {
      await updateDoc(userRef, {
        [`dailyProgress.${today}.${field}`]: value
      });
      const label = field === 'energyLevel' ? 'مستوى الطاقة' : 'الحالة النفسية';
      const type = field === 'energyLevel' ? 'energy' : 'mood';
      await logClientActivity(
        profile.uid,
        profile.name || profile.email || 'Client',
        type,
        `${label}: ${value}/10`,
        { [field]: value, date: today }
      );
    } catch (error) {
      console.error("Mood Update Error:", error);
    }
  };

  const handleToggleTask = async (itemIndex: number, type: 'meal' | 'exercise') => {
    const today = new Date().toISOString().split('T')[0];
    const dayName = selectedDay;
    const plan = profile.plans?.weeklyPlan?.[dayName as keyof WeeklyPlan];
    if (!plan) return;

    const totalMeals = plan.nutrition?.length || 0;
    const totalExercises = plan.workout?.length || 0;

    const currentProgress = profile.dailyProgress?.[today] || {
      mealsCompleted: [],
      exercisesCompleted: [],
      totalMeals,
      totalExercises
    };

    let newMeals = [...(currentProgress.mealsCompleted || [])];
    let newExercises = [...(currentProgress.exercisesCompleted || [])];

    if (type === 'meal') {
      if (newMeals.includes(itemIndex)) newMeals = newMeals.filter(i => i !== itemIndex);
      else newMeals.push(itemIndex);
    } else {
      if (newExercises.includes(itemIndex)) newExercises = newExercises.filter(i => i !== itemIndex);
      else newExercises.push(itemIndex);
    }

    const userRef = doc(db, 'users', profile.uid);
    await updateDoc(userRef, {
      [`dailyProgress.${today}`]: {
        mealsCompleted: newMeals,
        exercisesCompleted: newExercises,
        totalMeals: totalMeals > 0 ? totalMeals : (currentProgress.totalMeals || 0),
        totalExercises: totalExercises > 0 ? totalExercises : (currentProgress.totalExercises || 0)
      }
    });

    // Live-feed event — only fire when ADDING (not when un-checking) to avoid noise.
    const wasAdded = type === 'meal'
      ? newMeals.includes(itemIndex) && !((currentProgress.mealsCompleted || []).includes(itemIndex))
      : newExercises.includes(itemIndex) && !((currentProgress.exercisesCompleted || []).includes(itemIndex));
    if (wasAdded) {
      const item = type === 'meal' ? plan.nutrition?.[itemIndex] : plan.workout?.[itemIndex];
      const itemName = (item as any)?.name || (item as any)?.exerciseName || (type === 'meal' ? 'وجبة' : 'تمرين');
      await logClientActivity(
        profile.uid,
        profile.name || profile.email || 'Client',
        type === 'meal' ? 'meal_completed' : 'workout_completed',
        type === 'meal' ? `أكمل وجبة: ${itemName}` : `أكمل تمرين: ${itemName}`,
        { date: today, day: dayName, index: itemIndex },
      );
      await awardCoins(profile.uid, type === 'meal' ? 'MEAL_COMPLETED' : 'WORKOUT_COMPLETED');
    }
  };

  const generatePDF = async () => {
    const element = document.getElementById('pdf-template');
    if (!element) return;

    try {
      setIsGeneratingPDF(true);

      // === Lazy-load the heavy PDF stack ONLY when the user clicks export. ===
      // 1. Dynamically import jsPDF + html2canvas (kept out of the initial bundle).
      // 2. Inject Cairo's heavy display weight (900) used by PDF headings — slim
      //    400/700 set is loaded at startup; 900 only when actually needed.
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
        // Inject extra Cairo weight stylesheet (idempotent — only added once).
        (async () => {
          if (!document.getElementById('cairo-pdf-weights')) {
            const link = document.createElement('link');
            link.id = 'cairo-pdf-weights';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;800;900&display=swap';
            document.head.appendChild(link);
          }
        })(),
      ]);
      const html2canvas = html2canvasMod.default;

      // Wait for fonts (including the just-injected 900) to be ready before
      // rasterizing — html2canvas relies on browser text shaping, and Arabic
      // glyphs fall back to squared shapes if Cairo isn't fully loaded yet.
      try {
        const fontsAny = (document as any).fonts;
        if (fontsAny?.ready) await fontsAny.ready;
        if (fontsAny?.load) {
          await Promise.all([
            fontsAny.load('400 14px Cairo'),
            fontsAny.load('700 16px Cairo'),
            fontsAny.load('900 22px Cairo'),
          ]);
        }
      } catch (fe) {
        console.warn('Font preload skipped:', fe);
      }

      // Force the PDF template to use Cairo + RTL during capture (regardless of
      // active locale/theme), so Arabic glyphs shape correctly every time.
      const previousFont = element.style.fontFamily;
      const previousDir = element.dir;
      element.style.fontFamily = 'Cairo, "Segoe UI", Tahoma, sans-serif';
      element.dir = 'rtl';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#020617',
        windowWidth: element.scrollWidth,
      });

      element.style.fontFamily = previousFont;
      element.dir = previousDir;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Slice the long capture across multiple pages so nothing gets cropped.
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`CoachPro_Plan_${profile.name || 'client'}.pdf`);
    } catch (error) {
      console.error('PDF Generation Failed:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const tips = [
    "شرب الماء بانتظام يحسن من أدائك الرياضي بنسبة 20%.",
    "النوم الكافي هو المفتاح الحقيقي لبناء العضلات وحرق الدهون.",
    "الاستمرارية أهم من الكثافة؛ ابدأ صغيراً واستمر.",
    "التنفس الصحيح أثناء التمرين يقلل من خطر الإصابة.",
    "وجبة ما بعد التمرين ضرورية لترميم الألياف العضلية.",
    "الـ EMS يساعد في تفعيل 90% من الألياف العضلية في وقت قياسي.",
    "الاستشفاء العضلي لا يقل أهمية عن التمرين نفسه."
  ];

  useEffect(() => {
    if (!profile.isActivated) {
      const interval = setInterval(() => {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [profile.isActivated]);

  if (!profile.isActivated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full space-y-8 py-12"
        >
          {/* Status Tracker */}
          <div className="w-full space-y-4 mb-12">
            <div className="flex justify-between text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
              <span className="text-green-500">إرسال البيانات</span>
              <span className="text-blue-500">مراجعة الكوتش</span>
              <span>تفعيل الحساب</span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: "33%" }}
                animate={{ width: "66%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
              />
            </div>
            <p className="text-blue-400 text-sm font-medium animate-pulse">جاري معالجة بياناتك وبناء خطتك المخصصة...</p>
          </div>

          {/* Intro Video / Logo Animation */}
          <div className="relative aspect-video w-full bg-slate-900 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl group">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="text-blue-600 opacity-20"
              >
                <Dumbbell size={120} />
              </motion.div>
            </div>
            {/* Stylized Video Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-600/40 cursor-pointer hover:scale-110 transition-transform">
                <Activity className="text-white animate-pulse" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white">مرحباً بك في كوتش برو</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">بمجرد قبول اشتراكك ستظهر لك جداولك التدريبية والغذائية هنا فوراً.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">بانتظار التفعيل</h2>
            <p className="text-slate-400 text-lg max-w-lg mx-auto">شكراً لإكمال بياناتك! الكوتش يقوم الآن بمراجعة ملفك لتصميم خطتك المثالية.</p>
          </div>
          
          {/* Dynamic Tips */}
          <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden backdrop-blur-sm">
            <div className="absolute -top-4 -right-4 p-4 opacity-5 rotate-12">
              <Target size={100} />
            </div>
            <h3 className="text-blue-500 font-bold mb-4 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <CircleAlert size={14} /> هل تعلم؟
            </h3>
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentTip}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xl font-medium leading-relaxed text-slate-200"
              >
                "{tips[currentTip]}"
              </motion.p>
            </AnimatePresence>
          </div>

          {/* WhatsApp & Logout */}
          <div className="pt-8 flex flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="https://wa.me/201558685502" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold shadow-xl shadow-green-600/20 transition-all group"
              >
                <MessageCircle size={24} />
                <span>تواصل مع الكوتش</span>
              </a>
              
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                <Activity size={24} className={isRefreshing ? "animate-spin" : ""} />
                <span>{isRefreshing ? "جاري التحديث..." : "تحديث الحالة"}</span>
              </button>
            </div>
            
            <button 
              onClick={() => auth.signOut()}
              className="text-slate-500 hover:text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showSurvey) {
    return <SurveyManager profile={profile} onComplete={() => setShowSurvey(false)} />;
  }

  const tabs: ShellTab[] = [
    { key: 'today', label: t('tab.today'), icon: Activity },
    { key: 'weekly', label: t('tab.weekly'), icon: Calendar },
    { key: 'analysis', label: t('tab.analysis'), icon: Zap },
    ...(profile.physicalAssessmentEnabled && hasEmsOrWorkout ? [{ key: 'assessment', label: t('tab.assessment'), icon: Scale }] : []),
    ...(profile.physicalAssessmentEnabled && isRehabOnly ? [{ key: 'injury', label: 'تقييم الإصابة', icon: Heart }] : []),
    { key: 'falcon', label: t('tab.falcon'), icon: Eye },
    { key: 'feed', label: t('tab.feed'), icon: Crown },
    { key: 'chat', label: t('tab.chat'), icon: MessageSquare },
    { key: 'profile', label: t('tab.profile'), icon: UserIcon },
  ] as ShellTab[];

  const headerActions = (
    <>
      <PointsBadge coins={profile.coins ?? 0} />
      <button
        onClick={() => setShowFridgeScanner(true)}
        className="p-2.5 bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:text-white hover:bg-cyan-600 rounded-xl transition-all border border-cyan-500/20"
        title={t('action.scanner')}
      >
        <Refrigerator size={18} />
      </button>
      <button
        onClick={() => {
          setShowNotifications(false);
          setNotificationCenterOpen(true);
        }}
        className="relative p-2.5 app-text-muted hover:app-text rounded-xl transition-all border app-border bg-white/40 dark:bg-white/5"
        title={t('action.notifications')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 border-2 border-white dark:border-slate-900 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => auth.signOut()}
        className="p-2.5 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
        title={t('action.signOut')}
      >
        <LogOut size={18} />
      </button>
    </>
  );

  return (
    <DashboardShell
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as typeof activeTab)}
      headerActions={headerActions}
    >
      <NotificationCenter
        userId={profile.uid}
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        onUnreadCountChange={(count) => {
          if (count !== unreadCount) {
            setNotifications((prev) => prev.map((note) => ({ ...note, read: note.read ?? !note.isRead })));
          }
        }}
      />

      {/* Notifications dropdown — opens when bell is clicked */}
      <AnimatePresence>
        {showNotifications && (
          <>
            {/* Click-away overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-[90] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-800/50">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                  <Bell size={16} className="text-blue-400" /> التنبيهات
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black">{unreadCount}</span>
                  )}
                </h3>
                <button onClick={() => setShowNotifications(false)} className="p-1 text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell size={28} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">لا توجد تنبيهات حالياً.</p>
                    <p className="text-[11px] text-slate-500 mt-1">هتوصلك هنا أي تحديث من الكوتش.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => !n.isRead && markNotificationAsRead(n.id)}
                      className={`w-full text-right p-3 rounded-2xl border transition-all ${
                        n.isRead
                          ? 'bg-slate-900/40 border-white/5 text-slate-400'
                          : 'bg-blue-500/5 border-blue-500/20 text-white hover:bg-blue-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-sm leading-tight">{n.title}</p>
                        {!n.isRead && <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                      </div>
                      <p className="text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                      {n.createdAt && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          {new Date(n.createdAt).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-24 left-1/2 z-[100] px-6 py-4 rounded-[2rem] font-bold shadow-2xl flex items-center gap-3 border ${
              message.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-2 p-1 hover:bg-black/10 rounded-full">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Dashboard Content */}
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Welcome & Progress Ribbon — only on the Today tab so the rest of
            the app isn't cluttered with the greeting + commitment ribbon. */}
        {activeTab === 'today' && (
        <section className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 rounded-[3rem] p-6 sm:p-8 relative overflow-hidden group shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
            <div className="space-y-2">
              <h2 className="text-3xl font-black">أهلاً بك، {profile.name} <span className="inline-block hover:rotate-12 transition-transform cursor-help">👋</span></h2>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                التزامك النهاردة بنسبة {dailyProgress}%.. إحنا هنا عشان نوصلك للهدف بأذكى الطرق.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {profile.packages?.workout && <span className="px-3 py-1 bg-blue-600/10 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/10">Gym/PT Active</span>}
                {profile.packages?.ems && <span className="px-3 py-1 bg-purple-600/10 text-purple-400 rounded-full text-[10px] font-bold border border-purple-500/10">EMS: {profile.packages.ems.sessions} Sessions</span>}
                {profile.packages?.nutrition && <span className="px-3 py-1 bg-green-600/10 text-green-400 rounded-full text-[10px] font-bold border border-green-500/10">Nutrition Active</span>}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-blue-500">{dailyProgress}%</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">إنجاز اليوم</div>
              </div>
              <div className="w-px h-12 bg-white/5"></div>
              <div className="text-center">
                <div className="text-3xl font-black text-green-500">
                  {profile.measurementHistory?.[profile.measurementHistory.length-1]?.weight || '--'}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">الوزن الحالي</div>
              </div>
            </div>
          </div>
          {/* Subtle Progress Bar Background */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${dailyProgress}%` }}
              className="h-full bg-gradient-to-r from-blue-600 to-green-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
            />
          </div>
        </section>
        )}

        {/* Assessment Alerts */}
        <AnimatePresence>
          {profile.assessmentRequests?.filter(r => r.status === 'pending').map(request => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-gradient-to-r from-blue-600/20 to-transparent border-l-4 border-blue-500 p-6 rounded-[2rem] flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <Scale size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white">مطلوب تقييم بدني جديد: {request.templateName}</h3>
                  <p className="text-xs text-slate-400">يرجى إكمال الاختبارات المطلوبة لتحديث خطتك التدريبية بأعلى دقة.</p>
                </div>
              </div>
              <button
                onClick={() => setIsFillingAssessment(request.id)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all"
              >
                بدء التقييم
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Anytime Measurement Update — the auto-modal still locks the
            dashboard at 14 days, but clients (and coaches reviewing) often
            want to log fresh InBody / weight numbers earlier (e.g. after a
            check-in week). This always-visible action exposes that path
            without waiting for the 14-day enforcement to fire. */}
        {activeTab === 'today' && (
          <section className="bg-gradient-to-r from-emerald-600/10 via-slate-900/50 to-emerald-600/5 border border-emerald-500/20 p-5 rounded-[2rem] flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 shrink-0">
                <Scale size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm">حدّث قياساتك في أي وقت</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {(() => {
                    const d = daysSinceLastMeasurement();
                    if (d === Infinity) return 'لم تسجّل أي قياسات بعد — ارفع تقرير InBody وصور لمتابعة دقيقة.';
                    if (measurementWarning) return `آخر تحديث من ${d} يوم — متبقي ${measurementWarning.remaining} يوم على التحديث الإلزامي.`;
                    return `آخر تحديث من ${d} يوم.`;
                  })()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowProgressUpdate(true)}
              className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <Camera size={14} /> تحديث البيانات
            </button>
          </section>
        )}

        {/* Mood & Energy Tracker — gated to the Today tab so other tabs (Weekly,
            Analysis, Feed, Profile, etc.) aren't dominated by the daily pulse. */}
        {activeTab === 'today' && (
        <section className="bg-slate-900/50 border border-white/5 p-8 rounded-[3rem] space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">كيف حالك اليوم يا بطل؟</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Daily Wellness Pulse</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-sans">مستوى الطاقة (1-10)</label>
                <span className="text-amber-500 font-bold text-lg">{profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.energyLevel || 0}</span>
              </div>
              <div className="flex gap-1.5 ltr">
                {[1,2,3,4,5,6,7,8,9,10].map(val => (
                  <button 
                    key={val}
                    onClick={() => handleUpdateMood('energyLevel', val)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm border ${
                      profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.energyLevel === val 
                        ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20 scale-105' 
                        : 'bg-slate-800 border-white/5 text-slate-500 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-sans">الحالة النفسية (1-10)</label>
                <span className="text-purple-500 font-bold text-lg">{profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.moodScore || 0}</span>
              </div>
              <div className="flex gap-1.5 ltr">
                 {[1,2,3,4,5,6,7,8,9,10].map(val => (
                  <button 
                    key={val}
                    onClick={() => handleUpdateMood('moodScore', val)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm border ${
                      profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.moodScore === val 
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20 scale-105' 
                        : 'bg-slate-800 border-white/5 text-slate-500 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(() => {
            const todayKey = new Date().toISOString().split('T')[0];
            const energyLevel = profile.dailyProgress?.[todayKey]?.energyLevel;
            return energyLevel !== undefined && energyLevel < 4;
          })() && (
            <div className="p-4 bg-orange-600/10 border border-orange-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 text-orange-400">
              <ShieldAlert size={18} className="shrink-0" />
              <p className="text-xs font-bold font-sans flex-1">طاقتك منخفضة النهاردة.. الذكاء الاصطناعي يقدر يحضّر لك جلسة استشفاء بديلة بدل التمرين الثقيل.</p>
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-orange-600/20"
              >
                <Heart size={12} /> اعرض جلسة استشفاء
              </button>
            </div>
          )}

          {/* Weekly mood / energy trend chart — gives the client (and the coach) a quick read on the week */}
          <MoodTrendChart dailyProgress={profile.dailyProgress as any} />

          {/* === Plan Actions: full-plan viewer + Arabic Cairo PDF export ===
              Buttons are gated by membership flags (packages.workout / packages.nutrition)
              so users only see what their package entitles them to. Visible whenever the
              coach has actually generated something (workout/nutrition/rehab/weeklyPlan). */}
          {(profile.plans?.weeklyPlan || profile.plans?.workout || profile.plans?.nutrition || profile.plans?.rehab) && (
            <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-blue-600/10 via-slate-900 to-emerald-600/10 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                  <FileText size={20} className="text-blue-400"/> الخطة المخصصة لك
                </h3>
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">CoachPro Plan</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {profile.plans?.weeklyPlan && (
                  <button
                    onClick={() => setViewingPlan('weekly')}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <Calendar size={16}/> عرض الخطة كاملة
                  </button>
                )}
                {profile.packages?.workout && profile.plans?.workout && (
                  <button
                    onClick={() => setViewingPlan('workout')}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-blue-500/20 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Dumbbell size={16}/> جدول التمارين
                  </button>
                )}
                {profile.packages?.nutrition && profile.plans?.nutrition && (
                  <button
                    onClick={() => setViewingPlan('nutrition')}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white border border-emerald-500/20 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Utensils size={16}/> نظام التغذية
                  </button>
                )}
                <button
                  onClick={generatePDF}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Download size={16}/> تصدير PDF عربي
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                ملف PDF مهني بخط Cairo العربي — يشمل التمارين، التغذية، طريقة الأداء، وإيقاع التنفس.
              </p>
            </div>
          )}
        </section>
        )}

        {activeTab === 'profile' && <Profile profile={profile} />}

        <div className="space-y-8">
          {activeTab === 'today' && (
            <div className="space-y-8">
              {/* AI Assistant Chat — single source of truth lives in the
                  dedicated "Chat" tab. The duplicate quick-ask card that
                  used to live here was removed (Apr 2026) after the audit
                  flagged it as redundant with the full Chat surface. */}
              <button
                onClick={() => setActiveTab('chat')}
                className="w-full rounded-[2.5rem] border app-border overflow-hidden bg-gradient-to-br from-blue-600/5 via-white dark:via-slate-900 to-purple-600/5 shadow-sm flex items-center justify-between p-5 sm:p-6 hover:border-blue-500/40 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                    <Bot size={22} className="text-white" />
                  </div>
                  <div className="text-start">
                    <h3 className="font-bold text-base app-text">{t('dashboard.aiChat')}</h3>
                    <p className="text-xs app-text-muted mt-0.5">{t('dashboard.aiChatDesc')}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 text-white">
                  <MessageSquare size={16} />
                </div>
              </button>
              <SmartwatchPanel profile={profile} />
              {/* Female-only cycle tracker — drives RPE adjustment in the
                  next plan generation and surfaces phase-specific tips. */}
              {profile.gender === 'female' && <PeriodTracker profile={profile} />}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Nutrition */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-green-400">
                    <Utensils size={24} /> وجبات النهاردة
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={handleGetGroceryList} className="p-2 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white" title="قائمة المشتريات"><Download size={18} /></button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {activeMealPlan ? (
                    <div className="rounded-[2rem] border border-cyan-500/20 bg-cyan-500/10 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{activeMealPlan.title}</p>
                          <p className="text-xs text-slate-400">Coach-managed meal plan • {activeMealPlan.completionPercent || 0}% complete</p>
                        </div>
                        <span className="rounded-full bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">{activeMealPlan.day}</span>
                      </div>
                      <div className="space-y-3">
                        {activeMealPlan.meals.map((meal: any, idx: number) => (
                          <div key={meal.id || idx} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{meal.name}</p>
                                <p className="text-xs text-slate-400">{meal.notes || meal.type || 'Meal'}</p>
                              </div>
                              <button onClick={() => void handleClientMealComplete(activeMealPlan, meal.id || '')} className={`rounded-full p-2 ${meal.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                                <Check size={16} />
                              </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span className="rounded-full border border-white/10 px-2 py-1">{meal.calories || 0} kcal</span>
                              <span className="rounded-full border border-white/10 px-2 py-1">{meal.protein || 0}g protein</span>
                              <span className="rounded-full border border-white/10 px-2 py-1">{meal.carbs || 0}g carbs</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {(profile.plans?.weeklyPlan?.[['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()] as keyof WeeklyPlan]?.nutrition || []).map((meal, idx) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isDone = profile.dailyProgress?.[todayStr]?.mealsCompleted?.includes(idx);
                    return (
                      <motion.div 
                        key={idx}
                        layout
                        className={`p-6 rounded-[2rem] border transition-all ${isDone ? 'bg-green-600/5 border-green-500/20' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg mb-1">{meal.name}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">{meal.items}</p>
                            <div className="flex flex-wrap gap-2">
                              <button 
                                onClick={() => handleGetSubstitutes(meal, idx)}
                                disabled={isAiLoading && substitutes?.mealIdx !== idx}
                                className="px-3 py-1.5 bg-blue-600/10 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/10 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                {isAiLoading && substitutes?.mealIdx !== idx && substitutes?.mealIdx !== -1 ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                                البدائل الذكية
                              </button>
                              <button 
                                onClick={() => handleGetBudgetSubstitutes(meal, idx)}
                                disabled={isAiLoading && budgetSubstitutes?.mealIdx !== idx}
                                className="px-3 py-1.5 bg-amber-600/10 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/10 hover:bg-amber-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                {isAiLoading && budgetSubstitutes?.mealIdx !== idx && budgetSubstitutes?.mealIdx !== -1 ? <RefreshCw size={10} className="animate-spin" /> : <Scale size={10} />}
                                البديل الاقتصادي
                              </button>
                            </div>

                            {/* Inline result: Smart substitutes for this meal */}
                            {substitutes?.mealIdx === idx && substitutes.list.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 p-3 rounded-2xl border border-blue-500/30 bg-blue-600/5 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">اقتراحات بدائل ذكية</p>
                                  <button onClick={() => setSubstitutes(null)} className="text-slate-500 hover:text-white"><X size={12} /></button>
                                </div>
                                <div className="space-y-1.5">
                                  {substitutes.list.map((sub, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 p-2 bg-slate-950/40 rounded-xl border border-white/5">
                                      <span className="text-[11px] text-slate-200 leading-relaxed flex-1">{sub}</span>
                                      <button
                                        onClick={() => handleApplySubstitute(idx, sub)}
                                        className="shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all"
                                      >
                                        طبّق
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}

                            {/* Inline result: Economic substitutes for this meal */}
                            {budgetSubstitutes?.mealIdx === idx && budgetSubstitutes.list.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 p-3 rounded-2xl border border-amber-500/30 bg-amber-600/5 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">بدائل اقتصادية أوفر</p>
                                  <button onClick={() => setBudgetSubstitutes(null)} className="text-slate-500 hover:text-white"><X size={12} /></button>
                                </div>
                                <div className="space-y-1.5">
                                  {budgetSubstitutes.list.map((sub, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 p-2 bg-slate-950/40 rounded-xl border border-white/5">
                                      <span className="text-[11px] text-slate-200 leading-relaxed flex-1">{sub}</span>
                                      <button
                                        onClick={() => handleApplySubstitute(idx, sub)}
                                        className="shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-lg transition-all"
                                      >
                                        طبّق
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                          <button 
                            onClick={() => handleToggleTask(idx, 'meal')}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDone ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-600'}`}
                          >
                            <Check size={24} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Workout */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-blue-400">
                    <Dumbbell size={24} /> تمارين النهاردة
                  </h3>
                  <button 
                    onClick={() => {
                      const text = "النهاردة جدولنا قوي يا بطل. مخصص ليك تمارين فعالة للوصول للهدف. ركز في التكنيك!";
                      speakInstructions(text); 
                    }}
                    className="p-2 bg-blue-600/10 text-blue-400 rounded-xl"
                  >
                    <Volume2 size={20} />
                  </button>
                </div>

                {profile.packages?.ems && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-6 bg-purple-600/10 border border-purple-500/20 rounded-[2rem] relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                      <Zap size={60} />
                    </div>
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <Activity className="text-purple-400 animate-pulse" />
                      <div>
                        <h4 className="font-bold text-purple-300">بروتوكول EMS الـ 20 دقيقة</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Advanced Pulse Logic</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                        <p className="text-[8px] text-slate-500 uppercase font-black mb-1">المدة</p>
                        <p className="text-xs text-white font-bold">20 دقيقة</p>
                      </div>
                      <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5">
                        <p className="text-[8px] text-slate-500 uppercase font-black mb-1">الإيقاع</p>
                        <p className="text-xs text-white font-bold">عمل / راحة بالتوازي</p>
                      </div>
                      <div className="col-span-2 p-3 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                        <p className="text-[9px] text-purple-300 font-bold mb-1">قبل الجلسة:</p>
                        <ul className="text-[10px] text-slate-400 space-y-1">
                          <li>• اشرب 500–750 مل ماء قبل الجلسة بساعتين.</li>
                          <li>• تنفّس بعمق وثبّت العضلة أثناء فترة الانكماش.</li>
                          <li>• استرخاء كامل في فترة الراحة.</li>
                        </ul>
                        <button
                          onClick={() => setShowEmsSafety(true)}
                          className="mt-2 w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 rounded-xl text-[11px] font-bold border border-purple-500/30 transition-all"
                        >
                          افتح قائمة التحقق قبل الجلسة
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div className="space-y-4">
                  {(profile.plans?.weeklyPlan?.[['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()] as keyof WeeklyPlan]?.workout || []).map((ex, idx) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isDone = profile.dailyProgress?.[todayStr]?.exercisesCompleted?.includes(idx);
                    return (
                      <motion.div 
                        key={idx}
                        layout
                        className={`p-6 rounded-[2rem] border transition-all ${isDone ? 'bg-blue-600/5 border-blue-500/20' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-lg">{ex.name}</h4>
                              <button onClick={() => speakInstructions(ex.name)} className="text-slate-600 hover:text-blue-400" aria-label="استمع لنطق التمرين"><Volume2 size={14}/></button>
                            </div>
                            <p className="text-sm text-blue-400 font-black tracking-widest">{ex.sets} {ex.reps ? `X ${ex.reps}` : ''}</p>
                            {(ex.pulseIntensity || ex.pulseProtocol) && (() => {
                              const v = toClientIntensity(ex.pulseIntensity, ex.pulseProtocol);
                              return (
                                <span className={`inline-block mt-1 px-2 py-1 rounded-lg text-[10px] font-black border ${v.intensityColorClass}`}>
                                  شدة: {v.intensityLabelAr}
                                </span>
                              );
                            })()}
                            {ex.description && <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{ex.description}</p>}

                            {/* Arabic technique block — replaces illustrations. Anti-hallucination rails:
                                only render what the AI actually returned in formCues / breathing. */}
                            {(ex.formCues?.length || ex.breathing) && (
                              <div className="mt-3 p-3 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2">
                                {ex.formCues && ex.formCues.length > 0 && (
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest font-black text-blue-400 mb-1">طريقة الأداء</p>
                                    <ol className="list-decimal pr-4 space-y-1 text-[11px] text-slate-300 leading-relaxed">
                                      {ex.formCues.map((cue, i) => (<li key={i}>{cue}</li>))}
                                    </ol>
                                  </div>
                                )}
                                {ex.breathing && (
                                  <div className="pt-2 border-t border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest font-black text-emerald-400 mb-1">إيقاع التنفس</p>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">{ex.breathing}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={() => { setSwapPrompt({ exIdx: idx, original: ex }); setSwapReason(''); }}
                                className="px-3 py-1.5 bg-orange-600/10 text-orange-400 rounded-full text-[10px] font-bold border border-orange-500/10 hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1.5"
                              >
                                <RefreshCw size={11} /> اطلب بديل ذكي
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleToggleTask(idx, 'exercise')}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDone ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}
                          >
                            <Check size={24} />
                          </button>
                        </div>

                        {/* Inline AI swap proposal — appears under the exercise that was being swapped */}
                        {swapProposal?.exIdx === idx && (
                          <div className="mt-4 p-4 rounded-2xl border border-orange-500/30 bg-orange-600/5">
                            <p className="text-[10px] uppercase tracking-widest text-orange-300 font-bold mb-2">اقتراح بديل ذكي</p>
                            <h5 className="text-base font-bold text-white">{swapProposal.replacement.name}</h5>
                            <p className="text-xs text-orange-200 font-bold mt-1">{swapProposal.replacement.sets} {swapProposal.replacement.reps ? `× ${swapProposal.replacement.reps}` : ''}</p>
                            {swapProposal.replacement.description && (
                              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{swapProposal.replacement.description}</p>
                            )}
                            <div className="flex gap-2 mt-3">
                              <button onClick={handleApplySwap} className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold rounded-xl transition-all">طبّق البديل</button>
                              <button onClick={() => setSwapProposal(null)} className="px-3 py-2 bg-slate-800 text-slate-400 text-[11px] font-bold rounded-xl hover:text-white transition-all">احتفظ بالأصلي</button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          )}

          {activeTab === 'today' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Workout Tracker</h3>
                    <p className="text-sm text-slate-400">Track the assigned workout, log weights, and mark exercises complete.</p>
                  </div>
                </div>

                {clientWorkouts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
                    Your coach has not assigned a workout yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientWorkouts.map((workout) => (
                      <div key={workout.id} className={`rounded-2xl border p-4 ${selectedClientWorkout?.id === workout.id ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 bg-slate-950/50'}`}>
                        <button onClick={() => setSelectedClientWorkout(workout)} className="mb-3 flex w-full items-center justify-between text-left">
                          <div>
                            <p className="font-semibold text-white">{workout.title}</p>
                            <p className="text-sm text-slate-400">{workout.day || 'Assigned'} • {workout.exercises?.length || 0} exercises</p>
                          </div>
                          <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">{workout.completionPercent || 0}%</div>
                        </button>
                        {selectedClientWorkout?.id === workout.id && (
                          <div className="space-y-3">
                            {selectedClientWorkout.exercises.map((exercise: any) => (
                              <div key={exercise.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-white">{exercise.name}</p>
                                    <p className="text-xs text-slate-400">{exercise.sets} × {exercise.reps}</p>
                                  </div>
                                  <button onClick={() => void handleClientExerciseComplete(exercise.id)} className={`rounded-full p-2 ${exercise.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                                    <Check size={16} />
                                  </button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <label className="text-sm text-slate-300">
                                    <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Performed Weight</span>
                                    <input value={exercise.performedWeight || ''} onChange={(event) => void handleClientExerciseField(exercise.id, 'performedWeight', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none" placeholder="e.g. 20kg" />
                                  </label>
                                  <label className="text-sm text-slate-300">
                                    <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Notes</span>
                                    <input value={exercise.notes || ''} onChange={(event) => void handleClientExerciseField(exercise.id, 'notes', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none" placeholder="How did it feel?" />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'weekly' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar ltr">
                {ARABIC_DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-8 py-4 rounded-2xl font-black transition-all shrink-0 border ${selectedDay === day ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/30' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'}`}
                  >
                    {ARABIC_DAY_NAMES[day]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Nutrition Panel */}
                <div className="bg-slate-900/50 border border-white/5 rounded-[3rem] p-8 space-y-6">
                  <h4 className="text-green-400 font-bold flex items-center gap-3">
                    <Utensils size={20} /> نظام التغذية لـ {ARABIC_DAY_NAMES[selectedDay]}
                  </h4>
                  <div className="space-y-4">
                    {(profile.plans?.weeklyPlan?.[selectedDay as keyof WeeklyPlan]?.nutrition || []).map((meal, idx) => (
                      <div key={idx} className="p-4 bg-slate-900 border border-white/5 rounded-2xl">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{idx === 0 ? 'Breakfast' : idx === 1 ? 'Lunch' : 'Dinner'}</span>
                        <h5 className="font-bold text-white mt-1">{meal.name}</h5>
                        <p className="text-xs text-slate-500 mt-1">{meal.items}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workout Panel */}
                <div className="bg-slate-900/50 border border-white/5 rounded-[3rem] p-8 space-y-6">
                  <h4 className="text-blue-400 font-bold flex items-center gap-3">
                    <Dumbbell size={20} /> نظام التمرين لـ {ARABIC_DAY_NAMES[selectedDay]}
                  </h4>
                  <div className="space-y-4">
                    {(profile.plans?.weeklyPlan?.[selectedDay as keyof WeeklyPlan]?.workout || []).map((ex, idx) => (
                      <div key={idx} className="p-4 bg-slate-900 border border-white/5 rounded-2xl">
                        <h5 className="font-bold text-white">{ex.name}</h5>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-blue-400 font-bold">{ex.sets} Sets</span>
                          <span className="text-xs text-slate-500">{ex.reps} Reps</span>
                        </div>
                      </div>
                    ))}
                    {((profile.plans?.weeklyPlan?.[selectedDay as keyof WeeklyPlan]?.workout?.length ?? 0) === 0) && (
                      <div className="h-40 flex flex-col items-center justify-center text-slate-600 border border-dashed border-white/10 rounded-2xl">
                        <Heart size={32} />
                        <p className="text-sm font-bold mt-2">يوم راحة واستشفاء</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Advanced Progress Analytics */}
                <div className="lg:col-span-2 bg-slate-900 border border-white/5 p-8 rounded-[3rem]">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold flex items-center gap-3 text-purple-400">
                      <Target size={24} /> تاريخ القياسات والتقييم البدني
                    </h3>
                  </div>
                  <div className="h-64 w-full mb-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={profile.measurementHistory || []}>
                        <defs>
                          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(str) => new Date(str).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} 
                          stroke="#64748b"
                          fontSize={10}
                        />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          labelFormatter={(str) => {
                            const rawValue = typeof str === 'string' || typeof str === 'number' ? str : '';
                            return rawValue ? new Date(rawValue).toLocaleDateString('ar-EG') : '';
                          }}
                        />
                        <Area type="monotone" dataKey="weight" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWeight)" strokeWidth={3} name="الوزن" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                       <Scale size={16} /> سجل التقييمات المخبرية (Performance History)
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {(profile.assessmentHistory || []).slice().reverse().map((ass, idx) => (
                        <div key={idx} className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 flex flex-wrap justify-between items-center gap-4 group hover:border-pink-500/30 transition-all">
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">{new Date(ass.date).toLocaleDateString('ar-EG')}</p>
                            <div className="flex gap-4">
                              <span className="text-xs font-bold text-white"><span className="text-pink-400">{ass.testName || 'اختبار'}:</span> {ass.value}</span>
                              {ass.estimated1RM && (
                                <span className="text-[10px] bg-blue-600/10 text-blue-400 px-2 rounded-full font-bold">1RM: {ass.estimated1RM}kg</span>
                              )}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-pink-600/10 rounded-lg border border-pink-500/20 text-pink-400 font-black text-xs uppercase tracking-tighter">
                             {ass.karvonenIntensity || 'Professional Tier'}
                          </div>
                        </div>
                      ))}
                      {(profile.assessmentHistory || []).length === 0 && (
                        <p className="text-xs text-slate-600 italic text-center py-6">لم يتم تسجيل اختبارات حمل بدني بعد.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Features Grid */}
                <div className="space-y-6">
                  <AICoachDashboard profile={profile} onExportPdf={generatePDF} />
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setShowSocialAI(true)}
                      className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex flex-col items-center gap-3 hover:border-pink-500/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-all">
                        <Heart size={24} />
                      </div>
                      <span className="text-xs font-bold">مساعد العزومات</span>
                    </button>
                    <label className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex flex-col items-center gap-3 hover:border-blue-500/30 transition-all group cursor-pointer">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Download className="rotate-180" size={24} />
                      </div>
                      <span className="text-xs font-bold">{isScanning ? 'جاري التحليل...' : 'ماسح الوجبات'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleMealScan} />
                    </label>
                    <button 
                      onClick={handleGetGroceryList}
                      className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex flex-col items-center gap-3 hover:border-green-500/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:bg-green-600 group-hover:text-white transition-all">
                        <Utensils size={24} />
                      </div>
                      <span className="text-xs font-bold">المشتريات</span>
                    </button>
                    <button 
                      onClick={() => setShowCertificate(true)}
                      className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex flex-col items-center gap-3 hover:border-yellow-500/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-600 group-hover:text-white transition-all">
                        <Target size={24} />
                      </div>
                      <span className="text-xs font-bold">الشهادات</span>
                    </button>
                  </div>

                  {/* Stress Alert Card */}
                  <div className="p-6 bg-slate-900 border border-orange-500/20 rounded-3xl relative overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                        <CircleAlert size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-orange-400">تقرير الاحتباس</h4>
                        <p className="text-[10px] text-slate-500">النظام اكتشف احتباس سوائل بسيط (InBody). اشرب بقدونس وقلل الملح.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'assessment' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <section className="bg-slate-900 border border-white/5 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-500"><Scale size={120} /></div>
                
                <div className="flex items-center gap-4 mb-10 relative z-10">
                  <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-600/30">
                    <Dumbbell size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">التقييم البدني الاحترافي</h3>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Physical & Scientific Assessment</p>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  {/* ─── ADAPTIVE TESTS PANEL (System-selected, safe-by-design) ─── */}
                  {adaptiveTests.length > 0 && (
                    <div className="bg-gradient-to-br from-emerald-500/5 via-blue-500/5 to-purple-500/5 backdrop-blur-md p-5 sm:p-7 rounded-[2.5rem] border border-emerald-500/20 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter mb-1">
                            Adaptive Testing System
                          </p>
                          <h4 className="text-lg sm:text-xl font-bold text-white">
                            اختباراتك المخصصة (يختارها النظام تلقائياً)
                          </h4>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            تم اختيار <strong className="text-emerald-300">{adaptiveTests.length}</strong> اختبار آمن بناءً على عمرك، مستواك، وحالتك الصحية. النتائج تذهب مباشرة للمحرك العلمي ومولّد البرامج.
                          </p>
                        </div>
                        <span className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black border whitespace-nowrap ${
                          adaptiveRiskLevel === 'high'
                            ? 'bg-red-500/15 text-red-300 border-red-400/30'
                            : adaptiveRiskLevel === 'medium'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                        }`}>
                          خطورة: {adaptiveRiskLevel === 'high' ? 'مرتفعة' : adaptiveRiskLevel === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </span>
                      </div>

                      {(Object.keys(adaptiveGroups) as TestCategory[]).map(cat => {
                        const items = adaptiveGroups[cat];
                        if (!items.length) return null;
                        return (
                          <div key={cat} className="space-y-3">
                            <h5 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {CATEGORY_NAMES[cat]} <span className="text-slate-500 font-bold text-xs">({items.length})</span>
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {items.map(test => (
                                <div key={test.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-white">{test.nameAr}</p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">{test.description}</p>
                                    </div>
                                  </div>
                                  <details className="text-[11px] text-slate-400">
                                    <summary className="cursor-pointer text-slate-300 font-bold hover:text-emerald-300">طريقة التنفيذ</summary>
                                    <p className="mt-1.5 leading-relaxed">{test.instructions}</p>
                                  </details>
                                  <div className="flex items-center gap-2 pt-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="any"
                                      placeholder={test.measurement}
                                      value={adaptiveInputs[test.id] ?? ''}
                                      onChange={e => setAdaptiveInputs(prev => ({ ...prev, [test.id]: e.target.value }))}
                                      className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono placeholder:text-slate-700"
                                    />
                                    {adaptiveInputs[test.id] && !isNaN(Number(adaptiveInputs[test.id])) && (
                                      <span className="px-2 py-1 bg-emerald-600/15 text-emerald-300 rounded-lg text-[10px] font-black border border-emerald-500/20 whitespace-nowrap">
                                        {scoreCategorizedTest(test, Number(adaptiveInputs[test.id]),
                                          profile.onboardingData?.age || 30,
                                          (profile.onboardingData?.gender || profile.gender || 'male') as 'male' | 'female')}
                                        /100
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={handleSaveAdaptive}
                        disabled={savingAdaptive || Object.keys(adaptiveInputs).length === 0}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        {savingAdaptive ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        إرسال نتائج الاختبارات للمحرك العلمي
                      </button>
                    </div>
                  )}

                  {profile.assessmentRequests?.filter(r => r.status === 'pending').map(request => (
                    <div key={request.id} className="bg-slate-800/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-blue-500/20 space-y-8 group hover:border-blue-500/40 transition-all">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">New Assignment Detected</p>
                          <h4 className="text-xl font-bold text-white">نموذج الاختبار: {request.templateName}</h4>
                        </div>
                        <div className="px-4 py-2 bg-blue-600/10 rounded-xl border border-blue-500/20 text-blue-400 font-black text-xs">
                           STATUS: ACTION REQUIRED
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {request.testNames.map(test => (
                          <div key={test} className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-black text-slate-300 uppercase tracking-wide">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {test}
                            </label>
                            <div className="relative">
                              <input 
                                type="text"
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono placeholder:text-slate-700"
                                placeholder={test.includes("1RM") ? "Weight:Reps (e.g. 100:5)" : "Enter Result"}
                                onChange={(e) => setAssessmentResults(prev => ({ ...prev, [test]: e.target.value }))}
                              />
                              {test.includes("1RM") && assessmentResults[test] && (assessmentResults[test] as string).includes(':') && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-black border border-blue-500/20">
                                  EST. 1RM: {aiMasterEngine.calculate1RM(
                                    Number((assessmentResults[test] as string).split(':')[0]),
                                    Number((assessmentResults[test] as string).split(':')[1])
                                  )}KG
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleCompleteAssessment(request.id)}
                        disabled={isAiLoading}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] font-black shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 text-lg group/btn"
                      >
                        {isAiLoading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={24} className="group-hover/btn:scale-110 transition-transform" />}
                        إرسال النتائج النهائية للكوتش
                      </button>
                    </div>
                  ))}

                  {profile.assessmentRequests?.filter(r => r.status === 'pending').length === 0 && (
                    <div className="p-16 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-slate-900/50">
                      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
                        <Clock size={40} />
                      </div>
                      <h4 className="text-2xl font-bold text-slate-400 mb-2">لا توجد اختبارات معلقة</h4>
                      <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">بطل! إنت مخلص كل مهامك.. الكوتش هيبعتلك اختبارات جديدة لما يحتاج يقيس تطورك.</p>
                      <button 
                        onClick={() => setActiveTab('analysis')}
                        className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all flex items-center gap-2 mx-auto"
                      >
                        عرض تحليلاتي السابقة <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Advanced History Section */}
              <section className="bg-slate-900 border border-white/5 rounded-[3rem] p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                    <Activity size={18} className="text-blue-500" /> Performance Archive
                  </h4>
                  <div className="px-3 py-1 bg-white/5 rounded-full text-[9px] text-slate-500 font-bold">Scientific Historical Data</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(profile.assessmentHistory || []).slice().reverse().map((ass, i) => (
                    <div key={`pro-hist-${i}`} className="p-6 bg-slate-800/20 rounded-[2rem] border border-white/5 flex justify-between items-center group hover:bg-slate-800/40 hover:border-blue-500/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                          <Target size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-0.5 font-bold">{new Date(ass.date).toLocaleDateString('ar-EG')}</p>
                          <h5 className="font-bold text-white flex items-center gap-2">
                            {ass.testName} <ArrowRight size={12} className="text-slate-600" /> <span className="text-blue-400">{ass.value}</span>
                          </h5>
                        </div>
                      </div>
                      {ass.estimated1RM && (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">1RM PROJECTION</p>
                          <p className="text-xl font-black text-blue-500">{ass.estimated1RM}<span className="text-xs ml-1">KG</span></p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
          {activeTab === 'injury' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <section className="bg-slate-900 border border-red-500/20 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-red-500"><Heart size={120} /></div>
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="w-14 h-14 bg-red-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-600/30">
                    <Heart size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">تقييم الإصابة والتأهيل</h3>
                    <p className="text-sm text-red-400 font-bold uppercase tracking-widest">Injury & Rehabilitation Assessment</p>
                  </div>
                </div>

                {rehabInjuryAreas.length > 0 && (
                  <div className="mb-6 flex flex-wrap gap-2 relative z-10">
                    <span className="text-xs text-slate-400 font-bold">مناطق الإصابة:</span>
                    {rehabInjuryAreas.map((area: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-red-500/15 border border-red-500/30 text-red-300 rounded-full text-xs font-bold">{area}</span>
                    ))}
                  </div>
                )}

                <p className="text-sm text-slate-400 mb-8 relative z-10 leading-relaxed">
                  اختبارات مصممة خصيصاً لتقييم حالتك وقياس تقدم التأهيل. النتائج تذهب للكوتش مباشرة.
                  أوقف الاختبار إذا كان الألم أكثر من <span className="text-red-400 font-bold">3/10</span>.
                </p>

                <div className="space-y-6 relative z-10">
                  {Object.entries(
                    rehabTests.reduce<Record<string, RehabTest[]>>((acc, t) => {
                      if (!acc[t.category]) acc[t.category] = [];
                      acc[t.category].push(t);
                      return acc;
                    }, {})
                  ).map(([cat, tests]) => (
                    <div key={cat} className="space-y-3">
                      <h5 className="text-sm font-black text-red-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        {REHAB_CATEGORY_NAMES[cat] || cat}
                        <span className="text-slate-500 font-bold text-xs">({tests.length})</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {tests.map(test => (
                          <div key={test.id} className="bg-slate-800/60 border border-white/5 rounded-2xl p-4 space-y-2">
                            <div>
                              <p className="text-sm font-bold text-white">{test.nameAr}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{test.description}</p>
                            </div>
                            <details className="text-[11px] text-slate-400">
                              <summary className="cursor-pointer text-slate-300 font-bold hover:text-red-300">طريقة التنفيذ</summary>
                              <p className="mt-1.5 leading-relaxed">{test.instructions}</p>
                            </details>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                placeholder={test.measurement}
                                value={rehabInputs[test.id] ?? ''}
                                onChange={e => setRehabInputs(prev => ({ ...prev, [test.id]: e.target.value }))}
                                className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-sm font-mono placeholder:text-slate-700"
                              />
                              <span className="text-[10px] text-slate-600 whitespace-nowrap">{test.measurement}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSaveRehab}
                    disabled={savingRehab || Object.keys(rehabInputs).length === 0}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    {savingRehab ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    إرسال نتائج التقييم للكوتش
                  </button>
                </div>
              </section>

              {/* Rehab History */}
              {(profile.assessmentHistory || []).some(a => rehabTests.some(rt => rt.nameAr === a.testName)) && (
                <section className="bg-slate-900 border border-white/5 rounded-[3rem] p-8 shadow-xl">
                  <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
                    <Activity size={18} className="text-red-500" /> سجل التقييمات السابقة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(profile.assessmentHistory || [])
                      .filter(a => rehabTests.some(rt => rt.nameAr === a.testName))
                      .slice().reverse().slice(0, 10)
                      .map((ass, i) => (
                        <div key={i} className="p-4 bg-slate-800/20 rounded-2xl border border-white/5 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-slate-500 mb-0.5 font-bold">{new Date(ass.date).toLocaleDateString('ar-EG')}</p>
                            <p className="font-bold text-white text-sm">{ass.testName}</p>
                          </div>
                          <span className="text-red-400 font-black">{ass.value} {(ass as any).unit || ''}</span>
                        </div>
                      ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {activeTab === 'falcon' && (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
              <FalconEye profile={profile} />
            </div>
          )}
          {activeTab === 'feed' && (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
              <ChampionsFeed profile={profile} />
            </div>
          )}
          {activeTab === 'chat' && (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
               <Chat 
                 currentUserId={profile.uid}
                 currentUserName={profile.name || profile.email || 'Client'}
                 targetUserId="admin" 
                 targetUserName="الكوتش لوطفي" 
                 isCoach={false} 
                 currentUserProfile={profile}
               />
            </div>
          )}
        </div>

        {/* Water Tracker - Sticky or prominent */}
        <section className="bg-slate-900 border border-white/5 p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-600/10 text-blue-400 rounded-3xl">
              <Droplets size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">متابعة شرب المياه</h3>
              <p className="text-sm text-slate-500">الهدف اليومي: {profile.nutritionSurveyData?.supplements?.waterLiters || 3} L</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-4xl font-black text-blue-500">
              {profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.waterLiters ?? 0}
              <span className="text-xs text-slate-500 ml-2 font-bold uppercase tracking-widest">Liters</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  const currentWater = profile.dailyProgress?.[today]?.waterLiters ?? 0;
                  const next = Math.max(0, +(currentWater - 0.5).toFixed(2));
                  const userRef = doc(db, 'users', profile.uid);
                  try {
                    await updateDoc(userRef, { [`dailyProgress.${today}.waterLiters`]: next });
                    await logClientActivity(profile.uid, profile.name || profile.email || 'Client', 'water', `سجّل ${next} لتر مياه اليوم`, { waterLiters: next });
                  } catch (err) {
                    console.error('Water decrement failed:', err);
                  }
                }}
                className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-all"
              >
                -
              </button>
              <button 
                onClick={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  const currentWater = profile.dailyProgress?.[today]?.waterLiters ?? 0;
                  const next = +(currentWater + 0.5).toFixed(2);
                  const userRef = doc(db, 'users', profile.uid);
                  try {
                    await updateDoc(userRef, { [`dailyProgress.${today}.waterLiters`]: next });
                    await logClientActivity(profile.uid, profile.name || profile.email || 'Client', 'water', `سجّل ${next} لتر مياه اليوم`, { waterLiters: next });
                    await awardCoins(profile.uid, 'WATER_INCREMENT');
                  } catch (err) {
                    console.error('Water increment failed:', err);
                  }
                }}
                className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg"
              >
                +
              </button>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {isFillingAssessment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFillingAssessment(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Scale className="text-blue-500" />
                  إدخال نتائج التقييم
                </h3>
                <button onClick={() => setIsFillingAssessment(null)} className="text-slate-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {profile.assessmentRequests?.find(r => r.id === isFillingAssessment)?.testNames.map(test => (
                  <div key={test} className="space-y-2">
                    <label className="block text-sm font-bold text-slate-400">{test}</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-mono"
                      placeholder={test.includes("1RM") ? "أدخل الوزن:التكرارات (مثال: 100:5)" : "أدخل النتيجة النهائية"}
                      onChange={(e) => setAssessmentResults(prev => ({ ...prev, [test]: e.target.value }))}
                    />
                    {test.includes("1RM") && assessmentResults[test] && typeof assessmentResults[test] === 'string' && (assessmentResults[test] as string).includes(':') && (
                      <p className="text-[10px] text-blue-400 font-bold">
                        الـ 1RM المتوقع: {aiMasterEngine.calculate1RM(
                          Number((assessmentResults[test] as string).split(':')[0]),
                          Number((assessmentResults[test] as string).split(':')[1])
                        )} كجم (Brzycki Method)
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-10 flex gap-4">
                  <button
                    onClick={() => handleCompleteAssessment(isFillingAssessment)}
                    disabled={isAiLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isAiLoading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={20} />}
                    إرسال النتائج النهائية للكوتش
                  </button>
                <button
                  onClick={() => setIsFillingAssessment(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals & AI Helpers */}
      <AnimatePresence>
        {showFridgeScanner && (
          <FridgeScanner profile={profile} onClose={() => setShowFridgeScanner(false)} />
        )}
        {showEmsSafety && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowEmsSafety(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-purple-950 via-slate-950 to-slate-950 border border-purple-500/30 rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-[10px] text-purple-400 font-black uppercase tracking-tighter mb-1">EMS Safety</p>
                  <h3 className="text-xl font-black text-white">قائمة التحقق قبل جلسة EMS</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    أكّد كل بند قبل بدء الجلسة لضمان السلامة وأقصى استفادة.
                  </p>
                </div>
                <button onClick={() => setShowEmsSafety(false)} className="text-slate-500 hover:text-white shrink-0">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2.5">
                {EMS_PRE_SESSION_CHECKLIST.map(item => {
                  const checked = !!emsCheckedItems[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setEmsCheckedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className={`w-full text-right p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                        checked
                          ? 'bg-emerald-600/15 border-emerald-500/30'
                          : 'bg-slate-900/60 border-white/5 hover:border-purple-500/30'
                      }`}
                    >
                      <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border ${
                        checked ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-white/10'
                      }`}>
                        {checked && <Check size={14} className="text-white" />}
                      </div>
                      <p className={`text-xs leading-relaxed flex-1 ${checked ? 'text-emerald-200' : 'text-slate-300'}`}>
                        {item.ar}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <p className="text-[11px] text-amber-200 leading-relaxed">
                  <strong>تنبيه:</strong> إذا لم تستوفِ كل البنود، أجّل الجلسة. EMS بيحتاج جسم متعاف ومتروي.
                </p>
              </div>

              <button
                onClick={() => setShowEmsSafety(false)}
                disabled={EMS_PRE_SESSION_CHECKLIST.some(i => !emsCheckedItems[i.id])}
                className="mt-5 w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-2xl font-black transition-all"
              >
                {EMS_PRE_SESSION_CHECKLIST.every(i => emsCheckedItems[i.id])
                  ? 'جاهز — ابدأ الجلسة'
                  : `أكّد كل البنود (${Object.values(emsCheckedItems).filter(Boolean).length}/${EMS_PRE_SESSION_CHECKLIST.length})`}
              </button>
            </motion.div>
          </motion.div>
        )}
        {showMeasurementUpdate && (
          <MeasurementUpdate
            userId={profile.uid}
            mandatory={needsMeasurementUpdate()}
            onComplete={async () => {
              awardCoins(profile.uid, 'MEASUREMENT_UPDATED').catch(() => {});

              // ─── STEP 9: extend the existing plan by +5% intensity ──────
              // The 14-day lockdown was unlocked. Instead of regenerating
              // the plan from scratch (which loses continuity), apply the
              // Progressive Overload rule from scientificEngine to the
              // current weeklyPlan. The coach can override later from the
              // admin dashboard.
              try {
                const wp: any = profile.plans?.weeklyPlan;
                if (wp && Array.isArray(wp.days)) {
                  // Detect status from the latest two measurements: weight
                  // moving toward goal = improved; weight stuck/regressing
                  // with high stress signals = fatigued; otherwise neutral.
                  const hist = profile.measurementHistory || [];
                  const last = hist[hist.length - 1];
                  const prev = hist[hist.length - 2];
                  let status: 'improved' | 'fatigued' | 'neutral' = 'neutral';
                  if (last && prev && typeof last.weight === 'number' && typeof prev.weight === 'number') {
                    const goal = (profile.onboardingData?.goal || 'shape');
                    const delta = last.weight - prev.weight;
                    if (goal === 'loss' && delta < -0.3) status = 'improved';
                    else if (goal === 'bulk' && delta > 0.3) status = 'improved';
                    else if (Math.abs(delta) < 0.2) status = 'neutral';
                  }

                  // Walk every exercise and bump the load via progressLoad.
                  // We treat `weight` as load and `sets` as volume.
                  const extendedDays = wp.days.map((d: any) => ({
                    ...d,
                    exercises: Array.isArray(d.exercises)
                      ? d.exercises.map((ex: any) => {
                          const prevLoad = Number(ex.weight) || 0;
                          const prevVol = Number(ex.sets) || 3;
                          if (prevLoad <= 0) return ex; // bodyweight — leave it
                          const next = progressLoad(prevLoad, prevVol, status);
                          return { ...ex, weight: next.newLoad, sets: Math.max(1, Math.round(next.newVolume)) };
                        })
                      : d.exercises,
                  }));

                  const cycleNumber = ((wp.cycleNumber as number | undefined) || 1) + 1;
                  await updateDoc(doc(db, 'users', profile.uid), {
                    'plans.weeklyPlan': {
                      ...wp,
                      days: extendedDays,
                      cycleNumber,
                      extendedAt: new Date().toISOString(),
                      progressionStatus: status,
                    },
                  });
                }
              } catch (err) {
                console.error('[Step9] failed to extend plan:', err);
              }

              setShowMeasurementUpdate(false);
              window.location.reload();
            }}
            onCancel={() => {
              // When the update is mandatory the cancel button is hidden in
              // the modal, but defend against any escape route here too.
              if (!needsMeasurementUpdate()) setShowMeasurementUpdate(false);
            }}
          />
        )}
        {showProgressUpdate && (
          <ProgressUpdate
            profile={profile}
            onClose={() => setShowProgressUpdate(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPlan(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  {viewingPlan === 'workout' ? <Dumbbell className="text-blue-500" /> : 
                   viewingPlan === 'nutrition' ? <Utensils className="text-green-500" /> : 
                   <Heart className="text-red-500" />}
                  {viewingPlan === 'workout' ? 'جدول التمارين المخصص' : 
                   viewingPlan === 'nutrition' ? 'نظام التغذية المخصص' : 
                   'برنامج التأهيل البدني'}
                </h3>
                <button onClick={() => setViewingPlan(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors" title="رجوع">
                  <ArrowRight className="text-slate-500" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {profile.plans?.[viewingPlan as 'workout' | 'nutrition' | 'rehab'] ? (
                  <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 whitespace-pre-wrap leading-relaxed text-slate-200">
                    {profile.plans[viewingPlan as 'workout' | 'nutrition' | 'rehab']}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-600">
                      <Clock size={40} />
                    </div>
                    <p className="text-slate-400 font-medium">جاري تجهيز خطتك من قبل الكوتش... ستظهر هنا قريباً!</p>
                  </div>
                )}

                {profile.plans?.pdfUrl && (
                  <div className="mt-6">
                    <a 
                      href={profile.plans.pdfUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-3 p-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-bold transition-all border border-red-500/20"
                    >
                      <Download size={20} />
                      تحميل ملف الكوتش المرفق (PDF)
                    </a>
                  </div>
                )}
                
                <button 
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-2xl font-bold transition-all border border-blue-500/20 mt-4 disabled:opacity-50"
                >
                  <Download size={20} className={isGeneratingPDF ? "animate-spin" : ""} />
                  {isGeneratingPDF ? 'جاري التوليد...' : 'تحميل تقرير الخطة الذكي (PDF)'}
                </button>
              </div>

              <button 
                onClick={() => setViewingPlan(null)}
                className="w-full mt-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}

        {viewingPlan === 'weekly' && profile.plans?.weeklyPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPlan(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-4xl bg-slate-900 h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem] border border-white/10 flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Calendar className="text-blue-500" />
                  <h3 className="text-xl font-bold">الجدول الأسبوعي</h3>
                </div>
                <button onClick={() => setViewingPlan(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <div className="flex overflow-x-auto p-4 gap-3 bg-slate-800/20 border-b border-white/5 shrink-0 no-scrollbar ltr">
                {ARABIC_DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-6 py-3 rounded-2xl font-bold transition-all shrink-0 border ${
                      selectedDay === day 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-slate-800 border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {ARABIC_DAY_NAMES[day]}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="text-blue-500" />
                        <div>
                          <h4 className="font-bold">إنجاز اليوم</h4>
                          <p className="text-xs text-slate-500">استمر لتحقيق الهدف!</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={handlePredict}
                          className="flex flex-col items-center gap-1 group"
                          title="توقعات النتائج الذكية"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                            <Activity size={18} className="text-purple-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] text-slate-400">توقعاتي</span>
                        </button>
                        <button 
                          onClick={() => {
                            const text = `أهلاً بك يا بطل. مجهودك اليوم رائع، التزامك بالأمس كان بنسبة ${dailyProgress}%. تنبؤات الجهاز تشير إلى وصولك للهدف في غضون 3 أسابيع إذا استمريت بنفس القوة!`;
                            speakInstructions(text);
                          }}
                          className="flex flex-col items-center gap-1 group"
                          title="المساعد الصوتي الذكي"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <Volume2 size={18} className="text-blue-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] text-slate-400">فويس</span>
                        </button>
                        <button 
                          onClick={() => setShowSocialAI(true)}
                          className="flex flex-col items-center gap-1 group"
                          title="المساعد الاجتماعي (عزومات/مطاعم)"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-pink-600 transition-colors">
                            <Heart size={18} className="text-pink-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] text-slate-400">عزومات</span>
                        </button>
                        <button 
                          onClick={handleGetGroceryList}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <Utensils size={18} className="text-blue-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] text-slate-400">المشتريات</span>
                        </button>
                        <button 
                          onClick={() => setShowCertificate(true)}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-yellow-600 transition-colors">
                            <Target size={18} className="text-yellow-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] text-slate-400">الشهادات</span>
                        </button>
                        <div className="text-2xl font-black text-blue-500 ml-4">{dailyProgress}%</div>
                      </div>
                    </div>

                    {/* Fluid Retention Alert */}
                    {(() => {
                      const latest = profile.measurementHistory?.[profile.measurementHistory.length - 1];
                      if (latest && (latest.waterPercentage || 0) > 65) {
                        return (
                          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-3xl flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
                              <Droplets className="text-orange-500" size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-orange-400">تنبيه: ملاحظة احتباس سوائل</h4>
                              <p className="text-[10px] text-slate-400 leading-tight">نسبة المياه مرتفعة (${latest.waterPercentage}%). اشرب مياه بقدونس وقلل الأملاح.</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="font-bold flex items-center justify-between gap-2 text-green-400 uppercase tracking-widest text-sm">
                          <div className="flex items-center gap-2">
                            <Utensils size={18} /> نظام التغذية
                          </div>
                          <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-[10px] flex items-center gap-1 transition-all">
                            <Download size={12} className="rotate-180" /> 
                            {isScanning ? 'جاري التحليل...' : 'Meal Scanner'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleMealScan} />
                          </label>
                        </h4>

                        {scanResult && (
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="p-4 bg-slate-800 border-2 border-blue-500/30 rounded-3xl relative"
                          >
                            <button onClick={() => setScanResult(null)} className="absolute top-2 right-2 text-slate-500"><X size={14}/></button>
                            <h5 className="text-[10px] font-bold text-blue-400 mb-2">نتائج المسح الضوئي للوجبة</h5>
                            <div className="text-xs prose prose-invert max-w-none">
                              <Markdown>{scanResult}</Markdown>
                            </div>
                          </motion.div>
                        )}
                        <div className="space-y-4">
                          {(profile.plans.weeklyPlan[selectedDay as keyof WeeklyPlan]?.nutrition || []).map((meal: Meal, idx: number) => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            const isDone = profile.dailyProgress?.[todayStr]?.mealsCompleted?.includes(idx);
                            return (
                              <div key={`meal-${selectedDay}-${idx}`} className={`p-5 rounded-3xl border transition-all ${isDone ? 'bg-green-600/10 border-green-500/30' : 'bg-slate-800 border-white/5'}`}>
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <h5 className="font-bold text-white">{meal.name}</h5>
                                      <div className="flex gap-1">
                                        <button 
                                          onClick={() => handleGetSubstitutes(meal, idx)}
                                          className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1"
                                        >
                                          <Zap size={8} /> البدائل
                                        </button>
                                        <button 
                                          onClick={() => handleGetBudgetSubstitutes(meal, idx)}
                                          className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1"
                                        >
                                          <Scale size={8} /> بدائل أوفر
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed ltr">{meal.items}</p>
                                  </div>
                                  <button 
                                    onClick={() => handleToggleTask(idx, 'meal')}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${isDone ? 'bg-green-500 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                                  >
                                    <Check size={18} />
                                  </button>
                                </div>
                                
                                {substitutes?.mealIdx === idx && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-[10px] font-bold text-blue-400 uppercase">اقتراحات البدائل الذكية</span>
                                      <button onClick={() => setSubstitutes(null)}><X size={12} className="text-slate-500" /></button>
                                    </div>
                                    <div className="space-y-2">
                                      {substitutes.list.map((sub, sidx) => (
                                        <div key={sidx} className="text-xs text-slate-300 flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 group">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                                            {sub}
                                          </div>
                                          <button 
                                            onClick={() => handleApplySubstitute(substitutes.mealIdx!, sub)}
                                            className="text-[8px] bg-blue-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all font-bold"
                                          >
                                            تطبيق البديل
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}

                                {budgetSubstitutes?.mealIdx === idx && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-[10px] font-bold text-amber-400 uppercase">بدائل اقتصادية (أوفر)</span>
                                      <button onClick={() => setBudgetSubstitutes(null)}><X size={12} className="text-slate-500" /></button>
                                    </div>
                                    <div className="space-y-2">
                                      {budgetSubstitutes.list.map((sub, sidx) => (
                                        <div key={sidx} className="text-xs text-slate-300 flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 group">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-amber-500" />
                                            {sub}
                                          </div>
                                          <button 
                                            onClick={() => handleApplySubstitute(budgetSubstitutes.mealIdx!, sub)}
                                            className="text-[8px] bg-amber-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all font-bold"
                                          >
                                            تطبيق البديل
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                            {meal.method && (
                              <div className="mt-3 p-3 bg-black/20 rounded-xl">
                                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">طريقة التحضير</p>
                                <p className="text-[11px] text-slate-300 italic">{meal.method}</p>
                              </div>
                            )}
                            <div className="mt-3 flex gap-3">
                              {meal.calories && <span className="text-[10px] bg-slate-900 px-2 py-1 rounded-md text-slate-400">Calories: {meal.calories}</span>}
                              {meal.protein && <span className="text-[10px] bg-slate-900 px-2 py-1 rounded-md text-slate-400">P: {meal.protein}g</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-bold flex items-center justify-between gap-2 text-blue-400 uppercase tracking-widest text-sm">
                      <div className="flex items-center gap-2">
                        <Dumbbell size={18} /> التمارين اليومية
                      </div>
                      <button 
                        onClick={() => {
                          const text = (profile.plans?.weeklyPlan?.[selectedDay as keyof WeeklyPlan]?.workout || [])
                            .map(e => e.name)
                            .join(', ') || 'يوم راحة';
                          const utterance = new SpeechSynthesisUtterance(`يا بطل، النهاردة عندنا ${text}. ركز في التنفس وفاضل تكه على الهدف!`);
                          utterance.lang = 'ar-EG';
                          window.speechSynthesis.speak(utterance);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-[10px] flex items-center gap-1 transition-all text-blue-400"
                      >
                        <Activity size={12} /> توجيه صوتي
                      </button>
                    </h4>
                    <div className="space-y-4">
                      {(profile.plans.weeklyPlan[selectedDay as keyof WeeklyPlan]?.workout || []).map((ex: Exercise, idx: number) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const isDone = profile.dailyProgress?.[todayStr]?.exercisesCompleted?.includes(idx);
                        return (
                          <div key={`workout-${selectedDay}-${idx}`} className={`p-5 rounded-3xl border transition-all ${isDone ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-800 border-white/5'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex gap-4 flex-1">
                                <div className="w-12 h-12 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-center text-blue-500 shrink-0">
                                  <Dumbbell size={20} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-bold text-white">{ex.name}</h5>
                                    <button 
                                      onClick={() => speakInstructions(`تمرين ${ex.name}. ${ex.sets} مجموعات. ${ex.description || 'ركز في الأداء.'}`)}
                                      className="text-blue-400 hover:text-white transition-colors"
                                    >
                                      <Volume2 size={14} />
                                    </button>
                                  </div>
                                  <div className="flex gap-2 text-[10px] items-center">
                                    <span className="text-blue-400 font-black">{ex.sets} {ex.reps ? `x ${ex.reps}` : ''}</span>
                                    {ex.weight && <span className="text-slate-500">Weight: {ex.weight}</span>}
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleToggleTask(idx, 'exercise')}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${isDone ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                              >
                                <Check size={18} />
                              </button>
                            </div>

                            {(ex.pulseIntensity || ex.pulseProtocol) && (() => {
                              const v = toClientIntensity(ex.pulseIntensity, ex.pulseProtocol);
                              return (
                                <div className={`mb-4 p-3 rounded-xl border ${v.intensityColorClass}`}>
                                  <p className="text-[9px] uppercase font-black opacity-70">شدة الجلسة</p>
                                  <p className="text-sm font-black">{v.intensityLabelAr}</p>
                                  <p className="text-[10px] mt-1 opacity-90 leading-relaxed">{v.cueAr}</p>
                                </div>
                              );
                            })()}

                            {ex.description && (
                              <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-blue-500/30 pl-3">
                                {ex.description}
                                {ex.bodyPosition && <span className="block mt-1 font-bold text-blue-200/50">الوضعية: {ex.bodyPosition}</span>}
                              </p>
                            )}

                            {/* Arabic technique + breathing block (replaces illustrations). */}
                            {(ex.formCues?.length || ex.breathing) && (
                              <div className="mt-3 p-3 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2">
                                {ex.formCues && ex.formCues.length > 0 && (
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest font-black text-blue-400 mb-1">طريقة الأداء</p>
                                    <ol className="list-decimal pr-4 space-y-1 text-[11px] text-slate-300 leading-relaxed">
                                      {ex.formCues.map((cue, i) => (<li key={i}>{cue}</li>))}
                                    </ol>
                                  </div>
                                )}
                                {ex.breathing && (
                                  <div className="pt-2 border-t border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest font-black text-emerald-400 mb-1">إيقاع التنفس</p>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">{ex.breathing}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-900 border-t border-white/5 flex gap-4 shrink-0 ltr">
                <button 
                  onClick={generatePDF}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Generate PDF
                </button>
                <button 
                  onClick={() => setViewingPlan(null)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grocery List Modal */}
      <AnimatePresence>
        {groceryList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <Utensils className="text-blue-500" />
                  <h3 className="text-2xl font-black">قائمة المشتريات الأسبوعية</h3>
                </div>
                <button 
                  onClick={() => setGroceryList(null)}
                  className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                  <X />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar prose prose-invert max-w-none">
                <Markdown>{groceryList}</Markdown>
              </div>
              <div className="p-6 bg-slate-800/50 border-t border-white/10 flex gap-4 ltr">
                 <button onClick={() => setGroceryList(null)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Achievement Certificate Modal */}
      <AnimatePresence>
        {showCertificate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-gradient-to-br from-yellow-600 via-yellow-700 to-yellow-900 p-1 rounded-[40px] w-full max-w-3xl aspect-[1.4/1] shadow-[0_0_100px_rgba(234,179,8,0.3)]"
            >
              <div className="bg-slate-950 w-full h-full rounded-[38px] p-12 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden text-center">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-[100px] -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] -ml-32 -mb-32" />
                
                <div className="w-24 h-24 mb-6 rounded-3xl bg-yellow-500 flex items-center justify-center shadow-lg transform rotate-12">
                  <Target size={48} className="text-black" />
                </div>
                
                <h2 className="text-5xl font-black mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">شهادة إنجاز</h2>
                <p className="text-slate-400 mb-8 uppercase tracking-[0.2em] font-bold">Certificate of Achievement</p>
                
                <div className="space-y-4 mb-12">
                  <p className="text-xl text-slate-300">يتقدم كوتش برو و AI Engine بتهنئة البطل:</p>
                  <p className="text-4xl font-black text-white">{profile.name}</p>
                  <p className="text-xl text-slate-300">على وصوله لهدفه وتحقيق التزام أسطوري!</p>
                </div>
                
                <div className="flex gap-4 w-full max-w-sm">
                  <button onClick={() => setShowCertificate(false)} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all">إغلاق</button>
                  <button className="flex-1 py-4 bg-yellow-600 text-black rounded-2xl font-bold hover:bg-yellow-500 transition-all">حفظ الصورة</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Prediction Modal */}
      <AnimatePresence>
        {prediction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-purple-600/20">
                <div className="flex items-center gap-3">
                  <Activity className="text-purple-400" />
                  <h3 className="text-2xl font-black">توقعات النتائج الذكية</h3>
                </div>
                <button onClick={() => setPrediction(null)} className="text-slate-400 hover:text-white"><X /></button>
              </div>
              <div className="p-8 prose prose-invert max-w-none">
                <Markdown>{prediction}</Markdown>
              </div>
              <div className="p-6 border-t border-white/5 ltr">
                <button onClick={() => setPrediction(null)} className="w-full py-3 bg-purple-600 rounded-xl font-bold">إغلاق التقرير</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Social AI Modal */}
      <AnimatePresence>
        {showSocialAI && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-pink-600/20">
                <div className="flex items-center gap-3">
                  <Heart className="text-pink-400" />
                  <h3 className="text-2xl font-black">مساعد العزومات والمطاعم</h3>
                </div>
                <button onClick={() => setShowSocialAI(false)} className="text-slate-400 hover:text-white"><X /></button>
              </div>
              <div className="p-8 space-y-6">
                {!socialAdvice ? (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">رايح فين النهارده؟ واحنا هنقولك تاكل إيه وتعمل إيه في باقي يومك!</p>
                    <div className="grid grid-cols-2 gap-3">
                      {['فرح/مناسبة', 'مطعم مشويات', 'مطعم إيطالي', 'عزومة بيت', 'أكل سريع', 'خروجة قهوة'].map(type => (
                        <button 
                          key={type}
                          onClick={() => handleGetSocialAdvice(type, 'عام')}
                          className="p-3 bg-slate-800 hover:bg-pink-600/20 border border-white/5 rounded-xl text-xs font-bold transition-all"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none border-2 border-pink-500/20 p-4 rounded-2xl bg-pink-500/5">
                    <Markdown>{socialAdvice}</Markdown>
                    <button 
                      onClick={() => setSocialAdvice(null)}
                      className="mt-4 text-xs font-bold text-pink-400 underline underline-offset-4"
                    >
                      تجربة نوع خروجة تاني
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Instant Assistant — floating quick-question bot */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {chatAnswer === null && !isAiLoading && (
          <span className="text-[10px] font-bold bg-slate-900/90 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-full shadow-lg">
            مساعدك الذكي ✨
          </span>
        )}
        <button
          onClick={() => setChatAnswer(chatAnswer === null ? '' : null)}
          className="w-16 h-16 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
          aria-label="افتح المساعد الذكي"
        >
          <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-10 transition-opacity" />
          {isAiLoading ? (
            <Activity className="animate-spin" />
          ) : (
            <MessageCircle size={28} />
          )}
        </button>
      </div>

      {/* AI Chat Modal */}
      <AnimatePresence>
        {(chatAnswer !== null || isAiLoading) && (
          <div className="fixed bottom-24 right-6 z-50 w-80 max-w-[90vw]">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 bg-blue-600 flex justify-between items-center leading-none">
                <span className="font-bold text-white text-sm">مساعدك الذكي</span>
                <button onClick={() => { setChatAnswer(null); setIsAiLoading(false); }} className="text-white/80 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                {chatAnswer && (
                  <div className="bg-slate-800 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed">
                    {chatAnswer}
                  </div>
                )}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    placeholder="سؤال سريع عن تمرينك..."
                    className="flex-1 bg-slate-800 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAskBot()}
                  />
                  <button 
                    onClick={handleAskBot}
                    disabled={isAiLoading}
                    className="bg-blue-600 p-2 rounded-xl text-white disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Celebration Popup */}
      <CelebrationPopup
        show={showCelebration}
        onClose={() => setShowCelebration(false)}
        profilePicUrl={profile.profilePicUrl}
        name={profile.name}
        message={celebrationMsg || t('celebration.hero')}
        subMessage={t('celebration.login')}
      />

      {/* Hidden PDF Template (English static labels, dynamic content preserved) */}
      <div 
        id="pdf-template" 
        dir="ltr"
        style={{ 
          position: 'fixed', 
          left: '-2000px', 
          top: 0, 
          width: '800px', 
          backgroundColor: '#020617', 
          padding: '40px', 
          color: '#ffffff', 
          fontFamily: '"Cairo", sans-serif' 
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: '#2563eb', padding: '12px', borderRadius: '16px' }}>
              <Activity size={32} />
            </div>
            <div>
              <h1 style={{ fontSize: '30px', fontWeight: '900', margin: 0 }}>COACH PRO</h1>
              <p style={{ color: '#60a5fa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '12px', margin: 0 }}>Client Integrated Plan</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Date: {new Date().toLocaleDateString('en-GB')}</p>
            <p style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px', margin: '4px 0 0' }}>{profile.name}</p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Goal: {profile.onboardingData?.goal || 'Fitness'}</p>
          </div>
        </div>

        {/* Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px' }}>
            <p style={{ color: '#60a5fa', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Important Notice</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
              This plan is an advisory document. Consult your coach if you experience unusual pain or fatigue.
            </p>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px' }}>
            <p style={{ color: '#4ade80', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Daily Water Target</p>
            <p style={{ fontSize: '22px', color: '#ffffff', fontWeight: '900', margin: 0 }}>
              {profile.nutritionSurveyData?.supplements?.waterLiters || 3} <span style={{ fontSize: '13px', color: '#4ade80' }}>Liters</span>
            </p>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px' }}>
            <p style={{ color: '#f59e0b', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Active Packages</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
              {[profile.packages?.workout && 'Workout', profile.packages?.nutrition && 'Nutrition', profile.packages?.rehab && 'Rehab', profile.packages?.ems && 'EMS'].filter(Boolean).join(' · ') || 'Standard'}
            </p>
          </div>
        </div>

        {/* Weekly Plan Days */}
        {ARABIC_DAYS.map((dayKey) => {
          const dayPlan = profile.plans?.weeklyPlan?.[dayKey as keyof WeeklyPlan];
          if (!dayPlan || (dayPlan.nutrition.length === 0 && dayPlan.workout.length === 0)) return null;
          
          return (
            <div key={dayKey} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ height: '32px', width: '6px', backgroundColor: '#2563eb', borderRadius: '9999px' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', backgroundColor: '#0f172a', padding: '6px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)', margin: 0, color: '#fff' }}>
                    {dayKey}
                  </h2>
                  <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>
                    {ARABIC_DAY_NAMES[dayKey]}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Nutrition column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ color: '#4ade80', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' }}>
                    <Utensils size={13} /> Nutrition
                  </h4>
                  {dayPlan.nutrition.map((meal, i) => (
                    <div key={i} style={{ padding: '14px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <h5 style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '13px', margin: 0 }}>{meal.name}</h5>
                        {meal.calories && <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 'bold' }}>{meal.calories} kcal</span>}
                      </div>
                      <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '0', lineHeight: '1.6', margin: 0 }}>{meal.items}</p>
                      {meal.method && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <p style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 'bold', margin: '0 0 2px' }}>Preparation:</p>
                          <p style={{ fontSize: '10px', color: '#cbd5e1', fontStyle: 'italic', margin: 0 }}>{meal.method}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Workout column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' }}>
                    <Dumbbell size={13} /> Workout
                  </h4>
                  {dayPlan.workout.map((ex, i) => (
                    <div key={i} style={{ padding: '14px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <h5 style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '13px', margin: 0 }}>{ex.name}</h5>
                        <span style={{ fontSize: '10px', backgroundColor: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '8px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {ex.sets} Sets × {ex.reps}
                        </span>
                      </div>
                      {ex.weight && Number(ex.weight) > 0 && (
                        <p style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 'bold', margin: '0 0 4px' }}>Load: {ex.weight} kg</p>
                      )}
                      {(ex.pulseIntensity || ex.pulseProtocol) && (() => {
                        const v = toClientIntensity(ex.pulseIntensity, ex.pulseProtocol);
                        return (
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '9px', backgroundColor: 'rgba(147,51,234,0.2)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px' }}>شدة: {v.intensityLabelAr}</span>
                          </div>
                        );
                      })()}
                      {ex.description && <p style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.5', fontStyle: 'italic', margin: 0 }}>{ex.description}</p>}
                    </div>
                  ))}
                  {dayPlan.workout.length === 0 && (
                    <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>Rest & Recovery Day</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ marginTop: '60px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Powered by CoachPro — Lotfy EMS & Personal Training</p>
            <p style={{ color: '#475569', fontSize: '10px', margin: '2px 0 0' }}>Generated: {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <p style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>Consistency is the secret to success! 💪</p>
        </div>
      </div>

      {/* Energy-aware recovery session modal — opened from the orange "low energy" banner */}
      <RecoveryWorkoutModal
        open={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        profile={profile}
        energy={profile.dailyProgress?.[new Date().toISOString().split('T')[0]]?.energyLevel ?? 0}
      />

      {/* Flexible Modifications — exercise-swap prompt modal */}
      <AnimatePresence>
        {swapPrompt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              dir="rtl"
            >
              <div className="p-5 bg-orange-600 flex justify-between items-center">
                <span className="font-bold text-white text-sm flex items-center gap-2"><RefreshCw size={16} /> طلب بديل ذكي</span>
                <button onClick={() => { setSwapPrompt(null); setSwapReason(''); }} className="text-white/80 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">التمرين الأصلي</p>
                  <p className="text-base font-bold text-white">{swapPrompt.original.name}</p>
                  <p className="text-xs text-blue-400 font-bold mt-1">{swapPrompt.original.sets} {swapPrompt.original.reps ? `× ${swapPrompt.original.reps}` : ''}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">ليه عايز تبدله؟ (اختياري)</label>
                  <textarea
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    placeholder="مثال: مفيش عندي بار في البيت، أو الركبة وجعتني..."
                    rows={3}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">الذكاء الاصطناعي هيقترحلك بديل آمن لإصاباتك ومناسب للأدوات اللي عندك، ونفس المجموعة العضلية المستهدفة.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRequestSwap}
                    disabled={isSwapping}
                    className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSwapping ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {isSwapping ? 'الكوتش الذكي بيفكر...' : 'اطلب بديل ذكي'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
