import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { playClick, playSuccess, playNotify } from '../lib/sounds';
import { UserProfile, PackageConfig, FullQuestionnaire, MeasurementHistory, WeeklyPlan, AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Users, User, Trash2, LogOut, ShieldCheck, Activity, CheckCircle2, XCircle, FileText, ChevronDown, ChevronUp, CircleAlert, ShieldAlert, Calendar, Dumbbell, X, Play, Pause, Download, RefreshCw, MoreVertical, Check, Mic, Upload, Bell, Heart, Zap, Clock, Droplets, Ruler, MapPin, Utensils, ChevronRight, ChevronLeft, Scale, Target, Volume2, Sparkles, Loader2, Eye, Camera, CreditCard, DollarSign } from 'lucide-react';
import Chat from './Chat';
import ActivityFeed from './ActivityFeed';
import MoodTrendChart from './MoodTrendChart';
import { BodyMap } from './BodyMap';
import ChampionsFeed from './ChampionsFeed';
import ComplianceScores from './ComplianceScores';
import AdminRadar from './AdminRadar';
import AdminDigest from './AdminDigest';
import SmartMicInbox from './SmartMicInbox';
import { useLightbox } from './Lightbox';
import { aiMasterEngine, handleAIError, computeScientificPrescription } from '../services/aiMasterEngine';
import ScientificEngineCard from './ScientificEngineCard';
import AdminMacroCard from './AdminMacroCard';
import AdminProgressionCard from './AdminProgressionCard';
import Markdown from 'react-markdown';
import MembershipManager from './MembershipManager';
import EMSAttendance from './EMSAttendance';
import FinancialDashboard from './FinancialDashboard';
import { useNotifications } from '../hooks/useNotifications';
import { useClientSelection } from '../hooks/useClientSelection';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function AdminDashboard() {
  // Lightbox shared by InBody/progress thumbnails throughout the dashboard so
  // the coach can zoom & pan to read the printout numbers in detail.
  const lb = useLightbox();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'profile' | 'progress' | 'chat'>('profile');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<FullQuestionnaire | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isActivating, setIsActivating] = useState<UserProfile | null>(null);
  const [isSettingPlan, setIsSettingPlan] = useState<UserProfile | null>(null);
  const [planData, setPlanData] = useState({
    workout: '',
    nutrition: '',
    rehab: '',
    ems: '',
    pdfUrl: ''
  });
  const [assessmentData, setAssessmentData] = useState({
    benchPress: 0,
    squat: 0,
    deadlift: 0,
    beepLevel: 0,
    beepShuttles: 0,
    sitAndReach: 0
  });
  const [loadAnalysis, setLoadAnalysis] = useState<{ relativeStrength: number; estimatedVolume: number; intensityZone: string } | null>(null);
  const [loadAnalyzing, setLoadAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  // Vision-AI InBody analysis state — kept local so it resets per client view.
  const [inBodyAnalyzing, setInBodyAnalyzing] = useState(false);
  const [inBodyAnalysis, setInBodyAnalysis] = useState<string>('');
  // Coach-facing AI brain summary (voice + InBody + onboarding → 1 page).
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainError, setBrainError] = useState<string>('');
  // Track unread messages from clients
  const [unreadMessages, setUnreadMessages] = useState(0);

  const {
    selectedClient,
    setSelectedClient,
    expandedClient,
    setExpandedClient,
  } = useClientSelection();

  /**
   * Combines voiceTranscript + Vision InBody analysis + onboarding goals into
   * a single Gemini call that returns a 6-8 bullet Arabic briefing the coach
   * can scan in 30 seconds. Persisted to user.brainSummary so it survives reloads.
   */
  const generateBrainSummary = async (client: UserProfile) => {
    setBrainError('');
    setBrainLoading(true);
    try {
      const od: any = client.onboardingData || {};
      const lines: string[] = [
        `الاسم: ${client.name}`,
        `الجنس: ${client.gender === 'female' ? 'أنثى' : 'ذكر'}`,
        `العمر: ${od.age || '?'}`,
        `الهدف: ${od.goal || '—'}`,
        `الوزن: ${od.weight || '—'} كجم — الطول: ${od.height || '—'} سم`,
        `مكان التدريب: ${od.trainingLocation || '—'}`,
        `إصابات: ${od.hasInjury ? (od.injuryDescription || 'نعم') : 'لا'}`,
        `يحب: ${od.likes || '—'}`,
        `يكره: ${od.dislikes || '—'}`,
        `الباقات: ${[
          client.packages?.workout && 'تدريب',
          client.packages?.nutrition && 'تغذية',
          client.packages?.rehab && 'تأهيل',
          client.packages?.ems && 'EMS',
        ].filter(Boolean).join('، ') || '—'}`,
      ];
      const transcript = (client.voiceTranscript || od.voiceTranscript || '').trim();
      const inbodyText = inBodyAnalysis.trim();
      const prompt = `أنت كوتش تنفيذي. لخّص بيانات هذا العميل في 6-8 نقاط عربية مختصرة (سطر واحد لكل نقطة) تُمكّن الكوتش من اتخاذ قرار فوري بشأن خطة التدريب والتغذية. اعتمد فقط على البيانات المتوفرة، لا تخترع أرقاماً.

—— البيانات الأساسية ——
${lines.join('\n')}

—— تفريغ التسجيل الصوتي للعميل ——
${transcript || '(لا يوجد تسجيل)'}

—— تحليل الـ InBody (Vision AI) ——
${inbodyText || '(لم يتم تشغيل تحليل InBody بعد)'}

أعد فقط النقاط بصيغة:
• ...
• ...
بدون مقدمة أو خاتمة.`;

      const base = (import.meta as any).env?.BASE_URL || '/';
      const res = await fetch(`${base}api/ai-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.3, maxOutputTokens: 900 },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text =
        data?.text ||
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
        '';
      if (!text) throw new Error('استجابة فارغة من المحلل');
      await updateDoc(doc(db, 'users', client.uid), {
        brainSummary: { text, generatedAt: new Date().toISOString() },
      });
    } catch (err: any) {
      console.error('[BrainSummary] failed:', err);
      setBrainError(err?.message || 'فشل غير معروف');
    } finally {
      setBrainLoading(false);
    }
  };

  /**
   * Uses Gemini to quantify training load from the client's latest adaptive assessment.
   * Returns relativeStrength, estimatedVolume, and intensityZone.
   */
  const handleQuantifyLoad = async () => {
    if (!isSettingPlan) return;
    setLoadAnalyzing(true);
    setLoadAnalysis(null);
    try {
      const latestAssessment = (isSettingPlan as any).assessmentHistory?.[0]
        || (isSettingPlan as any).adaptiveAssessment
        || {};
      const result = await aiMasterEngine.quantifyTrainingLoad(latestAssessment, isSettingPlan);
      setLoadAnalysis(result);
    } catch (err: any) {
      setMessage({ text: 'خطأ في تحليل الحمل: ' + (err?.message || ''), type: 'error' });
    } finally {
      setLoadAnalyzing(false);
    }
  };

  /**
   * Sends an InBody photo (data URL or remote URL) to Gemini Vision via /api/ai-service
   * and writes the Arabic analysis into local state so the coach can review it inline.
   */
  const analyzeInBodyVision = async (photoUrl: string) => {
    if (!photoUrl) return;
    setInBodyAnalyzing(true);
    setInBodyAnalysis('');
    try {
      // Convert remote URL or data: URL to base64 + mime for Gemini inlineData.
      let base64 = '';
      let mime = 'image/jpeg';
      if (photoUrl.startsWith('data:')) {
        const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error('صيغة الصورة غير مدعومة');
        mime = match[1];
        base64 = match[2];
      } else {
        const r = await fetch(photoUrl);
        const blob = await r.blob();
        mime = blob.type || 'image/jpeg';
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
        base64 = dataUrl.split(',')[1] || '';
      }

      const base = (import.meta as any).env?.BASE_URL || '/';
      const res = await fetch(`${base}api/ai-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { text: 'هذه صورة تقرير InBody لعميل. حلّل الأرقام بدقة (الوزن، نسبة الدهون، الكتلة العضلية، الماء، PBF، Visceral Fat، Segmental Lean). أعطِني تحليلاً مهنياً بالعربية في 5-7 نقاط فقط: نقاط القوة، نقاط الضعف، توصيات تدريبية، توصيات غذائية، تحذيرات إذا وُجدت. لا تخمن أرقاماً غير ظاهرة في الصورة.' },
              { inlineData: { mimeType: mime, data: base64 } }
            ]
          }],
          config: { temperature: 0.4, maxOutputTokens: 1500 }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text =
        data?.text ||
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
        'لم يستطع المحلل قراءة الصورة. تأكد من وضوحها.';
      setInBodyAnalysis(text);
    } catch (err: any) {
      console.error('[InBody Vision] failed:', err);
      setInBodyAnalysis(`فشل التحليل: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setInBodyAnalyzing(false);
    }
  };
  // Admin Messages corner — drawer that lists every client so the coach can
  // jump straight into a chat without first scrolling to find the client card.
  const [showMessagesDrawer, setShowMessagesDrawer] = useState(false);
  const [messagesSearch, setMessagesSearch] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [predictionResults, setPredictionResults] = useState<{[uid: string]: string}>({});
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isRequestingAssessment, setIsRequestingAssessment] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [clientPhotos, setClientPhotos] = useState<Record<string, string>>({});
  const [isGeneratingPhysicalTests, setIsGeneratingPhysicalTests] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<Array<{name: string; description: string; measurement: string}>>([]);
  const [showPhysicalTestsModal, setShowPhysicalTestsModal] = useState(false);
  // Main admin navigation tabs
  const [adminMainTab, setAdminMainTab] = useState<'overview' | 'clients' | 'activity' | 'ems' | 'finance' | 'memberships'>('overview');
  
  // AI Master Engine State
  const [aiLoading, setAiLoading] = useState<{[key: string]: boolean}>({});
  const [safetyAlerts, setSafetyAlerts] = useState<string[]>([]);
  const [aiIntensity, setAiIntensity] = useState<number | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');

  const [trackingDate, setTrackingDate] = useState(new Date().toISOString().split('T')[0]);

  const {
    showNotifications,
    setShowNotifications,
    adminNotifications,
    setAdminNotifications,
    showNotificationModal,
    setShowNotificationModal,
    notificationTarget,
    setNotificationTarget,
    notificationForm,
    setNotificationForm,
    handleSendNotification,
  } = useNotifications({ setLoading, setMessage });

  const toggleTaskStatus = async (clientUid: string, date: string, taskIdx: number, type: 'exercise' | 'meal') => {
    try {
      const clientRef = doc(db, 'users', clientUid);
      const clientData = clients.find(c => c.uid === clientUid);
      if (!clientData) return;

      const currentProgress = clientData.dailyProgress?.[date] || {
        mealsCompleted: [],
        exercisesCompleted: [],
        totalMeals: 0,
        totalExercises: 0
      };

      const field = type === 'exercise' ? 'exercisesCompleted' : 'mealsCompleted';
      let newList = [...(currentProgress[field] || [])];
      
      if (newList.includes(taskIdx)) {
        newList = newList.filter(id => id !== taskIdx);
      } else {
        newList.push(taskIdx);
      }

      await updateDoc(clientRef, {
        [`dailyProgress.${date}.${field}`]: newList
      });
      setMessage({ text: `تم تحديث حالة ${type === 'exercise' ? 'التمرين' : 'الوجبة'} بنجاح`, type: 'success' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      console.error("Error toggling task status:", error);
      setMessage({ text: 'خطأ في تحديث الحالة', type: 'error' });
    }
  };

  const getDayName = (dateStr: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(dateStr).getDay()] as keyof WeeklyPlan;
  };

  const generateAIDraft = async (type: 'nutrition' | 'workout' | 'rehab' | 'ems') => {
    if (!isSettingPlan) return;
    
    setAiLoading(prev => ({ ...prev, [type]: true }));
    try {
      let qData = selectedQuestionnaire;
      if (!qData || qData.userId !== isSettingPlan.uid) {
        const qDoc = await getDoc(doc(db, 'questionnaires', isSettingPlan.uid));
        if (qDoc.exists()) {
          qData = qDoc.data() as FullQuestionnaire;
        }
      }

      if (!qData) {
        setMessage({ text: 'يرجى انتظار تحميل بيانات الاستبيان أولاً', type: 'error' });
        return;
      }

      // Pull today's reported energy so the AI can de-load if the client is wiped today.
      const today = new Date().toISOString().split('T')[0];
      const currentEnergy: number | undefined =
        (isSettingPlan as any).dailyProgress?.[today]?.energyLevel ?? undefined;

      let result;
      if (type === 'nutrition') result = await aiMasterEngine.generateNutritionDraft(isSettingPlan, qData);
      else if (type === 'workout') result = await aiMasterEngine.generateWorkoutDraft(isSettingPlan, qData, false, selectedDifficulty, currentEnergy);
      else if (type === 'ems') result = await aiMasterEngine.generateWorkoutDraft(isSettingPlan, qData, true, selectedDifficulty, currentEnergy);
      else result = await aiMasterEngine.generateRehabDraft(isSettingPlan, qData);

      setPlanData(prev => ({ ...prev, [type]: result.content }));
      if (result.safetyAlerts) {
        setSafetyAlerts(prev => [...new Set([...prev, ...result.safetyAlerts!])]);
      }
      if ((type === 'workout' || type === 'ems') && result.suggestedIntensity) {
        setAiIntensity(result.suggestedIntensity);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: handleAIError(err), type: 'error' });
    } finally {
      setAiLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Memberships registry — loaded once for EMS package dropdowns
  const [membershipsRegistry, setMembershipsRegistry] = useState<import('../types').Membership[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'memberships'), snap =>
      setMembershipsRegistry(snap.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').Membership)))
    );
    return () => unsub();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    gender: 'male' as 'male' | 'female',
    packages: {
      workout: false,
      nutrition: false,
      rehab: false,
      ems: false
    },
    workoutMonths: 1,
    nutritionMonths: 1,
    rehabMonths: 1,
    emsSessions: 12,
    emsMembershipId: '',
    workoutMembershipId: '',
    nutritionMembershipId: '',
    rehabMembershipId: '',
  });

  useEffect(() => {
    const fetchQuestionnaire = async () => {
      if (selectedClient) {
        setSelectedQuestionnaire(null);
        setClientPhotos({});
        try {
          const [qDoc, photoDoc] = await Promise.all([
            getDoc(doc(db, 'questionnaires', selectedClient.uid)),
            getDoc(doc(db, 'client_photos', selectedClient.uid)),
          ]);
          if (qDoc.exists()) setSelectedQuestionnaire(qDoc.data() as FullQuestionnaire);
          if (photoDoc.exists()) setClientPhotos(photoDoc.data() as Record<string, string>);
        } catch (error) {
          console.error("Error fetching questionnaire:", error);
        }
      }
    };
    fetchQuestionnaire();
  }, [selectedClient]);

  useEffect(() => {
    const fetchQuestionnaireForPlan = async () => {
      if (isSettingPlan && (!selectedQuestionnaire || selectedQuestionnaire.userId !== isSettingPlan.uid)) {
        try {
          const qDoc = await getDoc(doc(db, 'questionnaires', isSettingPlan.uid));
          if (qDoc.exists()) setSelectedQuestionnaire(qDoc.data() as FullQuestionnaire);
        } catch (error) {
          console.error("Error fetching questionnaire for plan builder:", error);
        }
      }
    };
    fetchQuestionnaireForPlan();
  }, [isSettingPlan?.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setClients(clientsData);
      setLoading(false);
    }, (error) => {
      console.error("Clients listener error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time unread messages counter: listen to all clients' chat subcollections
  // and count messages from clients that arrived after the coach last opened the drawer.
  const lastOpenedMessagesRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!clients.length) return;
    const unsubs: (() => void)[] = [];
    let totalUnread = 0;
    const counts: Record<string, number> = {};

    clients.forEach(client => {
      const chatRef = collection(db, 'users', client.uid, 'chat');
      const q = query(chatRef, orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const unread = snap.docs.filter(d => {
          const data = d.data();
          const ts = data.createdAt?.toMillis?.() || 0;
          return data.role === 'client' && ts > lastOpenedMessagesRef.current;
        }).length;
        counts[client.uid] = unread;
        const newTotal = Object.values(counts).reduce((a, b) => a + b, 0);
        if (newTotal !== totalUnread) {
          totalUnread = newTotal;
          setUnreadMessages(totalUnread);
          if (totalUnread > 0) playNotify();
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [clients.map(c => c.uid).join(',')]);

  // Sync selectedClient and isSettingPlan with the latest data from the clients array
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find(c => c.uid === selectedClient.uid);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedClient)) {
        setSelectedClient(updated);
      }
    }
    if (isSettingPlan) {
      const updated = clients.find(c => c.uid === isSettingPlan.uid);
      if (updated && JSON.stringify(updated) !== JSON.stringify(isSettingPlan)) {
        setIsSettingPlan(updated);
      }
    }
  }, [clients]);

  // Sync selectedDifficulty with the client's stored experienceLevel when switching clients
  // Also reset plan text fields from the client's saved plan to prevent data bleed between clients.
  useEffect(() => {
    if (isSettingPlan?.experienceLevel) {
      setSelectedDifficulty(isSettingPlan.experienceLevel as 'beginner' | 'intermediate' | 'advanced');
    }
    // Pre-fill plan text fields from whatever is already saved for this client,
    // so the admin doesn't accidentally see (or overwrite) another client's notes.
    setPlanData({
      workout: (isSettingPlan?.plans as any)?.workout || '',
      nutrition: (isSettingPlan?.plans as any)?.nutrition || '',
      rehab: (isSettingPlan?.plans as any)?.rehab || '',
      ems: (isSettingPlan?.plans as any)?.ems || '',
      pdfUrl: (isSettingPlan?.plans as any)?.pdfUrl || '',
    });
    setSafetyAlerts([]);
    setAiIntensity(null);
  }, [isSettingPlan?.uid]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const packages: PackageConfig = {};
    if (formData.packages.workout) packages.workout = { months: formData.workoutMonths };
    if (formData.packages.nutrition) packages.nutrition = { months: formData.nutritionMonths };
    if (formData.packages.rehab) packages.rehab = { months: formData.rehabMonths };
    if (formData.packages.ems) packages.ems = { sessions: formData.emsSessions };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          gender: formData.gender,
          packages,
          adminUid: auth.currentUser?.uid
        })
      });

      clearTimeout(timeoutId);
      const result = await response.json();
      if (result.success) {
        setIsAdding(false);
        setFormData({
          name: '', email: '', password: '', gender: 'male',
          packages: { workout: false, nutrition: false, rehab: false, ems: false },
          workoutMonths: 1, nutritionMonths: 1, rehabMonths: 1, emsSessions: 12,
          emsMembershipId: '', workoutMembershipId: '', nutritionMembershipId: '', rehabMembershipId: '',
        });
      } else {
        alert('خطأ: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ أثناء إضافة العميل');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const toggleActivation = async (uid: string, currentStatus: boolean, client?: UserProfile) => {
    if (!currentStatus && client) {
      // If activating, open the package selection modal
      setIsActivating(client);
      setFormData({
        ...formData,
        packages: {
          workout: !!client.packages?.workout,
          nutrition: !!client.packages?.nutrition,
          rehab: !!client.packages?.rehab,
          ems: !!client.packages?.ems
        }
      });
      return;
    }

    try {
      setLoading(true);
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        isActivated: !currentStatus
      });
      setMessage({ text: !currentStatus ? 'تم تفعيل الحساب بنجاح ✅' : 'تم إلغاء التفعيل', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Activation error detail:', error);
      setMessage({ text: 'خطأ في التفعيل: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (uid: string) => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/admin/delete-client', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({ targetUid: uid, adminUid: auth.currentUser?.uid })
      });
      
      clearTimeout(timeoutId);
      const result = await response.json();
      if (result.success) {
        setMessage({ text: 'تم حذف العميل بنجاح ✅', type: 'success' });
        setSelectedClient(null);
        setIsDeleting(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: 'خطأ في الحذف: ' + result.error, type: 'error' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ text: 'خطأ في الاتصال بالسيرفر', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (uid: string, newPackages: PackageConfig) => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', uid);
      
      // Calculate new expiry date (e.g., based on the longest package)
      let maxMonths = 0;
      if (newPackages.workout) maxMonths = Math.max(maxMonths, newPackages.workout.months);
      if (newPackages.nutrition) maxMonths = Math.max(maxMonths, newPackages.nutrition.months);
      if (newPackages.rehab) maxMonths = Math.max(maxMonths, newPackages.rehab.months);
      
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + (maxMonths || 1));

      await updateDoc(userRef, {
        packages: newPackages,
        expiryDate: expiryDate.toISOString(),
        isActivated: true, // Ensure they are activated on renewal
        questionnaireComplete: false // REQUIREMENT: Reset survey on membership update
      });
      
      setMessage({ text: 'تم تجديد الاشتراك بنجاح ✅', type: 'success' });
      setIsRenewing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ text: 'خطأ في التجديد: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Build the plan as an *editable draft*. Writes to `plans.weeklyPlanDraft`
   * — the client dashboard reads `plans.weeklyPlan` only, so the draft stays
   * invisible to the athlete until the admin hits "نشر للعميل".
   */
  const handleSavePlan = async () => {
    if (!isSettingPlan) return;
    try {
      setLoading(true);
      const updatedPlan = await aiMasterEngine.generateTrainingPlan(isSettingPlan, selectedQuestionnaire || undefined, planData.workout || undefined);

      const userRef = doc(db, 'users', isSettingPlan.uid);
      // Keep any existing live plan untouched — only update the draft slot
      // and the admin-side text fields.
      await updateDoc(userRef, {
        'plans.workout': planData.workout,
        'plans.nutrition': planData.nutrition,
        'plans.rehab': planData.rehab,
        'plans.ems': planData.ems,
        'plans.pdfUrl': planData.pdfUrl,
        'plans.weeklyPlanDraft': updatedPlan,
      });
      // Refresh the local modal copy so the admin sees the draft tables.
      setIsSettingPlan({
        ...isSettingPlan,
        plans: {
          ...(isSettingPlan.plans || {}),
          ...planData,
          weeklyPlanDraft: updatedPlan,
        } as any,
      });
      setMessage({
        text: 'تم بناء المسودة ✏️ — راجعها واضغط "نشر للعميل" لإظهارها في لوحة العميل.',
        type: 'success',
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (error: any) {
      setMessage({ text: 'خطأ في معالجة أو حفظ الخطة: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Promote the current draft to live. The client dashboard's realtime
   * listener picks it up instantly. Also stamps the publish time, clears
   * the draft slot, and pushes an in-app notification to the client.
   */
  const handlePublishPlan = async () => {
    if (!isSettingPlan) return;
    const draft = (isSettingPlan.plans as any)?.weeklyPlanDraft;
    if (!draft) {
      setMessage({ text: 'لا توجد مسودة جاهزة للنشر — ابنِ المسودة أولاً.', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      setLoading(true);
      const userRef = doc(db, 'users', isSettingPlan.uid);
      const publishedAt = new Date().toISOString();

      // Write plan + clear draft — client's onSnapshot fires immediately
      await updateDoc(userRef, {
        'plans.weeklyPlan': draft,
        'plans.weeklyPlanDraft': null,
        'plans.weeklyPlanPublishedAt': publishedAt,
      });

      // Push in-app notification so client sees the bell badge
      try {
        await addDoc(collection(db, 'users', isSettingPlan.uid, 'notifications'), {
          title: '🎉 خطتك الجديدة جاهزة!',
          message: 'قام الكوتش بنشر خطتك الأسبوعية المخصصة. افتح لوحة التحكم الآن لترى تمارينك ووجباتك.',
          type: 'plan_published',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      setIsSettingPlan({
        ...isSettingPlan,
        plans: {
          ...(isSettingPlan.plans || {}),
          weeklyPlan: draft,
          weeklyPlanDraft: undefined,
          weeklyPlanPublishedAt: publishedAt,
        } as any,
      });
      setMessage({ text: 'تم نشر الخطة للعميل بنجاح 🚀 — ستظهر فوراً في لوحته.', type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: 'فشل النشر: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePhysicalAssessment = async () => {
    if (!selectedClient) return;
    const isRehabOnly = !!(selectedClient.packages?.rehab) && !selectedClient.packages?.workout && !selectedClient.packages?.ems;
    setIsGeneratingPhysicalTests(true);
    try {
      const od: any = selectedClient.onboardingData || {};
      const injuryAreas: string[] = od.hasInjury
        ? (od.injuryDescription || '').split(/[,،\n]/).map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (isRehabOnly) {
        // Rehab assessment — select from the static REHAB_TESTS library
        const { selectRehabTests } = await import('../lib/scientificEngine');
        const rehabTests = selectRehabTests(injuryAreas);
        const tests = rehabTests.map(t => ({
          name: t.nameAr,
          description: t.description,
          measurement: t.measurement,
          rehabTestId: t.id,
          category: t.category,
          instructions: t.instructions,
        }));
        setGeneratedTests(tests);
        setShowPhysicalTestsModal(true);
        return;
      }

      // Fitness assessment (EMS / Workout) — AI-generated
      const prompt = `أنت كوتش متخصص في الصحة واللياقة البدنية. بناءً على البيانات التالية للعميل، قم بإنشاء 5 إلى 10 اختبارات بدنية مخصصة:

اسم العميل: ${selectedClient.name}
العمر: ${od.age || 'غير محدد'} سنة
الجنس: ${selectedClient.gender === 'female' ? 'أنثى' : 'ذكر'}
الهدف: ${od.goal || 'لياقة عامة'}
الطول: ${od.height || '?'} سم | الوزن: ${od.weight || '?'} كجم
مكان التدريب: ${od.trainingLocation || 'جيم'}
المستوى: ${selectedClient.experienceLevel || 'مبتدئ'}
العضويات: ${[selectedClient.packages?.workout && 'تدريب', selectedClient.packages?.ems && 'EMS'].filter(Boolean).join('، ') || 'عام'}
إصابات: ${od.hasInjury ? (od.injuryDescription || 'يوجد إصابات') : 'لا توجد إصابات'}

المطلوب: اختر اختبارات مناسبة وآمنة للعميل بناءً على هدفه ومستواه. أرجع JSON array فقط بدون أي نص إضافي:
[{"name":"اسم الاختبار","description":"وصف مختصر","measurement":"وحدة القياس مثل تكرار أو ثانية أو كجم"}]`;

      const res = await fetch('/api/ai-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.4, maxOutputTokens: 1500 },
        }),
      });
      const data = await res.json();
      const text = data?.text || data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let tests: any[] = [];
      try { tests = jsonMatch ? JSON.parse(jsonMatch[0]) : []; } catch { tests = []; }
      if (!Array.isArray(tests) || tests.length === 0) {
        // Fallback: use the deterministic template library so the admin is never blocked
        const fallbackNames = aiMasterEngine.getAssessmentTemplates(
          od.goal || 'fitness',
          od.trainingLocation || 'gym',
          selectedClient.experienceLevel || 'intermediate'
        );
        tests = fallbackNames.map(name => ({
          name,
          description: 'اختبار من المكتبة القياسية',
          measurement: name.includes('kg') || name.includes('1RM') ? 'كجم' : name.includes('cm') ? 'سم' : 'تكرار / ثانية',
        }));
      }
      setGeneratedTests(tests);
      setShowPhysicalTestsModal(true);
    } catch (err: any) {
      console.error('Error generating physical tests:', err);
      setMessage({ text: 'خطأ في توليد الاختبارات: ' + err.message, type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsGeneratingPhysicalTests(false);
    }
  };

  const handleConfirmPhysicalAssessment = async () => {
    if (!selectedClient || generatedTests.length === 0) return;
    const isRehabOnly = !!(selectedClient.packages?.rehab) && !selectedClient.packages?.workout && !selectedClient.packages?.ems;
    try {
      setLoading(true);
      const request = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        templateName: isRehabOnly ? 'تقييم الإصابة والتأهيل' : 'تقييم بدني مخصص بالذكاء الاصطناعي',
        testNames: generatedTests.map((t: any) => t.name),
        testsDetails: generatedTests,
        assessmentType: (isRehabOnly ? 'rehab' : 'fitness') as 'rehab' | 'fitness',
        status: 'pending' as const,
      };
      const userRef = doc(db, 'users', selectedClient.uid);
      const currentRequests = selectedClient.assessmentRequests || [];
      await updateDoc(userRef, {
        assessmentRequests: [...currentRequests, request],
        physicalAssessmentEnabled: true,
      });
      setShowPhysicalTestsModal(false);
      setGeneratedTests([]);
      const msg = isRehabOnly
        ? 'تم إرسال تقييم الإصابة وتفعيل تبويب تقييم الإصابة للعميل ✅'
        : 'تم إرسال التقييم البدني وتفعيل تبويب التقييم للعميل ✅';
      setMessage({ text: msg, type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ text: 'خطأ في حفظ التقييم', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendAssessment = async () => {
    if (!selectedClient || !selectedTemplate) return;
    try {
      setLoading(true);
      const testNames = aiMasterEngine.getAssessmentTemplates(
        selectedClient.onboardingData?.goal || 'fitness',
        selectedClient.questionnaireComplete ? 'gym' : 'home',
        selectedClient.experienceLevel || 'intermediate'
      );

      const request = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        templateName: selectedTemplate,
        testNames: testNames,
        status: 'pending' as const
      };

      const userRef = doc(db, 'users', selectedClient.uid);
      const currentRequests = selectedClient.assessmentRequests || [];
      
      await updateDoc(userRef, {
        assessmentRequests: [...currentRequests, request]
      });

      setMessage({ text: 'تم إرسال طلب التقييم للعميل بنجاح 📋', type: 'success' });
      setIsRequestingAssessment(false);
      setSelectedTemplate(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'خطأ في إرسال التقييم', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('admin-plan-preview');
    if (!element) {
      setMessage({ text: 'لا يوجد محتوى لتصديره - تأكد من وجود نص في الخطة', type: 'error' });
      return;
    }

    try {
      setIsExportingPDF(true);
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`EliteCoach_Plan_${isSettingPlan?.name || 'Client'}.pdf`);
      setMessage({ text: 'تم تصدير الخطة بنجاح PDF ✅', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'فشل تصدير الـ PDF', type: 'error' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleQuantize = async () => {
    if (!isSettingPlan) return;
    setAiLoading(prev => ({ ...prev, quantize: true }));
    try {
      const results = await aiMasterEngine.quantifyTrainingLoad(assessmentData, isSettingPlan);
      const assessmentRef = doc(db, 'users', isSettingPlan.uid);
      const newAssessment = {
        date: new Date().toISOString(),
        oneRM: {
          benchPress: assessmentData.benchPress,
          squat: assessmentData.squat,
          deadlift: assessmentData.deadlift,
        },
        beepTest: {
          level: assessmentData.beepLevel,
          shuttles: assessmentData.beepShuttles,
        },
        flexibility: {
          sitAndReach: assessmentData.sitAndReach,
        },
        calculatedMetrics: results
      };
      
      const currentHistory = isSettingPlan.assessmentHistory || [];
      await updateDoc(assessmentRef, {
        assessmentHistory: [...currentHistory, newAssessment]
      });
      
      setMessage({ text: `تم حساب الحمل التدريبي: شدة ${results.intensityZone}`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'خطأ في حساب التقييم', type: 'error' });
    } finally {
      setAiLoading(prev => ({ ...prev, quantize: false }));
    }
  };

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

  const isBirthdaySoon = (birthDate?: string) => {
    if (!birthDate) return false;
    const today = new Date();
    const birth = new Date(birthDate);
    const nextBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (nextBirth < today) nextBirth.setFullYear(today.getFullYear() + 1);
    const diff = nextBirth.getTime() - today.getTime();
    return diff <= 24 * 60 * 60 * 1000; // Within 24 hours
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden">
      {/* Shared lightbox for InBody / progress photos clicked anywhere below. */}
      {lb.element}


      {/* Admin Messages drawer — quick-access conversation list */}
      <AnimatePresence>
        {showMessagesDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMessagesDrawer(false)}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 left-0 bottom-0 w-full sm:w-96 z-[110] bg-slate-900 border-r border-white/5 flex flex-col"
            >
              <div className="p-4 border-b border-white/5 bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    رسائل العملاء
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">اختار العميل عشان تفتح الشات على طول.</p>
                </div>
                <button onClick={() => setShowMessagesDrawer(false)} className="p-2 text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-3 border-b border-white/5">
                <input
                  type="search"
                  value={messagesSearch}
                  onChange={(e) => setMessagesSearch(e.target.value)}
                  placeholder="ابحث باسم العميل..."
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {(() => {
                  const filtered = clients.filter(c =>
                    !messagesSearch.trim() ||
                    (c.name || '').toLowerCase().includes(messagesSearch.trim().toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-500 text-sm">لا يوجد عملاء مطابقون.</div>
                    );
                  }
                  return filtered.map((client) => (
                    <button
                      key={client.uid || client.email}
                      onClick={() => {
                        setSelectedClient(client);
                        setActiveModalTab('chat');
                        setShowMessagesDrawer(false);
                      }}
                      className="w-full text-right p-3 rounded-2xl border border-white/5 bg-slate-900/60 hover:bg-slate-800 hover:border-blue-500/30 transition-all flex items-center gap-3"
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${client.isActivated ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        <User size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{client.name || 'بدون اسم'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{client.email}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                        <Mic size={12} />
                        دردشة
                      </span>
                    </button>
                  ));
                })()}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <nav className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 flex items-center gap-2"
            title="العودة للرئيسية"
          >
            <ChevronRight size={24} />
            <span className="hidden sm:inline text-sm font-bold">رجوع</span>
          </button>
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">لوحة تحكم كوتش برو</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              playClick();
              setLoading(true);
              setTimeout(() => setLoading(false), 500);
            }}
            className="p-2 text-slate-400 hover:text-white transition-all hover:rotate-180 duration-500"
            title="تحديث البيانات"
          >
            <RefreshCw size={24} />
          </button>
          <div className="relative">
            <button 
              onClick={() => { playClick(); setShowNotifications(!showNotifications); }}
              className="p-2 text-slate-400 hover:text-white transition-colors relative"
            >
              <Bell size={24} />
              {(() => {
                const unreadAdminNotifs = adminNotifications.filter(n => !n.isRead).length;
                const birthdays = clients.filter(c => isBirthdaySoon(c.onboardingData?.birthDate)).length;
                const total = unreadAdminNotifs + birthdays;
                return total > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[9px] font-black text-white animate-pulse px-1">
                    {total > 9 ? '9+' : total}
                  </span>
                ) : null;
              })()}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 mt-4 w-[min(24rem,calc(100vw-1rem))] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-white/5 bg-slate-800/50 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Bell size={18} className="text-blue-400" />
                      مركز الإشعارات
                    </h3>
                    {adminNotifications.filter(n => !n.isRead).length > 0 && (
                      <button
                        onClick={async () => {
                          const adminUid = auth.currentUser?.uid;
                          if (!adminUid) return;
                          const { updateDoc: ud, doc: fd } = await import('firebase/firestore');
                          await Promise.all(
                            adminNotifications.filter(n => !n.isRead).map(n =>
                              ud(fd(db, 'users', adminUid, 'notifications', n.id), { isRead: true })
                            )
                          );
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-bold transition-colors"
                      >
                        تعليم الكل كمقروء
                      </button>
                    )}
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
                    {/* Admin Firestore Notifications */}
                    {adminNotifications.map(notif => {
                      const typeIcon: Record<string, string> = {
                        questionnaire: '📋',
                        assessment_complete: '💪',
                        plan_update: '📅',
                        system: '⚙️',
                        custom: '🔔',
                        birthday: '🎂',
                        inactivity: '😴',
                        plan_published: '🚀',
                      };
                      const typeColor: Record<string, string> = {
                        questionnaire: 'border-blue-500/30 bg-blue-500/5',
                        assessment_complete: 'border-green-500/30 bg-green-500/5',
                        plan_update: 'border-purple-500/30 bg-purple-500/5',
                        birthday: 'border-pink-500/30 bg-pink-500/5',
                        default: 'border-white/5 bg-slate-900/60',
                      };
                      const color = typeColor[notif.type] || typeColor.default;
                      return (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-2xl border transition-colors ${color} ${!notif.isRead ? 'ring-1 ring-blue-500/30' : 'opacity-70'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-lg mt-0.5 shrink-0">{typeIcon[notif.type] || '🔔'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="font-bold text-white text-sm truncate">{notif.title}</p>
                                {!notif.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                              </div>
                              <p className="text-slate-400 text-xs leading-relaxed">{notif.message}</p>
                              <p className="text-[10px] text-slate-600 mt-1">
                                {new Date(notif.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                              {notif.clientUid && (
                                <button
                                  onClick={() => {
                                    playClick();
                                    const c = clients.find(cl => cl.uid === notif.clientUid);
                                    if (c) { setSelectedClient(c); setAdminMainTab('clients'); setShowNotifications(false); }
                                  }}
                                  className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                                >
                                  <User size={10} /> فتح ملف {notif.clientName}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Birthday alerts */}
                    {clients.filter(c => isBirthdaySoon(c.onboardingData?.birthDate)).map(client => (
                      <div key={`bd-${client.uid}`} className="p-3 hover:bg-white/5 rounded-2xl border border-pink-500/20 bg-pink-500/5 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-white text-sm">{client.name} 🎂</p>
                            <p className="text-[10px] text-slate-400">عيد ميلاده/ها غداً!</p>
                          </div>
                        </div>
                        <a
                          href={`https://wa.me/2${client.phone || ''}?text=${encodeURIComponent(`كل سنة وأنت طيب يا ${client.name}! 🎂💪`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          إرسال تهنئة 🎁
                        </a>
                      </div>
                    ))}
                    {adminNotifications.length === 0 && clients.filter(c => isBirthdaySoon(c.onboardingData?.birthDate)).length === 0 && (
                      <div className="p-8 text-center">
                        <Bell size={32} className="mx-auto mb-3 text-slate-700" />
                        <p className="text-slate-500 text-sm">لا توجد إشعارات جديدة</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Messages corner — opens a drawer of all clients for fast chat access */}
          <button
            onClick={() => { playNotify(); setShowMessagesDrawer(true); setUnreadMessages(0); lastOpenedMessagesRef.current = Date.now(); }}
            className="relative p-2 text-slate-400 hover:text-white transition-colors"
            title="رسائل العملاء"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[9px] font-black text-white animate-pulse px-1">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </button>

          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span>خروج</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-3 sm:p-6">
        {/* Global Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl font-bold shadow-2xl border ${
                message.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Tab Navigation ────────────────────────────────── */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {([
            { key: 'overview',     labelAr: 'الرئيسية',    icon: <Activity size={15} /> },
            { key: 'clients',      labelAr: 'العملاء',     icon: <Users size={15} /> },
            { key: 'activity',     labelAr: 'النشاط',      icon: <Zap size={15} /> },
            { key: 'ems',          labelAr: 'حضور EMS',    icon: <Dumbbell size={15} /> },
            { key: 'memberships',  labelAr: 'العضويات',    icon: <CreditCard size={15} /> },
            { key: 'finance',      labelAr: 'المالية',     icon: <DollarSign size={15} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => { playClick(); setAdminMainTab(tab.key); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                adminMainTab === tab.key
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 border border-white/5'
              }`}
            >
              {tab.icon}
              {tab.labelAr}
            </button>
          ))}
        </div>

        {/* ── Tab: الرئيسية ──────────────────────────────────────── */}
        {adminMainTab === 'overview' && <>

        {/* Elite Dashboard Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/30 p-6 rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={60} /></div>
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">أبطال الالتزام</h3>
            <div className="space-y-3">
              {clients.sort((a, b) => {
                const getP = (c: UserProfile) => {
                  const today = new Date().toISOString().split('T')[0];
                  const log = c.dailyProgress?.[today];
                  if (!log) return 0;
                  const completed = (log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0);
                  const total = (log.totalMeals || 0) + (log.totalExercises || 0);
                  return total > 0 ? (completed / total) : 0;
                };
                return getP(b) - getP(a);
              }).slice(0, 3).map((hero, i) => (
                <div key={hero.uid || `hero-${i}`} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">{i+1}</span>
                    {hero.name}
                  </span>
                  <span className="text-blue-400 font-bold">
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const log = hero.dailyProgress?.[today];
                      if (!log) return '0%';
                      const completed = (log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0);
                      const total = (log.totalMeals || 0) + (log.totalExercises || 0);
                      return total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%';
                    })()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {(() => {
            // Compute "no workout completed in last N days" using dailyProgress.
            // Falls back to lastLoginAt if dailyProgress is empty.
            const daysSinceWorkout = (c: UserProfile): number => {
              const dp: any = (c as any).dailyProgress || {};
              const dates = Object.keys(dp).sort();
              for (let i = dates.length - 1; i >= 0; i--) {
                const log = dp[dates[i]];
                if (log && Array.isArray(log.exercisesCompleted) && log.exercisesCompleted.length > 0) {
                  return Math.floor((Date.now() - new Date(dates[i]).getTime()) / 86400000);
                }
              }
              const last = c.lastLoginAt ? new Date(c.lastLoginAt as any) : null;
              return last ? Math.floor((Date.now() - last.getTime()) / 86400000) : 999;
            };
            const flagged = clients
              .map(c => ({ c, gap: daysSinceWorkout(c) }))
              .filter(x => x.gap >= 2)
              .sort((a, b) => b.gap - a.gap)
              .slice(0, 4);
            return (
              <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Bell size={60} /></div>
                <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-3">بدون تمرين 2+ يوم</h3>
                <div className="text-3xl font-black text-amber-500 mb-2">{flagged.length}</div>
                {flagged.length > 0 ? (
                  <ul className="space-y-1.5 mt-2 max-h-28 overflow-y-auto">
                    {flagged.map(({ c, gap }) => (
                      <li key={c.uid} className="flex items-center justify-between text-[11px] gap-2">
                        <span className="text-slate-300 truncate">{c.name}</span>
                        <span className="text-amber-400 font-bold shrink-0">{gap === 999 ? '—' : `${gap} يوم`}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">جميع عملائك ملتزمون 💪</p>
                )}
              </div>
            );
          })()}

          <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Scale size={60} /></div>
            <h3 className="text-sm font-bold text-green-500 uppercase tracking-widest mb-4">إجمالي المشتركين</h3>
            <div className="text-3xl font-black text-green-500 mb-1">{clients.length}</div>
            <p className="text-xs text-slate-500 italic">بطل وبطلة في عائلة Elite Coach</p>
          </div>
        </div>

        {/* ── Overview: end of stats cards ── */}
        </>}

        {/* ── Tab: النشاط (Activity Feed) ── */}
        {adminMainTab === 'activity' && (
          <div className="mb-10">
            <ActivityFeed clients={clients} maxEntries={40} />
          </div>
        )}

        {/* ── Overview: Champions Feed ── */}
        {adminMainTab === 'overview' && auth.currentUser && (
          <div className="mb-10">
            <ChampionsFeed
              profile={{
                uid: auth.currentUser.uid,
                name: auth.currentUser.displayName || 'Coach',
                email: auth.currentUser.email || '',
                role: 'admin',
              } as unknown as UserProfile}
            />
          </div>
        )}

        {/* Quick Alerts: Pending Assessments — activity tab only */}
        {adminMainTab === 'activity' && (() => {
          const pendingRequests = clients.flatMap(c => 
            (c.assessmentRequests || [])
              .filter(r => r.status === 'pending')
              .map(r => ({ ...r, clientName: c.name, clientUid: c.uid, client: c }))
          ).sort((a, b) => b.date.localeCompare(a.date));

          const recentCompletions = clients.flatMap(c => 
            (c.assessmentRequests || [])
              .filter(r => r.status === 'completed')
              .map(r => ({ ...r, clientName: c.name, clientUid: c.uid, client: c }))
          ).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 5);

          if (pendingRequests.length === 0 && recentCompletions.length === 0) return null;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              {pendingRequests.length > 0 && (
                <div className="bg-slate-900 border border-amber-500/20 rounded-[2rem] overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-amber-500/5 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-amber-500 uppercase flex items-center gap-2">
                      <Clock size={16} /> طلبات تقييم معلقة ({pendingRequests.length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-bold text-white text-sm">{req.clientName}</p>
                          <p className="text-[10px] text-slate-500">{req.templateName} • {new Date(req.date).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedClient(req.client);
                            // Scroll to details? Or just open modal
                          }}
                          className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-bold border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                        >
                          تذكير العميل
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recentCompletions.length > 0 && (
                <div className="bg-slate-900 border border-green-500/20 rounded-[2rem] overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-green-500/5 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-green-500 uppercase flex items-center gap-2">
                      <CheckCircle2 size={16} /> تقييمات مكتملة حديثاً
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {recentCompletions.map(req => (
                      <div key={req.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-bold text-white text-sm">{req.clientName}</p>
                          <p className="text-[10px] text-slate-500">مكتمل في: {new Date(req.completedAt!).toLocaleString('ar-EG')}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => {
                              setIsSettingPlan(req.client);
                              setPlanData({
                                workout: req.client.plans?.workout || '',
                                nutrition: req.client.plans?.nutrition || '',
                                rehab: req.client.plans?.rehab || '',
                                ems: req.client.plans?.ems || '',
                                pdfUrl: req.client.plans?.pdfUrl || ''
                              });
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[10px] font-bold shadow-lg shadow-green-600/20 transition-all flex items-center gap-1"
                          >
                            <Zap size={10} />
                            تجهيز الخطة
                          </button>
                          {req.results && (
                            <div className="flex gap-1">
                              {Object.entries(req.results).slice(0, 2).map(([k, v]) => (
                                <span key={k} className="text-[8px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-white/5">
                                  {k.substring(0, 6)}: {v}
                                </span>
                              ))}
                              {Object.keys(req.results).length > 2 && <span className="text-[8px] text-slate-500">...</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* AI Digest & AdminRadar — overview tab only */}
        {adminMainTab === 'overview' && <AdminDigest clients={clients} />}
        {adminMainTab === 'overview' && (
          <div className="mb-10">
            <AdminRadar clients={clients} onSelectClient={setSelectedClient} />
          </div>
        )}

        {/* Smart Mic Inbox — activity tab only */}
        {adminMainTab === 'activity' && auth.currentUser?.uid && (
          <div className="mb-10 mt-8">
            <SmartMicInbox adminUid={auth.currentUser.uid} clients={clients} />
          </div>
        )}

        {/* ── Tab: العملاء ───────────────────────────────────────── */}
        {adminMainTab === 'clients' && <>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">إدارة العملاء</h2>
            <p className="text-slate-500">متابعة وتفعيل باقات المشتركين</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-blue-600/10 font-bold"
          >
            <UserPlus size={20} />
            <span>إضافة مشترك جديد</span>
          </button>
        </div>

        <ComplianceScores clients={clients} />

        {/* Clients List */}
        <div className="space-y-4">
          {clients.map((client, idx) => (
            <motion.div
              key={client.uid || `client-${idx}`}
              layout
              className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden"
            >
              <div className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div 
                    className={`p-4 rounded-2xl cursor-pointer transition-all hover:scale-105 ${client.isActivated ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <Users size={24} />
                  </div>
                  <div className="cursor-pointer" onClick={() => setSelectedClient(client)}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-white hover:text-blue-400 transition-colors flex items-center gap-2">
                        {client.name}
                        {client.assessmentRequests?.some(r => r.status === 'completed') && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-500 rounded text-[10px] font-black border border-green-500/20 animate-pulse">
                            <Check size={10} />
                            تم التقييم!
                          </span>
                        )}
                        {client.assessmentRequests?.some(r => r.status === 'pending') && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded text-[10px] font-black border border-amber-500/20">
                            <Clock size={10} />
                            جاري التقييم
                          </span>
                        )}
                        <span className={client.gender === 'female' ? 'text-pink-500' : 'text-blue-500'} title={client.gender === 'female' ? 'أنثى' : 'ذكر'}>
                          <User size={14} />
                        </span>
                      </h3>
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const log = client.dailyProgress?.[today];
                        const progress = log ? Math.round(((log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0)) / ((log.totalMeals || 0) + (log.totalExercises || 0)) * 100) : 0;
                        if (log && progress < 30) {
                          return (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black rounded-full border border-red-500/30 flex items-center gap-1 animate-pulse">
                              <Zap size={8} /> مأنتخ / غير ملتزم
                            </span>
                          );
                        } else if (log && progress >= 80) {
                          return (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[8px] font-black rounded-full border border-green-500/30 flex items-center gap-1">
                              <Check size={8} /> بطل ملتزم
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {client.onboardingData?.hasInjury && (
                        <div className="group relative">
                          <CircleAlert size={16} className="text-red-500 animate-pulse" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-red-600 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                            تنبيه: هذا العميل يعاني من إصابة في {client.onboardingData.painPoints?.map(p => getBodyPartName(p)).join('، ') || 'مناطق متفرقة'}، يرجى مراعاة ذلك في تصميم الجداول.
                          </div>
                        </div>
                      )}
                      {(() => {
                        // Stress/Mood Alert Logic: Mood < 4 for 3 consecutive days
                        const progress = client.dailyProgress || {};
                        const dates = Object.keys(progress).sort((a, b) => b.localeCompare(a));
                        const last3 = dates.slice(0, 3);
                        const isRedAlert = last3.length >= 3 && last3.every(d => {
                          const log = progress[d];
                          return (log.moodScore !== undefined && log.moodScore < 4) || 
                                 (log.energyLevel !== undefined && log.energyLevel < 4);
                        });
                        
                        if (isRedAlert) {
                          return (
                            <div className="group relative">
                              <ShieldAlert size={16} className="text-orange-500 animate-bounce" />
                              <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-orange-600 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-2xl border border-white/10">
                                <p className="font-bold mb-1">حمراء: تنبيه إجهاد مكثف! 🚨</p>
                                <p className="opacity-80">العميل سجل مستويات طاقة/مود منخفضة (أقل من ٤) لـ ٣ أيام متتالية. يرجى تعديل الحمل التدريبي فوراً.</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {isBirthdaySoon(client.onboardingData?.birthDate) && (
                        <div className="px-2 py-0.5 bg-pink-500/20 text-pink-400 text-[10px] font-bold rounded-full border border-pink-500/30 flex items-center gap-1">
                          <Calendar size={10} /> عيد ميلاد قريباً
                        </div>
                      )}
                      {(() => {
                        const created = new Date(client.createdAt || Date.now());
                        const expiry = new Date(created);
                        expiry.setMonth(expiry.getMonth() + 1); // Default 1 month
                        const diff = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (diff <= 3 && diff > 0) {
                          return (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-black rounded-full border border-amber-500/30 flex items-center gap-1">
                              <Clock size={8} /> تجديد الباقة (خلال {diff} يوم)
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-sm text-slate-500 ltr">{client.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {client.packages?.workout && <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-bold border border-blue-500/20">تمرين</span>}
                  {client.packages?.nutrition && <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold border border-green-500/20">تغذية</span>}
                  {client.packages?.rehab && <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold border border-red-500/20">تأهيل</span>}
                  {client.packages?.ems && <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-bold border border-purple-500/20">EMS</span>}
                </div>

                {/* Progress Monitoring */}
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>تحقيق الأهداف</span>
                    <span className="text-blue-400">
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const log = client.dailyProgress?.[today];
                        if (!log) return 0;
                        const completed = (log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0);
                        const total = (log.totalMeals || 0) + (log.totalExercises || 0);
                        return total > 0 ? Math.round((completed / total) * 100) : 0;
                      })()}%
                    </span>
                  </div>
                  <div className="h-1.5 w-32 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const log = client.dailyProgress?.[today];
                        if (!log) return 0;
                        const completed = (log.mealsCompleted?.length || 0) + (log.exercisesCompleted?.length || 0);
                        const total = (log.totalMeals || 0) + (log.totalExercises || 0);
                        return total > 0 ? Math.round((completed / total) * 100) : 0;
                      })()}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setAiLoading(prev => ({ ...prev, [`predict-${client.uid}`]: true }));
                        try {
                          const res = await aiMasterEngine.predictProgress(client);
                          setPredictionResults(prev => ({ ...prev, [client.uid]: res }));
                        } finally {
                          setAiLoading(prev => ({ ...prev, [`predict-${client.uid}`]: false }));
                        }
                      }}
                      className="p-2 bg-purple-600/10 hover:bg-purple-600 text-purple-500 hover:text-white rounded-xl transition-all border border-purple-500/20"
                      title="AI Prediction"
                    >
                      {aiLoading[`predict-${client.uid}`] ? <Activity className="animate-spin" size={18} /> : <Zap size={18} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationTarget(client);
                        setNotificationForm({
                          title: 'تنبيه من الكوتش',
                          message: '',
                          type: 'custom'
                        });
                        setShowNotificationModal(true);
                      }}
                      className="p-2 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl transition-all border border-blue-500/20"
                      title="إرسال تنبيه داخلي"
                    >
                      <Bell size={18} />
                    </button>

                    {(() => {
                      const lastLogin = client.lastLoginAt ? new Date(client.lastLoginAt) : new Date(0);
                      const daysInactive = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysInactive >= 3) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotificationTarget(client);
                              setNotificationForm({
                                title: 'لقد افتقدناك!',
                                message: `يا بطل ${client.name}، وحشتنا خروجاتك في الأبليكيشن! فاضلك تكة على التارجت ومحتاجينك ترجع أقوى.`,
                                type: 'inactivity'
                              });
                              setShowNotificationModal(true);
                            }}
                            className="p-2 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white rounded-xl transition-all border border-amber-500/20 animate-pulse"
                            title="تحفيز العميل (غير نشط)"
                          >
                            <Activity size={18} />
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all"
                  >
                    تفاصيل
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSettingPlan(client);
                      setPlanData({
                        workout: client.plans?.workout || '',
                        nutrition: client.plans?.nutrition || '',
                        rehab: client.plans?.rehab || '',
                        ems: client.plans?.ems || '',
                        pdfUrl: client.plans?.pdfUrl || ''
                      });
                    }}
                    className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl text-sm font-bold transition-all border border-blue-500/20"
                  >
                    تجهيز الخطة
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActivation(client.uid, client.isActivated, client);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      client.isActivated 
                      ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                      : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                    }`}
                  >
                    {client.isActivated ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {client.isActivated ? 'مفعل' : 'تفعيل'}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedClient(expandedClient === client.uid ? null : client.uid);
                    }}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                  >
                    {expandedClient === client.uid ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleting(client.uid);
                    }}
                    className="p-2 text-slate-700 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {isDeleting && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsDeleting(null)}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center"
                >
                  <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trash2 size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-4">حذف العميل نهائياً؟</h2>
                  <p className="text-slate-400 mb-8">
                    هل أنت متأكد من الحذف الجذري؟ سيتم مسح كافة البيانات والصور وحساب الدخول نهائياً. لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleDeleteClient(isDeleting)}
                      disabled={loading}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
                    >
                      {loading ? 'جاري الحذف...' : 'نعم، احذف نهائياً'}
                    </button>
                    <button
                      onClick={() => setIsDeleting(null)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-bold transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Plan Setting Modal */}
          <AnimatePresence>
            {isSettingPlan && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSettingPlan(null)}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Zap className="text-blue-500" />
                      تجهيز خطة: {isSettingPlan.name}
                    </h2>
                    <div className="flex gap-2">
                       <button
                        onClick={handleExportPDF}
                        disabled={isExportingPDF}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isExportingPDF ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                        تصدير PDF
                      </button>
                      <button onClick={() => setIsSettingPlan(null)} className="text-slate-500 hover:text-white">
                        <X size={24} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-10" id="admin-plan-preview">

                    {/* ── Client Data Summary — All real data from profile/questionnaire/assessment ── */}
                    {(() => {
                      const od: any = isSettingPlan.onboardingData || {};
                      const q = selectedQuestionnaire;
                      const wq = q?.workout;
                      const nq = q?.nutrition;
                      const rq = q?.rehab;
                      const eq = q?.ems;
                      const lastMeas = isSettingPlan.measurementHistory?.slice(-1)[0];
                      const inBody = od.inBodyExtracted || od.manualInBody || {};
                      const weight = lastMeas?.weight || inBody.weight || od.weight || '—';
                      const fatPct = lastMeas?.fatPercentage || inBody.fatPercentage || '—';
                      const muscleMass = lastMeas?.muscleMass || inBody.muscleMass || '—';
                      const goals = [od.goal, (wq as any)?.primaryGoal, (nq as any)?.dietGoal].filter(Boolean);
                      const injuries = od.hasInjury ? (od.injuryDescription || (rq as any)?.injuryDetails || 'يوجد إصابات') : ((rq as any)?.injuryHistory || 'لا يوجد');
                      const sleepHrs = wq?.readiness?.sleepHours ?? (nq as any)?.lifestyle?.sleepHours ?? '—';
                      const stressLvl = wq?.readiness?.stress ?? '—';
                      const readiness = (() => {
                        const s = wq?.readiness?.sleepHours;
                        const str = wq?.readiness?.stress;
                        if (s === undefined && str === undefined) return '—';
                        const sScore = s ? Math.min(10, Math.round(s / 8 * 10)) : 5;
                        const strScore = str !== undefined ? (10 - str) : 5;
                        return Math.round((sScore + strScore) / 2);
                      })();
                      const lastAssessments = (isSettingPlan.assessmentHistory || []).slice(-6).reverse();
                      return (
                        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-blue-500/20 rounded-3xl p-6 space-y-5">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
                              <User size={20} className="text-blue-300" />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-white">ملخص بيانات العميل الشامل</h3>
                              <p className="text-[11px] text-slate-500">مسحوب مباشرةً من الملف + الاستبيانات + نتائج التقييم البدني</p>
                            </div>
                            {isSettingPlan.questionnaireComplete ? (
                              <span className="mr-auto px-3 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-[11px] font-black">✓ استبيانات مكتملة</span>
                            ) : (
                              <span className="mr-auto px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full text-[11px] font-black">⚠ لم يُكمل الاستبيانات</span>
                            )}
                          </div>

                          {/* Row 1: Basic Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'الوزن', value: weight !== '—' ? `${weight} كجم` : '—', color: 'blue' },
                              { label: 'الدهون', value: fatPct !== '—' ? `${fatPct}%` : '—', color: 'orange' },
                              { label: 'الكتلة العضلية', value: muscleMass !== '—' ? `${muscleMass} كجم` : '—', color: 'green' },
                              { label: 'الطول', value: od.height ? `${od.height} سم` : '—', color: 'purple' },
                            ].map(item => (
                              <div key={item.label} className={`bg-${item.color}-500/10 border border-${item.color}-500/20 rounded-2xl p-3 text-center`}>
                                <p className="text-[10px] text-slate-500 mb-1">{item.label}</p>
                                <p className="text-lg font-black text-white">{String(item.value)}</p>
                              </div>
                            ))}
                          </div>

                          {/* Row 2: Lifestyle */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-3">
                              <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Clock size={10}/> النوم</p>
                              <p className="text-sm font-bold text-white">{sleepHrs !== '—' ? `${sleepHrs} ساعة` : '—'}</p>
                            </div>
                            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-3">
                              <p className="text-[10px] text-slate-500 mb-1">الضغط</p>
                              <p className="text-sm font-bold text-white">{stressLvl !== '—' ? `${stressLvl}/10` : '—'}</p>
                            </div>
                            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-3">
                              <p className="text-[10px] text-slate-500 mb-1">الاستعداد</p>
                              <p className="text-sm font-bold text-white">{readiness !== '—' ? `${readiness}/10` : '—'}</p>
                            </div>
                          </div>

                          {/* Row 3: Goals + Injuries */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-3">
                              <p className="text-[10px] text-slate-500 mb-1.5 flex items-center gap-1"><Target size={10}/> الأهداف</p>
                              <p className="text-sm text-white leading-relaxed">{goals.length > 0 ? goals.join(' · ') : (od.goal || '—')}</p>
                            </div>
                            <div className={`rounded-2xl p-3 border ${od.hasInjury || (rq as any)?.injuryHistory ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/50 border-white/5'}`}>
                              <p className="text-[10px] text-slate-500 mb-1.5 flex items-center gap-1"><Heart size={10}/> الإصابات</p>
                              <p className="text-sm text-white leading-relaxed">{String(injuries)}</p>
                            </div>
                          </div>

                          {/* Questionnaire Data */}
                          {q && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {wq && <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center"><p className="text-[9px] text-blue-400 font-bold mb-0.5">تدريب</p><p className="text-[11px] text-white">{(wq as any).trainingDays || wq.environment?.availableDays?.length || '—'} أيام · {wq.environment?.location || '—'}</p></div>}
                              {nq && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center"><p className="text-[9px] text-green-400 font-bold mb-0.5">تغذية</p><p className="text-[11px] text-white">{(nq as any).dietType || (nq as any).currentDiet || nq.habits?.mealsPerDay + ' وجبات' || '—'}</p></div>}
                              {rq && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center"><p className="text-[9px] text-red-400 font-bold mb-0.5">تأهيل</p><p className="text-[11px] text-white">{(rq as any).rehabGoal || (rq as any).mainComplaint || rq.injuryDescription || '—'}</p></div>}
                              {eq && <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2 text-center"><p className="text-[9px] text-purple-400 font-bold mb-0.5">EMS</p><p className="text-[11px] text-white">{(eq as any).emsExperience || (eq as any).experience || (eq as any).level || 'مبتدئ'}</p></div>}
                            </div>
                          )}

                          {/* Assessment Results */}
                          {lastAssessments.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1"><Scale size={10}/> آخر نتائج التقييم البدني</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {lastAssessments.map((ass, i) => (
                                  <div key={i} className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-2">
                                    <p className="text-[9px] text-pink-400 font-bold truncate">{ass.testName}</p>
                                    <p className="text-sm font-black text-white">{String(ass.value)}</p>
                                    {ass.estimated1RM && <p className="text-[9px] text-slate-400">1RM: {ass.estimated1RM}kg</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Scientific Engine breakdown — what the LLM will see as hard rails */}
                    <ScientificEngineCard
                      client={isSettingPlan}
                      questionnaire={selectedQuestionnaire}
                      difficulty={selectedDifficulty}
                    />

                    {/* Deterministic macro / calorie targets the AI is forced to hit */}
                    <AdminMacroCard
                      client={isSettingPlan}
                      questionnaire={selectedQuestionnaire}
                    />

                    {/* 14-day adaptive progression (Steps 6-9) — adjusts %1RM + volume */}
                    <AdminProgressionCard
                      client={isSettingPlan}
                      currentIntensityPercent={
                        computeScientificPrescription(
                          isSettingPlan,
                          selectedQuestionnaire || undefined,
                          selectedDifficulty
                        ).step5_decision.intensityPercent
                      }
                    />

                    {/* Assessment Inputs Section */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-pink-400 flex items-center gap-2 uppercase tracking-widest">
                          <Scale size={18} /> التقييم البدني المستلم
                        </h4>
                        {isSettingPlan.assessmentRequests?.some(r => r.status === 'completed') && (
                          <span className="px-3 py-1 bg-green-600/20 text-green-500 rounded-full text-[10px] font-black animate-pulse flex items-center gap-1 border border-green-500/20">
                            <CheckCircle2 size={12} />
                            بيانات جديدة متاحة
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 space-y-4">
                          <p className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                             <Dumbbell size={14} /> آخر النتائج المرسلة من {isSettingPlan.name}
                          </p>
                          <div className="space-y-3">
                            {(isSettingPlan.assessmentHistory || []).slice(-4).reverse().map((ass, i) => (
                              <div key={`adm-ass-${i}`} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-white/5">
                                <div>
                                  <p className="text-[10px] text-slate-500">{new Date(ass.date).toLocaleDateString('ar-EG')}</p>
                                  <p className="text-sm font-bold text-white">{ass.testName}: <span className="text-blue-400">{ass.value}</span></p>
                                </div>
                                {ass.estimated1RM && (
                                  <div className="text-right">
                                    <p className="text-[9px] text-slate-500 uppercase">1RM Est.</p>
                                    <p className="text-sm font-black text-pink-500">{ass.estimated1RM}kg</p>
                                  </div>
                                )}
                              </div>
                            ))}
                            {(isSettingPlan.assessmentHistory || []).length === 0 && (
                              <p className="text-xs text-slate-600 italic py-4 text-center">لا توجد نتائج مسجلة بعد.</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 space-y-4">
                          <p className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                            <Activity size={14} /> حالة الطلبات
                          </p>
                          <div className="space-y-2">
                            {isSettingPlan.assessmentRequests?.map(req => (
                              <div key={req.id} className={`p-4 rounded-2xl border ${req.status === 'completed' ? 'bg-green-600/5 border-green-500/20' : 'bg-amber-600/5 border-amber-500/20'}`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-white">{req.templateName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase ${req.status === 'completed' ? 'text-green-500' : 'text-amber-500'}`}>
                                      {req.status === 'completed' ? 'Submitted' : 'Pending'}
                                    </span>
                                    {req.status === 'pending' && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            const userRef = doc(db, 'users', isSettingPlan.uid);
                                            const updated = isSettingPlan.assessmentRequests?.map(r => 
                                              r.id === req.id ? { ...r, status: 'completed' as const, completedAt: new Date().toISOString(), results: { manual: 'Admin marked as completed' } } : r
                                            );
                                            await updateDoc(userRef, { assessmentRequests: updated });
                                            // Local update for immediate UI feedback
                                            setIsSettingPlan({ ...isSettingPlan, assessmentRequests: updated });
                                          } catch (err) {
                                            console.error(err);
                                          }
                                        }}
                                        className="p-1 hover:bg-green-500/20 text-green-500 rounded transition-colors"
                                        title="تحديد كمكتمل يدوياً"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {req.status === 'completed' && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-slate-500">تاريخ الإرسال: {new Date(req.completedAt!).toLocaleDateString('ar-EG')}</p>
                                    {req.results && (
                                      <div className="mt-2 grid grid-cols-2 gap-1">
                                        {Object.entries(req.results).map(([k, v]) => (
                                          <p key={k} className="text-[9px] text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-white/5">
                                            {k}: <span className="text-white font-bold">{v}</span>
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {isSettingPlan.assessmentRequests?.some(r => r.status === 'pending') && (
                            <div className="p-4 bg-amber-600/10 border border-amber-500/20 rounded-2xl">
                              <p className="text-xs text-amber-500 leading-relaxed font-bold">
                                تنبيه: يوجد طلب تقييم معلق. يفضل انتظار العميل حتى يرسل النتائج للحصول على أدق خطة.
                              </p>
                            </div>
                          )}

                          {/* AI Load Quantification */}
                          {((isSettingPlan as any).assessmentHistory?.length > 0 || (isSettingPlan as any).adaptiveAssessment) && (
                            <div className="space-y-3">
                              <button
                                onClick={handleQuantifyLoad}
                                disabled={loadAnalyzing}
                                className="w-full py-3 bg-violet-600/10 border border-violet-500/20 hover:bg-violet-600/20 text-violet-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                              >
                                {loadAnalyzing
                                  ? <><RefreshCw size={13} className="animate-spin" /> جاري تحليل الحمل التدريبي...</>
                                  : <><Zap size={13} /> تحليل الحمل التدريبي بالذكاء الاصطناعي</>}
                              </button>
                              {loadAnalysis && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-white/5">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">القوة النسبية</p>
                                    <p className="text-sm font-black text-white">{loadAnalysis.relativeStrength?.toFixed(1) || '—'}</p>
                                  </div>
                                  <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-white/5">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">الحجم الأسبوعي</p>
                                    <p className="text-sm font-black text-white">{loadAnalysis.estimatedVolume || '—'} سيت</p>
                                  </div>
                                  <div className="bg-violet-600/10 rounded-xl p-3 text-center border border-violet-500/20">
                                    <p className="text-[9px] text-violet-400 uppercase font-bold mb-1">منطقة الشدة</p>
                                    <p className="text-[11px] font-black text-violet-300">{loadAnalysis.intensityZone || '—'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ─── How the plan builder works ─────────────────────────────────────
                        The plan builder has TWO layers:
                        1. Text notes (below) — free-form coach reference, stored in plans.workout/nutrition/rehab/ems.
                           Generate a text draft with the AI buttons OR write them manually.
                        2. Structured weekly schedule — JSON table visible to the CLIENT under their schedule tab.
                           Generated when you press "بناء المسودة بالذكاء الاصطناعي".
                        The client NEVER sees the text notes — they only see the structured table after you hit "نشر للعميل".
                    ─────────────────────────────────────────────────────────────────── */}
                    <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex gap-3 items-start">
                      <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-400 text-[10px] font-black">!</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-blue-300">كيف يعمل منشئ الخطة؟</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          <span className="text-white font-bold">المربعات النصية أدناه:</span> ملاحظات مرجعية للكوتش فقط — العميل لا يراها.<br/>
                          <span className="text-white font-bold">الجدول الأسبوعي المنظّم:</span> هو ما يصل للعميل في تاب الجدول — يُبنى تلقائياً عند الضغط على «بناء المسودة».<br/>
                          الخطوة الأخيرة: اضغط <span className="text-emerald-400 font-bold">«نشر للعميل»</span> لإظهار الجدول في لوحة العميل.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {safetyAlerts.length > 0 && (
                        <div className="p-4 bg-orange-600/10 border border-orange-500/20 rounded-2xl space-y-2">
                          <h4 className="text-xs font-bold text-orange-500 uppercase flex items-center gap-2">
                            <CircleAlert size={14} /> تنبيهات السلامة والقيود الطبية
                          </h4>
                          {safetyAlerts.map((alert, i) => (
                            <p key={i} className="text-xs text-white leading-relaxed flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                              {alert}
                            </p>
                          ))}
                          {aiIntensity && (
                            <div className="mt-2 pt-2 border-t border-orange-500/10">
                              <p className="text-xs font-black text-orange-400 uppercase">الشدة المقترحة للنبضات: {aiIntensity}%</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <label className="block text-sm font-bold text-slate-400">تحديد مستوى الصعوبة للبرنامج (Difficulty Level)</label>
                        <div className="grid grid-cols-3 gap-3">
                          {['beginner', 'intermediate', 'advanced'].map((lv) => (
                            <button
                              key={lv}
                              onClick={() => setSelectedDifficulty(lv as any)}
                              className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                                selectedDifficulty === lv 
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                                : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/20'
                              }`}
                            >
                              {lv === 'beginner' ? 'مبتدئ' : lv === 'intermediate' ? 'متوسط' : 'متقدم'}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 italic">يؤثر هذا الاختيار في نوع التمارين، الشدة، RPE، وتصميم النبضات في حالة EMS.</p>
                      </div>

                      {isSettingPlan.packages.workout && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-400">جدول التمارين البدنية (Gym/PT)</label>
                            <button 
                              onClick={() => generateAIDraft('workout')}
                              disabled={aiLoading['workout']}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-2 px-3 py-1 bg-blue-600/10 rounded-lg border border-blue-500/20 disabled:opacity-50"
                            >
                              {aiLoading['workout'] ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                              صناعة مسودة تمارين (النسخة الاحترافية)
                            </button>
                          </div>
                          <textarea 
                            className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white h-32 outline-none focus:border-blue-500 transition-all font-mono text-sm"
                            value={planData.workout}
                            onChange={e => setPlanData({...planData, workout: e.target.value})}
                            placeholder="أدخل رابط الجدول أو تعليمات التمرين..."
                          />
                        </div>
                      )}

                      {isSettingPlan.packages.ems && (
                        <div className="space-y-2 p-4 bg-purple-600/5 border border-purple-500/10 rounded-2xl">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-purple-400">بروتوكول الـ EMS المنفصل</label>
                            <button 
                              onClick={() => generateAIDraft('ems')}
                              disabled={aiLoading['ems']}
                              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-2 px-3 py-1 bg-purple-600/10 rounded-lg border border-purple-500/20 disabled:opacity-50"
                            >
                              {aiLoading['ems'] ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                              صناعة مسودة EMS احترافية
                            </button>
                          </div>
                          <textarea 
                            className="w-full bg-slate-800/50 border border-purple-500/10 rounded-2xl px-4 py-3 text-white h-32 outline-none focus:border-purple-500 transition-all font-mono text-sm"
                            value={planData.ems}
                            onChange={e => setPlanData({...planData, ems: e.target.value})}
                            placeholder="أدخل بروتوكول EMS أو معايير النبضات..."
                          />
                        </div>
                      )}

                      {isSettingPlan.packages.nutrition && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-400">نظام التغذية (رابط أو وصف)</label>
                            <button 
                              onClick={() => generateAIDraft('nutrition')}
                              disabled={aiLoading['nutrition']}
                              className="text-xs font-bold text-green-400 hover:text-green-300 flex items-center gap-2 px-3 py-1 bg-green-600/10 rounded-lg border border-green-500/20 disabled:opacity-50"
                            >
                              {aiLoading['nutrition'] ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                              صناعة مسودة بالذكاء الاصطناعي
                            </button>
                          </div>
                          <textarea 
                            className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white h-32 outline-none focus:border-green-500 transition-all font-mono text-sm"
                            value={planData.nutrition}
                            onChange={e => setPlanData({...planData, nutrition: e.target.value})}
                            placeholder="أدخل الماكروز، السعرات، أو رابط ملف التغذية..."
                          />
                        </div>
                      )}

                      {isSettingPlan.packages.rehab && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-400">تعليمات التأهيل</label>
                            <button 
                              onClick={() => generateAIDraft('rehab')}
                              disabled={aiLoading['rehab']}
                              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-2 px-3 py-1 bg-red-600/10 rounded-lg border border-red-500/20 disabled:opacity-50"
                            >
                              {aiLoading['rehab'] ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                              صناعة مسودة بالذكاء الاصطناعي
                            </button>
                          </div>
                          <textarea 
                            className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white h-32 outline-none focus:border-red-500 transition-all font-mono text-sm"
                            value={planData.rehab}
                            onChange={e => setPlanData({...planData, rehab: e.target.value})}
                            placeholder="أدخل تمارين التأهيل أو تنبيهات الإصابة..."
                          />
                        </div>
                      )}

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">رابط ملف PDF الشامل (اختياري)</label>
                      <input 
                        type="url"
                        className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all ltr"
                        value={planData.pdfUrl}
                        onChange={e => setPlanData({...planData, pdfUrl: e.target.value})}
                        placeholder="https://example.com/plan.pdf"
                      />
                    </div>

                    {/* Draft preview — shows the AI-generated plan as an editable
                        table so the admin can scan it before publishing. */}
                    {(() => {
                      const draft: any = (isSettingPlan.plans as any)?.weeklyPlanDraft;
                      const live: any = (isSettingPlan.plans as any)?.weeklyPlan;
                      const publishedAt: string | undefined = (isSettingPlan.plans as any)?.weeklyPlanPublishedAt;
                      if (!draft && !live) return null;
                      const showing = draft || live;
                      const dayKeys = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
                      const dayLabelsAr: Record<string, string> = {
                        Saturday: 'السبت', Sunday: 'الأحد', Monday: 'الإثنين', Tuesday: 'الثلاثاء',
                        Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة',
                      };
                      return (
                        <div className="space-y-3 bg-slate-900/40 border border-white/5 rounded-3xl p-5">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <h4 className="text-sm font-black text-white flex items-center gap-2">
                                {draft ? (
                                  <>
                                    <Zap size={14} className="text-amber-400" />
                                    مسودة الخطة (مرئية للأدمن فقط)
                                  </>
                                ) : (
                                  <>
                                    <Check size={14} className="text-emerald-400" />
                                    الخطة المنشورة حالياً للعميل
                                  </>
                                )}
                              </h4>
                              {publishedAt && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                  آخر نشر: {new Date(publishedAt).toLocaleString('ar-EG')}
                                </p>
                              )}
                            </div>
                            {draft && (
                              <button
                                onClick={handlePublishPlan}
                                disabled={loading}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                              >
                                {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                نشر للعميل
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                            {dayKeys.map((d) => {
                              const day = showing[d] || { workout: [], nutrition: [] };
                              const wCount = (day.workout || []).length;
                              const nCount = (day.nutrition || []).length;
                              return (
                                <div key={d} className="bg-slate-950/40 border border-white/5 rounded-2xl p-3">
                                  <p className="text-[11px] font-black text-blue-300 mb-2">{dayLabelsAr[d]}</p>
                                  <div className="space-y-1.5">
                                    {(day.workout || []).slice(0, 3).map((ex: any, i: number) => (
                                      <p key={`w${i}`} className="text-[10px] text-slate-300 truncate">
                                        🏋️ {ex.name} <span className="text-slate-500">— {ex.sets}×{ex.reps}</span>
                                      </p>
                                    ))}
                                    {wCount > 3 && (
                                      <p className="text-[9px] text-slate-600">+ {wCount - 3} تمارين أخرى…</p>
                                    )}
                                    {(day.nutrition || []).slice(0, 2).map((m: any, i: number) => (
                                      <p key={`n${i}`} className="text-[10px] text-emerald-300/80 truncate">
                                        🥗 {m.name}
                                      </p>
                                    ))}
                                    {nCount > 2 && (
                                      <p className="text-[9px] text-slate-600">+ {nCount - 2} وجبات أخرى…</p>
                                    )}
                                    {wCount === 0 && nCount === 0 && (
                                      <p className="text-[10px] text-slate-600 italic">يوم راحة</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={handleSavePlan}
                        disabled={loading || isSettingPlan.assessmentRequests?.some(r => r.status === 'pending')}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                          isSettingPlan.assessmentRequests?.some(r => r.status === 'pending')
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                        }`}
                      >
                        {loading ? 'جاري الحفظ والتحليل...' :
                         isSettingPlan.assessmentRequests?.some(r => r.status === 'pending')
                         ? 'انتظار استكمال التقييم من العميل...'
                         : 'بناء المسودة بالذكاء الاصطناعي'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


          {/* Activation/Package Selection Modal */}
          <AnimatePresence>
            {isActivating && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsActivating(null)}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
                >
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <ShieldCheck className="text-blue-500" />
                    تفعيل العضوية وتحديد الباقات
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Workout */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.workout ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input type="checkbox" className="w-5 h-5 rounded-lg accent-blue-600"
                            checked={formData.packages.workout}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, workout: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التمرين</span>
                        </label>
                        {formData.packages.workout && (
                          membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'workout' || m.serviceType === 'all')).length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className="w-full bg-slate-900 border border-blue-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                value={formData.workoutMembershipId}
                                onChange={e => {
                                  const mem = membershipsRegistry.find(m => m.id === e.target.value);
                                  setFormData({...formData, workoutMembershipId: e.target.value, workoutMonths: mem?.durationValue || 1});
                                }}
                              >
                                <option value="">-- اختر العضوية --</option>
                                {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'workout' || m.serviceType === 'all')).map(m => (
                                  <option key={m.id} value={m.id}>{m.name} — {m.durationValue || m.totalSessions} {m.durationType === 'package' ? 'جلسة' : 'شهر'} — {m.price.toLocaleString()} ج.م</option>
                                ))}
                              </select>
                              {formData.workoutMembershipId && (() => { const mem = membershipsRegistry.find(m => m.id === formData.workoutMembershipId); return mem ? (
                                <div className="flex gap-3 text-xs text-blue-300 bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                                  <span>💙 {mem.name}</span><span>•</span><span>{mem.durationValue || mem.totalSessions} {mem.durationType === 'package' ? 'جلسة' : 'شهر'}</span><span>•</span><span>{mem.price.toLocaleString()} ج.م</span>
                                </div>) : null; })()}
                            </div>
                          ) : (
                            <select className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              value={formData.workoutMonths} onChange={e => setFormData({...formData, workoutMonths: parseInt(e.target.value)})}>
                              <option value={1}>شهر واحد</option><option value={3}>3 شهور</option><option value={6}>6 شهور</option>
                            </select>
                          )
                        )}
                      </div>

                      {/* Nutrition */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.nutrition ? 'bg-green-600/10 border-green-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input type="checkbox" className="w-5 h-5 rounded-lg accent-green-600"
                            checked={formData.packages.nutrition}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, nutrition: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التغذية</span>
                        </label>
                        {formData.packages.nutrition && (
                          membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'nutrition' || m.serviceType === 'all')).length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className="w-full bg-slate-900 border border-green-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                value={formData.nutritionMembershipId}
                                onChange={e => {
                                  const mem = membershipsRegistry.find(m => m.id === e.target.value);
                                  setFormData({...formData, nutritionMembershipId: e.target.value, nutritionMonths: mem?.durationValue || 1});
                                }}
                              >
                                <option value="">-- اختر العضوية --</option>
                                {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'nutrition' || m.serviceType === 'all')).map(m => (
                                  <option key={m.id} value={m.id}>{m.name} — {m.durationValue || m.totalSessions} {m.durationType === 'package' ? 'جلسة' : 'شهر'} — {m.price.toLocaleString()} ج.م</option>
                                ))}
                              </select>
                              {formData.nutritionMembershipId && (() => { const mem = membershipsRegistry.find(m => m.id === formData.nutritionMembershipId); return mem ? (
                                <div className="flex gap-3 text-xs text-green-300 bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                                  <span>💚 {mem.name}</span><span>•</span><span>{mem.durationValue || mem.totalSessions} {mem.durationType === 'package' ? 'جلسة' : 'شهر'}</span><span>•</span><span>{mem.price.toLocaleString()} ج.م</span>
                                </div>) : null; })()}
                            </div>
                          ) : (
                            <select className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              value={formData.nutritionMonths} onChange={e => setFormData({...formData, nutritionMonths: parseInt(e.target.value)})}>
                              <option value={1}>شهر واحد</option><option value={3}>3 شهور</option><option value={6}>6 شهور</option>
                            </select>
                          )
                        )}
                      </div>

                      {/* Rehab */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.rehab ? 'bg-red-600/10 border-red-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input type="checkbox" className="w-5 h-5 rounded-lg accent-red-600"
                            checked={formData.packages.rehab}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, rehab: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التأهيل</span>
                        </label>
                        {formData.packages.rehab && (
                          membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'rehab' || m.serviceType === 'all')).length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className="w-full bg-slate-900 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                value={formData.rehabMembershipId}
                                onChange={e => {
                                  const mem = membershipsRegistry.find(m => m.id === e.target.value);
                                  setFormData({...formData, rehabMembershipId: e.target.value, rehabMonths: mem?.durationValue || 1});
                                }}
                              >
                                <option value="">-- اختر العضوية --</option>
                                {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'rehab' || m.serviceType === 'all')).map(m => (
                                  <option key={m.id} value={m.id}>{m.name} — {m.durationValue || m.totalSessions} {m.durationType === 'package' ? 'جلسة' : 'شهر'} — {m.price.toLocaleString()} ج.م</option>
                                ))}
                              </select>
                              {formData.rehabMembershipId && (() => { const mem = membershipsRegistry.find(m => m.id === formData.rehabMembershipId); return mem ? (
                                <div className="flex gap-3 text-xs text-red-300 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                                  <span>❤️ {mem.name}</span><span>•</span><span>{mem.durationValue || mem.totalSessions} {mem.durationType === 'package' ? 'جلسة' : 'شهر'}</span><span>•</span><span>{mem.price.toLocaleString()} ج.م</span>
                                </div>) : null; })()}
                            </div>
                          ) : (
                            <select className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              value={formData.rehabMonths} onChange={e => setFormData({...formData, rehabMonths: parseInt(e.target.value)})}>
                              <option value={1}>شهر واحد</option><option value={3}>3 شهور</option>
                            </select>
                          )
                        )}
                      </div>

                      {/* EMS */}
                      <div className={`p-4 rounded-3xl border transition-all col-span-1 sm:col-span-2 ${formData.packages.ems ? 'bg-purple-600/10 border-purple-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg accent-purple-600"
                            checked={formData.packages.ems}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, ems: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة EMS</span>
                        </label>
                        {formData.packages.ems && (
                          membershipsRegistry.length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className="w-full bg-slate-900 border border-purple-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                value={formData.emsMembershipId}
                                onChange={e => {
                                  const mem = membershipsRegistry.find(m => m.id === e.target.value);
                                  setFormData({
                                    ...formData,
                                    emsMembershipId: e.target.value,
                                    emsSessions: mem?.totalSessions || formData.emsSessions
                                  });
                                }}
                              >
                                <option value="">-- اختر العضوية --</option>
                                {membershipsRegistry.filter(m => m.isActive).map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} — {m.totalSessions} جلسة — {m.price.toLocaleString()} ج.م
                                  </option>
                                ))}
                              </select>
                              {formData.emsMembershipId && (() => {
                                const mem = membershipsRegistry.find(m => m.id === formData.emsMembershipId);
                                return mem ? (
                                  <div className="flex gap-3 text-xs text-purple-300 bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                                    <span>💜 {mem.name}</span>
                                    <span>•</span>
                                    <span>{mem.totalSessions} جلسة</span>
                                    <span>•</span>
                                    <span>{mem.price.toLocaleString()} ج.م</span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <input 
                              type="number"
                              placeholder="عدد الجلسات"
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              value={formData.emsSessions}
                              onChange={e => setFormData({...formData, emsSessions: parseInt(e.target.value) || 0})}
                            />
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => {
                          const packages: PackageConfig = {};
                          if (formData.packages.workout) packages.workout = { months: formData.workoutMonths };
                          if (formData.packages.nutrition) packages.nutrition = { months: formData.nutritionMonths };
                          if (formData.packages.rehab) packages.rehab = { months: formData.rehabMonths };
                          if (formData.packages.ems) packages.ems = { sessions: formData.emsSessions };
                          handleRenew(isActivating.uid, packages);
                          setIsActivating(null);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
                      >
                        تفعيل العضوية الآن
                      </button>
                      <button
                        onClick={() => setIsActivating(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-bold transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Client Profile Modal */}
          <AnimatePresence>
            {selectedClient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedClient(null)}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                        <Users size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
                        <div className="flex items-center gap-4 mt-1">
                          <button 
                            onClick={() => setActiveModalTab('profile')}
                            className={`text-xs font-bold uppercase tracking-wider transition-colors ${activeModalTab === 'profile' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            الملف الشخصي
                          </button>
                          <button 
                            onClick={() => setActiveModalTab('progress')}
                            className={`text-xs font-bold uppercase tracking-wider transition-colors ${activeModalTab === 'progress' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            تطور المقاييس
                          </button>
                          <button 
                            onClick={() => setActiveModalTab('chat')}
                            className={`text-xs font-bold uppercase tracking-wider transition-colors ${activeModalTab === 'chat' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            المحادثة
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { playClick(); setSelectedClient(null); }}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-800/50 p-4 rounded-3xl border border-white/5">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">العمر</p>
                        <p className="text-xl font-bold text-white">{calculateAge(selectedClient.onboardingData?.birthDate)} سنة</p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-3xl border border-white/5">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">المستوى</p>
                        <select 
                          className="bg-transparent text-xl font-bold text-white outline-none w-full"
                          value={selectedClient.experienceLevel || 'intermediate'}
                          onChange={async (e) => {
                            const val = e.target.value as any;
                            const userRef = doc(db, 'users', selectedClient.uid);
                            await updateDoc(userRef, { experienceLevel: val });
                          }}
                        >
                          <option value="beginner">مبتدئ</option>
                          <option value="intermediate">متوسط</option>
                          <option value="advanced">متقدم</option>
                        </select>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-3xl border border-white/5">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">الوزن الحالي</p>
                        <p className="text-xl font-bold text-white">
                          {selectedClient.measurementHistory && selectedClient.measurementHistory.length > 0 
                            ? selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].weight 
                            : selectedClient.onboardingData?.weight} كجم
                        </p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-3xl border border-white/5">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">الهدف</p>
                        <p className="text-xl font-bold text-blue-400">
                          {selectedClient.onboardingData?.goal === 'shape' ? 'نحت الجسم' :
                           selectedClient.onboardingData?.goal === 'loss' ? 'خسارة وزن' :
                           selectedClient.onboardingData?.goal === 'bulk' ? 'تضخيم' :
                           selectedClient.onboardingData?.goal === 'fitness' ? 'لياقة بدنية' : 'تأهيل إصابة'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Volume2 size={20} className="text-blue-500" />
                        تفريغ الملاحظات الصوتية / التفاصيل الدقيقة
                      </h3>
                      <textarea 
                        className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white text-sm h-24 outline-none focus:border-blue-500 transition-all font-mono"
                        placeholder="أدخل تفريغ الملاحظات الصوتية هنا لمساعدة الذكاء الاصطناعي في التخصيص..."
                        value={selectedClient.voiceTranscript || ''}
                        onBlur={async (e) => {
                          const userRef = doc(db, 'users', selectedClient.uid);
                          await updateDoc(userRef, { voiceTranscript: e.target.value });
                        }}
                      />
                      <p className="text-[10px] text-slate-500 mt-2 italic">سيتم استخدام هذا النص كعامل أساسي عند توليد أي خطة قادمة.</p>
                    </div>

                    {/* AI Brain Summary — combines voice + InBody + onboarding into a 1-page brief. */}
                    <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900/40 p-6 rounded-[2rem] border border-indigo-500/20">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Sparkles size={20} className="text-indigo-400" />
                          الملخص الذكي للعميل
                        </h3>
                        <button
                          onClick={() => generateBrainSummary(selectedClient)}
                          disabled={brainLoading}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
                        >
                          {brainLoading
                            ? <><Loader2 size={14} className="animate-spin" /> جاري التلخيص…</>
                            : <><RefreshCw size={14} /> توليد / تحديث</>}
                        </button>
                      </div>
                      {brainError && (
                        <p className="text-[11px] text-red-400 mb-2">⚠️ {brainError}</p>
                      )}
                      {(selectedClient as any).brainSummary?.text ? (
                        <>
                          <pre className="whitespace-pre-wrap font-sans text-sm text-indigo-100 leading-relaxed bg-slate-950/40 rounded-2xl p-4 border border-indigo-500/10">
                            {(selectedClient as any).brainSummary.text}
                          </pre>
                          <p className="text-[10px] text-slate-500 mt-2">
                            آخر تحديث: {new Date((selectedClient as any).brainSummary.generatedAt).toLocaleString('ar-EG')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          اضغط "توليد" لقراءة ملخص ذكي بالعربية يجمع بين التسجيل الصوتي وتحليل الـ InBody وبيانات الـ Onboarding في 30 ثانية.
                        </p>
                      )}
                    </div>

                    {activeModalTab === 'chat' ? (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-slate-800/30 border border-white/5 rounded-3xl p-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">آخر 7 أيام — مزاج وطاقة</h4>
                          <MoodTrendChart dailyProgress={(selectedClient as any).dailyProgress} />
                        </div>
                        <Chat
                          currentUserId="admin"
                          currentUserName="الكوتش لوطفي"
                          targetUserId={selectedClient.uid}
                          targetUserName={selectedClient.name}
                          isCoach={true}
                        />
                      </div>
                    ) : activeModalTab === 'profile' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
                      {/* Left Column: Health & Audio */}
                      <div className="space-y-8">
                        {/* Body Map View */}
                        <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-red-500" />
                            خريطة الإصابات والألم
                          </h3>
                          <div className="pointer-events-none opacity-80">
                            <BodyMap 
                              selectedParts={selectedClient.onboardingData?.painPoints || []} 
                              onTogglePart={() => {}} 
                            />
                          </div>
                          {selectedClient.onboardingData?.hasInjury && (
                            <div className="mt-6 space-y-3">
                              <div className="flex items-center gap-2 px-4 py-2 bg-red-600/10 rounded-xl border border-red-500/20">
                                <Activity size={16} className="text-red-500" />
                                <span className="text-sm font-bold text-red-400">شدة الألم المبلغ عنها: {selectedClient.onboardingData.painIntensity || 5}/10</span>
                              </div>
                              {selectedClient.onboardingData.injuryDescription && (
                                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
                                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-widest text-right">وصف الإصابة:</p>
                                  <p className="text-slate-300 text-sm leading-relaxed">{selectedClient.onboardingData.injuryDescription}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Voice Note (from onboarding) — proper audio player + transcript */}
                        {(() => {
                          const od: any = selectedClient.onboardingData || {};
                          // Prefer the new dedicated `voiceNote` field. Fall back
                          // to legacy notes-embedded audio for older accounts.
                          let audioSrc: string | null = od.voiceNote || null;
                          let transcript: string = od.voiceTranscript || '';
                          if (!audioSrc && typeof od.notes === 'string') {
                            const m = od.notes.match(/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]+/);
                            if (m) audioSrc = m[0];
                          }
                          if (!audioSrc && !transcript) return null;
                          return (
                            <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Mic size={20} className="text-blue-500" />
                                التسجيل الصوتي للعميل
                              </h3>
                              {audioSrc && (
                                <div className="bg-slate-900 rounded-2xl p-4 border border-white/5 mb-4">
                                  <audio controls className="w-full h-10" src={audioSrc} />
                                </div>
                              )}
                              {transcript && (
                                <div className="bg-slate-900/60 rounded-2xl p-4 border border-blue-500/10">
                                  <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-2 flex items-center gap-1">
                                    <Sparkles size={10} /> تفريغ ذكي بواسطة Gemini
                                  </p>
                                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Manual InBody fallback (when the photo wasn't readable) */}
                        {selectedClient.onboardingData?.manualInBody && Object.values(selectedClient.onboardingData.manualInBody).some(v => v !== undefined && v !== null) && (
                          <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-amber-500/20">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <Scale size={20} className="text-amber-400" />
                              قياسات InBody يدوية
                              <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">إدخال يدوي</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { k: 'weight',          l: 'الوزن (كجم)' },
                                { k: 'fatPercentage',   l: 'نسبة الدهون %' },
                                { k: 'muscleMass',      l: 'الكتلة العضلية' },
                                { k: 'waterPercentage', l: 'نسبة الماء %' },
                                { k: 'protein',         l: 'البروتين (كجم)' },
                              ].map(f => {
                                const v = (selectedClient.onboardingData!.manualInBody as any)?.[f.k];
                                if (v === undefined || v === null || v === '') return null;
                                return (
                                  <div key={f.k} className="bg-slate-900 rounded-xl p-3 border border-white/5">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">{f.l}</p>
                                    <p className="text-lg font-black text-white">{v}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Text Notes */}
                        <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-slate-400" />
                            ملاحظات إضافية
                          </h3>
                          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {(() => {
                              // Strip any legacy audio blob accidentally concatenated
                              // into notes by older Onboarding versions so the coach
                              // sees clean text instead of a wall of base64.
                              const raw = selectedClient.onboardingData?.notes || '';
                              const cleaned = raw
                                .replace(/data:audio\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')
                                .replace(/\[Audio Message: .*?\]/g, '')
                                .replace(/\[تنبيه: رسالة صوتية مسجلة\]/g, '')
                                .trim();
                              return cleaned || 'لا توجد ملاحظات إضافية';
                            })()}
                          </p>
                        </div>
                      </div>

                      {/* Right Column: Images & Packages */}
                      <div className="space-y-8">
                        {/* Image Gallery */}
                        <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Upload size={20} className="text-green-500" />
                            صور الحالة
                          </h3>
                          {selectedClient.onboardingData?.images && selectedClient.onboardingData.images.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                              {selectedClient.onboardingData.images.map((img, i) => (
                                <a 
                                  key={i} 
                                  href={img} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="aspect-square rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all group relative"
                                >
                                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Download size={20} className="text-white" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-slate-600">
                              لا توجد صور مرفوعة
                            </div>
                          )}
                        </div>

                        {/* Active Packages & Renewal */}
                        <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              <ShieldCheck size={20} className="text-blue-500" />
                              الاشتراك الحالي
                            </h3>
                            <button 
                              onClick={() => setIsRenewing(!isRenewing)}
                              className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1"
                            >
                              <RefreshCw size={14} className={isRenewing ? 'animate-spin' : ''} />
                              {isRenewing ? 'إلغاء' : 'تجديد الاشتراك'}
                            </button>
                          </div>

                          {isRenewing ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-3">
                                {/* Workout renewal */}
                                <div className={`p-3 rounded-2xl border transition-all ${formData.packages.workout ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-900 border-white/5'}`}>
                                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="accent-blue-600" checked={!!formData.packages.workout}
                                      onChange={e => setFormData({...formData, packages: {...formData.packages, workout: e.target.checked}})} />
                                    <span className="text-sm font-bold text-white">تمرين</span>
                                  </label>
                                  {formData.packages.workout && membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'workout' || m.serviceType === 'all')).length > 0 && (
                                    <select className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                      value={formData.workoutMembershipId}
                                      onChange={e => { const mem = membershipsRegistry.find(m => m.id === e.target.value); setFormData({...formData, workoutMembershipId: e.target.value, workoutMonths: mem?.durationValue || 1}); }}>
                                      <option value="">-- اختر العضوية --</option>
                                      {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'workout' || m.serviceType === 'all')).map(m => (
                                        <option key={m.id} value={m.id}>{m.name} — {m.durationValue || 1} شهر — {m.price.toLocaleString()} ج.م</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                {/* Nutrition renewal */}
                                <div className={`p-3 rounded-2xl border transition-all ${formData.packages.nutrition ? 'bg-green-600/10 border-green-500/50' : 'bg-slate-900 border-white/5'}`}>
                                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="accent-green-600" checked={!!formData.packages.nutrition}
                                      onChange={e => setFormData({...formData, packages: {...formData.packages, nutrition: e.target.checked}})} />
                                    <span className="text-sm font-bold text-white">تغذية</span>
                                  </label>
                                  {formData.packages.nutrition && membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'nutrition' || m.serviceType === 'all')).length > 0 && (
                                    <select className="w-full bg-slate-950 border border-green-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                      value={formData.nutritionMembershipId}
                                      onChange={e => { const mem = membershipsRegistry.find(m => m.id === e.target.value); setFormData({...formData, nutritionMembershipId: e.target.value, nutritionMonths: mem?.durationValue || 1}); }}>
                                      <option value="">-- اختر العضوية --</option>
                                      {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'nutrition' || m.serviceType === 'all')).map(m => (
                                        <option key={m.id} value={m.id}>{m.name} — {m.durationValue || 1} شهر — {m.price.toLocaleString()} ج.م</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                {/* Rehab renewal */}
                                <div className={`p-3 rounded-2xl border transition-all ${formData.packages.rehab ? 'bg-red-600/10 border-red-500/50' : 'bg-slate-900 border-white/5'}`}>
                                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="accent-red-600" checked={!!formData.packages.rehab}
                                      onChange={e => setFormData({...formData, packages: {...formData.packages, rehab: e.target.checked}})} />
                                    <span className="text-sm font-bold text-white">تأهيل</span>
                                  </label>
                                  {formData.packages.rehab && membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'rehab' || m.serviceType === 'all')).length > 0 && (
                                    <select className="w-full bg-slate-950 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                      value={formData.rehabMembershipId}
                                      onChange={e => { const mem = membershipsRegistry.find(m => m.id === e.target.value); setFormData({...formData, rehabMembershipId: e.target.value, rehabMonths: mem?.durationValue || 1}); }}>
                                      <option value="">-- اختر العضوية --</option>
                                      {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'rehab' || m.serviceType === 'all')).map(m => (
                                        <option key={m.id} value={m.id}>{m.name} — {m.durationValue || 1} شهر — {m.price.toLocaleString()} ج.م</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                {/* EMS renewal */}
                                <div className={`p-3 rounded-2xl border transition-all ${formData.packages.ems ? 'bg-purple-600/10 border-purple-500/50' : 'bg-slate-900 border-white/5'}`}>
                                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="accent-purple-600" checked={!!formData.packages.ems}
                                      onChange={e => setFormData({...formData, packages: {...formData.packages, ems: e.target.checked}})} />
                                    <span className="text-sm font-bold text-white">EMS</span>
                                  </label>
                                  {formData.packages.ems && membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'ems' || m.serviceType === 'all')).length > 0 && (
                                    <select className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                      value={formData.emsMembershipId}
                                      onChange={e => { const mem = membershipsRegistry.find(m => m.id === e.target.value); setFormData({...formData, emsMembershipId: e.target.value, emsSessions: mem?.totalSessions || formData.emsSessions}); }}>
                                      <option value="">-- اختر العضوية --</option>
                                      {membershipsRegistry.filter(m => m.isActive && (m.serviceType === 'ems' || m.serviceType === 'all')).map(m => (
                                        <option key={m.id} value={m.id}>{m.name} — {m.totalSessions} جلسة — {m.price.toLocaleString()} ج.م</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  const packages: PackageConfig = {};
                                  if (formData.packages.workout) packages.workout = { months: formData.workoutMonths };
                                  if (formData.packages.nutrition) packages.nutrition = { months: formData.nutritionMonths };
                                  if (formData.packages.rehab) packages.rehab = { months: formData.rehabMonths };
                                  if (formData.packages.ems) packages.ems = { sessions: formData.emsSessions };
                                  handleRenew(selectedClient.uid, packages);
                                }}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                              >
                                حفظ التجديد
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(selectedClient.packages || {}).map(([key, val]) => {
                                const packageVal = val as any;
                                return (
                                  <div key={key} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-white/5">
                                    <span className="text-sm font-bold uppercase text-slate-400">{key}</span>
                                    <span className="text-sm font-bold text-white">
                                      {packageVal?.months ? `${packageVal.months} شهر` : `${packageVal?.sessions} جلسة`}
                                    </span>
                                  </div>
                                );
                              })}
                              {selectedClient.expiryDate && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                                  <span className="text-xs font-bold text-blue-400">تاريخ الانتهاء:</span>
                                  <span className="text-xs font-bold text-white">{new Date(selectedClient.expiryDate).toLocaleDateString('ar-EG')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Smart Questionnaire Data */}
                        {selectedQuestionnaire && (
                          <div className="space-y-8 pt-8 border-t border-white/5">
                            <h3 className="text-xl font-bold flex items-center gap-3 text-blue-400">
                              <FileText size={24} /> نتائج الاستبيان الذكي
                            </h3>

                            {selectedQuestionnaire.nutrition && (
                              <div className="bg-green-600/5 border border-green-500/10 p-6 rounded-[2rem] space-y-8">
                                <div className="flex justify-between items-center">
                                  <h4 className="font-bold flex items-center gap-2 text-green-400">
                                    <Utensils size={20} /> استبيان التغذية المتطور
                                  </h4>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  {/* Section 1: Timeline & Regular Habits */}
                                  <div className="space-y-4">
                                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold mb-3">مخطط اليوم (Timeline)</p>
                                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                                        <p><span className="text-slate-400">الاستيقاظ:</span> <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.lifestyle?.wakeHour || selectedQuestionnaire.nutrition?.timeline?.wakeup || '---'}</span></p>
                                        <p><span className="text-slate-400">النوم:</span> <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.lifestyle?.sleepHours ? `${selectedQuestionnaire.nutrition.lifestyle.sleepHours} ساعة` : (selectedQuestionnaire.nutrition?.timeline?.sleep || '---')}</span></p>
                                        <p><span className="text-slate-400">العمل:</span> <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.lifestyle?.workShiftHours ? `${selectedQuestionnaire.nutrition.lifestyle.workShiftHours} ساعة` : (selectedQuestionnaire.nutrition?.timeline?.work || '---')}</span></p>
                                        <p><span className="text-slate-400">التمرين:</span> <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.lifestyle?.workoutFrequencyPerWeek ? `${selectedQuestionnaire.nutrition.lifestyle.workoutFrequencyPerWeek}×/أسبوع` : (selectedQuestionnaire.nutrition?.timeline?.workout || '---')}</span></p>
                                      </div>
                                    </div>

                                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold mb-3">العادات والمياه</p>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">شرب المياه اليومي:</span>
                                          <span className="text-blue-400 font-black">{selectedQuestionnaire.nutrition?.supplements?.waterLiters || '---'} Liters</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">عدد الوجبات:</span>
                                          <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.habits?.mealsPerDay || '---'} وجبات</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">نهم سكريات:</span>
                                          <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.habits?.sugarCravings === 'yes' ? 'نعم' : selectedQuestionnaire.nutrition?.habits?.sugarCravings === 'no' ? 'لا' : 'أحياناً'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">التزام بالمواعيد:</span>
                                          <span className="text-white font-bold">{selectedQuestionnaire.nutrition?.habits?.isConsistent === 'yes' ? 'نعم' : selectedQuestionnaire.nutrition?.habits?.isConsistent === 'no' ? 'لا' : 'أحياناً'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Section 2: Hunger & Digestion */}
                                  <div className="space-y-4">
                                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold mb-2">أوقات ذروة الجوع</p>
                                      <p className="text-sm font-bold text-white leading-relaxed">{selectedQuestionnaire.nutrition?.habits?.peakHungerTimes || 'لا يوجد تحديد'}</p>
                                    </div>
                                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold mb-2">مشاكل الهضم</p>
                                      <p className="text-sm font-bold text-red-400 leading-relaxed">{selectedQuestionnaire.nutrition?.habits?.digestionIssues || 'لا يوجد'}</p>
                                    </div>
                                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                                      <p className="text-xs text-slate-500 uppercase font-bold mb-2">الممنوعات الغذائية (يكره)</p>
                                      <p className="text-sm text-slate-300 leading-relaxed italic">"{selectedQuestionnaire.nutrition?.preferences?.dislikes || 'لا يوجد'}"</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Section 3: 24h Daily Log - EXPANSED VIEW */}
                                <div className="space-y-4 bg-slate-900/30 p-6 rounded-[2.5rem] border border-white/5">
                                  <h5 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <Clock size={16} /> سجل الـ 24 ساعة العادي بالتفصيل
                                  </h5>
                                  <div className="space-y-3">
                                    {selectedQuestionnaire.nutrition?.dailyLog && selectedQuestionnaire.nutrition?.dailyLog.length > 0 ? (
                                      selectedQuestionnaire.nutrition.dailyLog.map((log, lIdx) => (
                                        <div key={lIdx} className="flex gap-4 items-start bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:border-green-500/30 transition-all">
                                          <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg font-black text-xs shrink-0 mt-1">
                                            {log.time}
                                          </div>
                                          <p className="text-sm text-slate-200 leading-relaxed">{log.activity}</p>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-slate-600 italic text-center py-4">لم يتم تسجيل سجل يومي مفصل</p>
                                    )}
                                  </div>
                                </div>

                                {selectedQuestionnaire.nutrition?.medical && (
                                  <div className="p-6 bg-red-600/5 rounded-[2rem] border border-red-500/10 space-y-4">
                                    <p className="text-xs text-red-400 uppercase font-black">الحالة الطبية والقيود</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className={`p-4 rounded-2xl border transition-all ${selectedQuestionnaire.nutrition.medical?.bloodPressure ? 'bg-red-500/10 border-red-500/20 text-red-100' : 'bg-slate-800/30 border-white/5 text-slate-500'}`}>
                                        <p className="text-[10px] uppercase font-bold mb-1 opacity-60">ضغط الدم</p>
                                        <p className="font-bold">{selectedQuestionnaire.nutrition.medical?.bloodPressure ? 'نعم (مصاب)' : 'سليم'}</p>
                                        {selectedQuestionnaire.nutrition.medical?.bloodPressure && selectedQuestionnaire.nutrition.medical?.bloodPressureDetails && (
                                          <p className="mt-2 text-[11px] text-red-200/70 italic leading-relaxed pt-2 border-t border-red-500/10">"{selectedQuestionnaire.nutrition.medical?.bloodPressureDetails}"</p>
                                        )}
                                      </div>
                                      
                                      <div className={`p-4 rounded-2xl border transition-all ${selectedQuestionnaire.nutrition.medical?.diabetes ? 'bg-red-500/10 border-red-500/20 text-red-100' : 'bg-slate-800/30 border-white/5 text-slate-500'}`}>
                                        <p className="text-[10px] uppercase font-bold mb-1 opacity-60">مرض السكر</p>
                                        <p className="font-bold">{selectedQuestionnaire.nutrition.medical?.diabetes ? 'نعم (مصاب)' : 'سليم'}</p>
                                        {selectedQuestionnaire.nutrition.medical?.diabetes && selectedQuestionnaire.nutrition.medical?.diabetesDetails && (
                                          <p className="mt-2 text-[11px] text-red-200/70 italic leading-relaxed pt-2 border-t border-red-500/10">"{selectedQuestionnaire.nutrition.medical?.diabetesDetails}"</p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {(selectedQuestionnaire.nutrition.medical?.surgeries || selectedQuestionnaire.nutrition.medical?.pregnancyNursing) && (
                                      <div className="grid grid-cols-1 gap-4">
                                        {selectedQuestionnaire.nutrition.medical?.surgeries && (
                                          <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">عمليات جراحية سابقة</p>
                                            <p className="text-sm text-white font-medium">{selectedQuestionnaire.nutrition.medical?.surgeryDetails || 'نعم'}</p>
                                          </div>
                                        )}
                                        {selectedQuestionnaire.nutrition.medical?.pregnancyNursing && (
                                          <div className="p-4 bg-pink-500/10 rounded-2xl border border-pink-500/20">
                                            <p className="text-[10px] text-pink-400 uppercase font-bold mb-1">حمل / رضاعة</p>
                                            <p className="text-sm text-white font-medium">نعم</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="p-4 bg-slate-900/50 rounded-2xl flex flex-wrap gap-4">
                                  <div className="flex-1 min-w-[120px]">
                                    <p className="text-[10px] text-slate-500 uppercase mb-1">الأطعمة المفضلة</p>
                                    <p className="text-sm text-white font-medium">{selectedQuestionnaire.nutrition?.preferences?.likes || '---'}</p>
                                  </div>
                                  {(selectedQuestionnaire.nutrition?.preferences?.allergies || []).length > 0 && (
                                    <div className="flex-1 min-w-[120px]">
                                      <p className="text-[10px] text-slate-500 uppercase mb-1">الحساسية</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(selectedQuestionnaire.nutrition?.preferences?.allergies || []).map((all, idx) => (
                                          <span key={`${all}-${idx}`} className="px-2 py-0.5 bg-red-600/20 text-red-400 rounded-md text-[10px] font-bold border border-red-500/20">{all}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="space-y-3">
                                  <p className="text-xs text-slate-500 uppercase mt-4 font-bold">صور الـ InBody والبداية</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    {(['front', 'side', 'inBody'] as const).map((type) => {
                                      const url = (selectedQuestionnaire?.nutrition?.photos?.[type] as string) || clientPhotos?.[type] || '';
                                      if (!url) return null;
                                      return (
                                        <a key={type} href={url} target="_blank" rel="noreferrer" className="aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-white/5 relative group hover:border-green-500/50 transition-all shadow-lg">
                                          <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold text-white uppercase text-center p-2">
                                            {type === 'front' ? 'من الأمام' : type === 'side' ? 'من الجانب' : 'InBody'}
                                          </div>
                                        </a>
                                      );
                                    })}
                                    {!(['front','side','inBody']).some(t => ((selectedQuestionnaire?.nutrition?.photos as any)?.[t] as string) || (clientPhotos as any)?.[t]) && (
                                      <p className="col-span-3 text-xs text-slate-600 italic text-center py-4">لا توجد صور مرفوعة بعد</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {selectedQuestionnaire.workout && (
                              <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-[2rem] space-y-6">
                                <h4 className="font-bold flex items-center gap-2 text-blue-400">
                                  <Dumbbell size={20} /> استبيان التمارين
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase">البيئة</p>
                                    <p className="text-sm font-bold">{selectedQuestionnaire.workout?.environment?.location === 'gym' ? 'الجيم' : 'البيت'}</p>
                                    <p className="text-xs text-slate-400">{(selectedQuestionnaire.workout?.environment?.availableDays || []).join('، ')}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase">الأهداف</p>
                                    <div className="flex flex-wrap gap-2">
                                      {(selectedQuestionnaire.workout?.goals || []).map((g, idx) => (
                                        <span key={`${g}-${idx}`} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-bold">{g}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {selectedQuestionnaire.rehab && (
                              <div className="bg-red-600/5 border border-red-500/10 p-8 rounded-[2.5rem] space-y-8">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold flex items-center gap-2 text-red-400">
                                    <Heart size={24} /> ملف التأهيل المتكامل
                                  </h4>
                                  <div className={`px-4 py-1 rounded-full text-xs font-bold border ${selectedQuestionnaire.rehab?.hasInjuries ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-green-500/20 border-green-500/30 text-green-400'}`}>
                                    {selectedQuestionnaire.rehab?.hasInjuries ? 'توجد إصابات حالية' : 'لا توجد إصابات حالية'}
                                  </div>
                                </div>

                                {selectedQuestionnaire.rehab?.hasInjuries && (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    {/* Body Map Visualization */}
                                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5 space-y-4">
                                      <p className="text-xs text-slate-500 uppercase font-black">مناطق الألم المحددة</p>
                                      <div className="h-80 w-auto flex justify-center">
                                         <BodyMap 
                                           selectedParts={selectedQuestionnaire.rehab?.painPoints || []} 
                                           onTogglePart={() => {}} // Read-only
                                         />
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {(selectedQuestionnaire.rehab?.painPoints || []).map((p, idx) => (
                                          <span key={`${p}-${idx}`} className="px-2 py-0.5 bg-red-600/10 text-red-500 rounded text-[10px] font-bold uppercase">{p.replace('_', ' ')}</span>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-6">
                                      {/* Pain Intensity */}
                                      <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5 space-y-4">
                                        <div className="flex justify-between items-center">
                                          <p className="text-xs text-slate-500 uppercase font-black">شدة الألم الحالية</p>
                                          <span className={`text-4xl font-black ${selectedQuestionnaire.rehab?.painIntensity > 7 ? 'text-red-500' : selectedQuestionnaire.rehab?.painIntensity > 4 ? 'text-orange-500' : 'text-green-500'}`}>{selectedQuestionnaire.rehab?.painIntensity || '0'}</span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${selectedQuestionnaire.rehab?.painIntensity > 7 ? 'bg-red-500' : selectedQuestionnaire.rehab?.painIntensity > 4 ? 'bg-orange-500' : 'bg-green-500'}`} 
                                            style={{ width: `${(selectedQuestionnaire.rehab?.painIntensity || 0) * 10}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Injury Description */}
                                      <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5 space-y-3">
                                        <p className="text-xs text-slate-500 uppercase font-black">تفاصيل الإصابة الحالية</p>
                                        <p className="text-sm text-slate-200 leading-relaxed italic">
                                          {selectedQuestionnaire.rehab?.injuryDescription || 'لا يوجد وصف مفصل'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-6">
                                  <h5 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <FileText size={18} /> سجل الإصابات التاريخية والتقارير
                                  </h5>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(selectedQuestionnaire.rehab?.injuries || []).map((injury, idx) => (
                                      <div key={idx} className="p-6 bg-slate-900/50 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
                                        <div className="absolute -top-2 -left-2 text-slate-800/20 font-black text-6xl italic group-hover:text-red-500/10 transition-colors pointer-events-none">0{idx + 1}</div>
                                        
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                          <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">التاريخ التقديري</p>
                                            <p className="text-sm font-bold text-white">{injury.date}</p>
                                          </div>
                                          <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${injury.intervention === 'surgery' ? 'bg-red-600/20 text-red-500' : 'bg-blue-600/20 text-blue-400'}`}>
                                            {injury.intervention === 'surgery' ? 'تدخل جراحي' : injury.intervention === 'physio' ? 'علاج طبيعي' : 'لا يوجد'}
                                          </div>
                                        </div>

                                        <div className="space-y-3 relative z-10">
                                          <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">طبيعة الألم</p>
                                            <p className="text-xs text-slate-300 capitalize">{injury.painDescription === 'sharp' ? 'حاد / طعنات' : injury.painDescription === 'heavy' ? 'ثقل' : injury.painDescription === 'throbbing' ? 'نبض' : 'آخر'}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">الخطوات السابقة</p>
                                            <p className="text-xs text-slate-300 h-10 overflow-y-auto no-scrollbar italic leading-relaxed">"{injury.previousSteps || 'لم يذكر خطوات سابقة'}"</p>
                                          </div>
                                        </div>
                                        
                                        {/* Media Grid */}
                                        <div className="grid grid-cols-4 gap-2 pt-2 relative z-10">
                                          {Object.entries(injury.media || {}).map(([type, urls]) => (
                                            Array.isArray(urls) ? (
                                              urls.map((url, i) => (
                                                <a key={`${type}-${i}`} href={url} target="_blank" rel="noreferrer" className="aspect-square bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 hover:border-red-500/40 transition-all">
                                                  {type === 'pdf' ? <FileText size={18} className="text-red-400" /> : <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                                </a>
                                              ))
                                            ) : urls ? (
                                              <a key={type} href={urls} target="_blank" rel="noreferrer" className="aspect-square bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 hover:border-red-500/40 transition-all">
                                                {type === 'pdf' ? <FileText size={18} className="text-red-400" /> : <img src={urls} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                              </a>
                                            ) : null
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    {(selectedQuestionnaire.rehab?.injuries || []).length === 0 && (
                                      <div className="col-span-full py-12 bg-slate-900/30 rounded-3xl border border-dashed border-white/5 flex flex-col items-center gap-3">
                                        <Heart className="text-slate-800" size={48} />
                                        <p className="text-slate-600 text-xs font-bold uppercase">لا يوجد سجل إصابات سابقة</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {selectedQuestionnaire.ems && (
                              <div className="bg-purple-600/5 border border-purple-500/10 p-6 rounded-[2rem] space-y-6">
                                <h4 className="font-bold flex items-center gap-2 text-purple-400">
                                  <Zap size={20} /> استبيان EMS والنشاط الكهربائي
                                </h4>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(selectedQuestionnaire.ems?.safety || {}).map(([key, val]) => (
                                      <div key={key} className={`p-3 rounded-xl text-xs font-black text-center border transition-all ${val ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                        {key === 'pacemaker' ? '⚡ منظم قلب' : key === 'epilepsy' ? '🧠 صرع' : key === 'pregnancy' ? '🤰 حمل' : '🦴 معادن'}: {val ? 'نعم (خطر)' : 'لا'}
                                      </div>
                                    ))}
                                  </div>
                                  {selectedQuestionnaire.ems?.painPoints && selectedQuestionnaire.ems.painPoints.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs text-slate-500 uppercase font-bold">نقاط الألم المستهدفة</p>
                                      {selectedQuestionnaire.ems.painPoints.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm p-3 bg-slate-900 rounded-xl border border-white/5">
                                          <span className="font-bold">{p.location || '---'}</span>
                                          <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-[10px] font-black tracking-widest uppercase">شدة: {p.intensity || 0}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Danger Zone */}
                        <div className="pt-4 border-t border-white/5">
                          <button 
                            onClick={() => setIsDeleting(selectedClient.uid)}
                            className="w-full py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-red-500/20"
                          >
                            <Trash2 size={20} />
                            <span>حذف العميل نهائياً</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Progress Tab Content */}
                        {selectedClient.measurementHistory && selectedClient.measurementHistory.length >= 1 ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                              {/* Weight Comparison */}
                              <div className="bg-slate-800/30 p-6 rounded-3xl border border-white/5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-500">مقارنة الوزن</h4>
                                {selectedClient.measurementHistory.length >= 2 ? (
                                  <div className="flex items-end gap-3">
                                    <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].weight}</p>
                                    <div className={`mb-1 flex items-center gap-1 text-sm font-bold ${
                                      selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].weight < selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].weight
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                    }`}>
                                      {selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].weight < selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].weight ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                      {Math.abs(selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].weight - selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].weight).toFixed(1)}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[0].weight}</p>
                                )}
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">كجم / الوزن الحالي</p>
                              </div>

                              {/* Fat % Comparison */}
                              <div className="bg-slate-800/30 p-6 rounded-3xl border border-white/5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-500">نسبة الدهون</h4>
                                {selectedClient.measurementHistory.length >= 2 ? (
                                  <div className="flex items-end gap-3">
                                    <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].fatPercentage}%</p>
                                    <div className={`mb-1 flex items-center gap-1 text-sm font-bold ${
                                      selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].fatPercentage < selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].fatPercentage
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                    }`}>
                                      {selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].fatPercentage < selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].fatPercentage ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                      {Math.abs(selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].fatPercentage - selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].fatPercentage).toFixed(1)}%
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[0].fatPercentage}%</p>
                                )}
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">نسبة الدهون الحالية</p>
                              </div>

                              {/* Muscle Mass Comparison */}
                              <div className="bg-slate-800/30 p-6 rounded-3xl border border-white/5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-500">الكتلة العضلية</h4>
                                {selectedClient.measurementHistory.length >= 2 ? (
                                  <div className="flex items-end gap-3">
                                    <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].muscleMass}</p>
                                    <div className={`mb-1 flex items-center gap-1 text-sm font-bold ${
                                      selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].muscleMass > selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].muscleMass
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                    }`}>
                                      {selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].muscleMass > selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].muscleMass ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      {Math.abs(selectedClient.measurementHistory[selectedClient.measurementHistory.length - 1].muscleMass - selectedClient.measurementHistory[selectedClient.measurementHistory.length - 2].muscleMass).toFixed(1)}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-3xl font-black text-white">{selectedClient.measurementHistory[0].muscleMass}</p>
                                )}
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">كجم / عضل حالي</p>
                              </div>

                              {/* InBody Image View + Vision AI analysis */}
                              <div className="bg-slate-800/30 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const last = selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 1];
                                    const imgs = [
                                      ...(last.photos?.inBody ? [{ url: last.photos.inBody, title: 'تقرير InBody' }] : []),
                                      ...(last.photos?.front  ? [{ url: last.photos.front,  title: 'صورة من الأمام' }] : []),
                                      ...(last.photos?.side   ? [{ url: last.photos.side,   title: 'صورة من الجانب' }] : []),
                                    ];
                                    if (imgs.length) lb.open(imgs);
                                  }}
                                  className="w-full min-h-[44px] bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 hover:bg-slate-800 transition-all text-xs font-bold text-blue-400 gap-2"
                                >
                                  <FileText size={16} /> عرض أحدث تقرير InBody
                                </button>
                                <button
                                  type="button"
                                  onClick={() => analyzeInBodyVision(selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 1].photos.inBody)}
                                  disabled={inBodyAnalyzing}
                                  className="w-full min-h-[44px] bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl flex items-center justify-center text-xs font-bold gap-2 transition-all disabled:opacity-50"
                                >
                                  {inBodyAnalyzing
                                    ? <><Loader2 size={14} className="animate-spin"/> جاري التحليل بالذكاء الاصطناعي...</>
                                    : <><Sparkles size={14}/> تحليل ذكي للـ InBody (Vision AI)</>}
                                </button>
                                {inBodyAnalysis && (
                                  <div className="w-full mt-2 p-3 rounded-2xl bg-slate-950/60 border border-purple-500/20 text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap text-right">
                                    {inBodyAnalysis}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Physical Assessment Section */}
                            <div className="space-y-6 pt-6 border-t border-white/5">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-pink-600/20 rounded-xl text-pink-400">
                                    <Scale size={24} />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold">التقييم البدني والقياسات</h3>
                                    <p className="text-slate-500 text-xs uppercase tracking-widest font-black">متابعة تطور شكل الجسم واللياقة</p>
                                  </div>
                                </div>
                                <button
                                  onClick={handleGeneratePhysicalAssessment}
                                  disabled={isGeneratingPhysicalTests}
                                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg ${
                                    selectedClient && !selectedClient.packages?.workout && !selectedClient.packages?.ems && selectedClient.packages?.rehab
                                      ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                                      : 'bg-pink-600 hover:bg-pink-500 shadow-pink-600/20'
                                  }`}
                                >
                                  {isGeneratingPhysicalTests ? (
                                    <><Loader2 size={15} className="animate-spin" /> جاري التوليد...</>
                                  ) : selectedClient && !selectedClient.packages?.workout && !selectedClient.packages?.ems && selectedClient.packages?.rehab ? (
                                    <><Heart size={15} /> إجراء تقييم الإصابة والتأهيل</>
                                  ) : (
                                    <><Scale size={15} /> إجراء التقييم البدني بالذكاء الاصطناعي</>
                                  )}
                                </button>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                  { label: 'الصدر', key: 'chest', unit: 'cm' },
                                  { label: 'الخصر', key: 'waist', unit: 'cm' },
                                  { label: 'الأرداف', key: 'hips', unit: 'cm' },
                                  { label: 'الذراع', key: 'arm', unit: 'cm' }
                                ].map((item) => {
                                  const currentVal = selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 1][item.key as keyof MeasurementHistory] as number || 0;
                                  const prevVal = selectedClient.measurementHistory!.length >= 2 
                                    ? selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 2][item.key as keyof MeasurementHistory] as number || 0 
                                    : 0;
                                  const diff = currentVal - prevVal;

                                  return (
                                    <div key={item.key} className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-2">
                                      <p className="text-[10px] text-slate-500 uppercase font-bold">{item.label}</p>
                                      <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-black text-white">{currentVal}</p>
                                        <span className="text-[10px] text-slate-500">{item.unit}</span>
                                      </div>
                                      {prevVal > 0 && diff !== 0 && (
                                        <div className={`flex items-center gap-1 text-[10px] font-bold ${diff < 0 ? 'text-green-500' : 'text-slate-400'}`}>
                                          {diff < 0 ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                                          {Math.abs(diff).toFixed(1)} {item.unit}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Fitness Tests Summary */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                  { label: 'اختبار الضغط', key: 'pushUps', unit: 'تكرار', color: 'text-blue-400' },
                                  { label: 'اختبار السكوات', key: 'squats', unit: 'تكرار', color: 'text-green-400' },
                                  { label: 'اختبار البلانك', key: 'plank', unit: 'ثانية', color: 'text-orange-400' }
                                ].map((test) => {
                                  const currentVal = selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 1][test.key as keyof MeasurementHistory] as number || 0;
                                  const prevVal = selectedClient.measurementHistory!.length >= 2 
                                    ? selectedClient.measurementHistory![selectedClient.measurementHistory!.length - 2][test.key as keyof MeasurementHistory] as number || 0 
                                    : 0;
                                  const diff = currentVal - prevVal;

                                  return (
                                    <div key={test.key} className="bg-slate-900 border border-white/5 p-5 rounded-3xl flex justify-between items-center group">
                                      <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">{test.label}</p>
                                        <div className="flex items-baseline gap-2">
                                          <p className={`text-3xl font-black ${test.color}`}>{currentVal}</p>
                                          <span className="text-xs text-slate-500">{test.unit}</span>
                                        </div>
                                      </div>
                                      {prevVal > 0 && diff !== 0 && (
                                        <div className={`px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 ${diff > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                          {diff > 0 ? '+' : ''}{diff}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Visualization Area */}
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">تطور القياسات الشهرية</h4>
                                  <div className="flex gap-2">
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-blue-500" /> الوزن</span>
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-pink-500" /> الخصر</span>
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 rounded-full bg-green-500" /> العضل</span>
                                  </div>
                                </div>

                                <div className="h-80 w-full bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={selectedClient.measurementHistory.map(m => ({
                                      date: new Date(m.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                                      weight: m.weight,
                                      waist: m.waist || 0,
                                      muscle: m.muscleMass,
                                      fat: m.fatPercentage
                                    }))}>
                                      <defs>
                                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorWaist" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                      <XAxis 
                                        dataKey="date" 
                                        stroke="#475569" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        dy={10}
                                      />
                                      <YAxis hide />
                                      <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                                        itemStyle={{ fontSize: '12px' }}
                                      />
                                      <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" name="الوزن" />
                                      <Area type="monotone" dataKey="waist" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorWaist)" name="الخصر" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Fitness Evolution Chart */}
                                  <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                                    <p className="text-xs text-slate-500 font-bold uppercase">تطور مستوى اللياقة</p>
                                    <div className="h-48">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={selectedClient.measurementHistory.map(m => ({
                                          date: new Date(m.date).toLocaleDateString('ar-EG', { month: 'short' }),
                                          pushUps: m.pushUps || 0,
                                          squats: m.squats || 0
                                        }))}>
                                          <XAxis dataKey="date" hide />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                                            itemStyle={{ fontSize: '10px' }}
                                          />
                                          <Line type="monotone" dataKey="pushUps" stroke="#3b82f6" strokeWidth={2} dot={false} name="الضغط" />
                                          <Line type="monotone" dataKey="squats" stroke="#22c55e" strokeWidth={2} dot={false} name="السكوات" />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                                    <p className="text-xs text-slate-500 font-bold uppercase">قوة الثبات (البلانك)</p>
                                    <div className="h-48">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedClient.measurementHistory.map(m => ({
                                          date: new Date(m.date).toLocaleDateString('ar-EG', { month: 'short' }),
                                          plank: m.plank || 0
                                        }))}>
                                          <XAxis dataKey="date" hide />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                                            itemStyle={{ fontSize: '10px' }}
                                          />
                                          <Area type="monotone" dataKey="plank" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} name="البلانك (ثانية)" />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Main Charts */}
                            <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-white/5">
                              <h3 className="text-lg font-bold mb-8 text-white flex items-center gap-2">
                                <Activity size={20} className="text-blue-500" /> مخطط التقدم الزمني
                              </h3>
                              <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={selectedClient.measurementHistory}>
                                    <defs>
                                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis 
                                      dataKey="date" 
                                      stroke="#475569" 
                                      tick={{fontSize: 10}} 
                                      tickFormatter={(date) => new Date(date).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'})}
                                    />
                                    <YAxis stroke="#475569" tick={{fontSize: 10}} />
                                    <Tooltip 
                                      contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px'}}
                                      itemStyle={{color: '#fff'}}
                                    />
                                    <Area type="monotone" dataKey="weight" name="الوزن" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                                    <Area type="monotone" dataKey="fatPercentage" name="الدهون" stroke="#22c55e" strokeWidth={2} fillOpacity={0} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* ─── 14-day Side-by-Side Comparison ─────────────
                                Picks the most recent two measurements (regardless
                                of exact date — typically 14 days apart per the
                                lockdown rule) and shows them next to each other
                                so the coach sees the visual + numeric delta in
                                one glance. Only renders when there are 2+ entries. */}
                            {(() => {
                              const hist = selectedClient.measurementHistory.slice();
                              if (hist.length < 2) return null;
                              const latest = hist[hist.length - 1];
                              const previous = hist[hist.length - 2];
                              const daysApart = Math.max(
                                1,
                                Math.round(
                                  (new Date(latest.date).getTime() - new Date(previous.date).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )
                              );
                              const delta = (a?: number, b?: number) => {
                                if (typeof a !== 'number' || typeof b !== 'number') return null;
                                const d = +(a - b).toFixed(1);
                                return d;
                              };
                              const renderDelta = (label: string, a?: number, b?: number, unit = '', betterDown = false) => {
                                const d = delta(a, b);
                                if (d === null) return null;
                                const isPositive = d > 0;
                                const isImproved = betterDown ? d < 0 : d > 0;
                                const arrow = d === 0 ? '→' : isPositive ? '▲' : '▼';
                                const color =
                                  d === 0
                                    ? 'text-slate-400'
                                    : isImproved
                                    ? 'text-emerald-400'
                                    : 'text-red-400';
                                return (
                                  <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-xl border border-white/5">
                                    <span className="text-xs text-slate-400">{label}</span>
                                    <span className={`text-sm font-bold ${color} flex items-center gap-1`}>
                                      <span>{arrow}</span>
                                      <span>
                                        {Math.abs(d)}
                                        {unit}
                                      </span>
                                    </span>
                                  </div>
                                );
                              };
                              const PhotoCol = ({
                                title,
                                date,
                                photos,
                                weight,
                                fat,
                                muscle,
                                tone,
                              }: {
                                title: string;
                                date: string;
                                photos: any;
                                weight?: number;
                                fat?: number;
                                muscle?: number;
                                tone: 'before' | 'after';
                              }) => (
                                <div
                                  className={`rounded-3xl overflow-hidden border-2 ${
                                    tone === 'before' ? 'border-slate-700/50' : 'border-emerald-500/40'
                                  } bg-slate-900/40`}
                                >
                                  <div
                                    className={`p-3 text-center ${
                                      tone === 'before' ? 'bg-slate-800/60' : 'bg-emerald-500/10'
                                    }`}
                                  >
                                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                                      {title}
                                    </p>
                                    <p className="text-sm font-bold text-white mt-1">
                                      {new Date(date).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 bg-slate-900">
                                    {(['front', 'side'] as const).map((key) => (
                                      <button
                                        type="button"
                                        key={key}
                                        onClick={() => {
                                          const all = [
                                            ...(photos?.front
                                              ? [{ url: photos.front, title: `${title} — أمام` }]
                                              : []),
                                            ...(photos?.side
                                              ? [{ url: photos.side, title: `${title} — جانب` }]
                                              : []),
                                            ...(photos?.inBody
                                              ? [{ url: photos.inBody, title: `${title} — InBody` }]
                                              : []),
                                          ];
                                          if (all.length) lb.open(all, key === 'side' ? 1 : 0);
                                        }}
                                        className="aspect-[3/4] bg-slate-950 hover:opacity-80 transition relative group"
                                      >
                                        {photos?.[key] ? (
                                          <img
                                            src={photos[key]}
                                            alt={key}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                                            <Eye size={20} />
                                            <span className="text-[10px] mt-1">لا توجد صورة</span>
                                          </div>
                                        )}
                                        <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white/80 bg-black/40 backdrop-blur-sm rounded px-1 py-0.5">
                                          {key === 'front' ? 'أمام' : 'جانب'}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                  {photos?.inBody && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        lb.open([{ url: photos.inBody, title: `${title} — InBody` }])
                                      }
                                      className="w-full p-2 text-[11px] font-bold text-blue-400 hover:bg-blue-500/10 transition border-t border-white/5 flex items-center justify-center gap-2"
                                    >
                                      <FileText size={14} /> فتح تقرير InBody
                                    </button>
                                  )}
                                  <div className="p-3 grid grid-cols-3 gap-2 bg-slate-900/60 border-t border-white/5 text-center">
                                    <div>
                                      <p className="text-[9px] text-slate-500 uppercase font-bold">وزن</p>
                                      <p className="text-sm font-black text-white">{weight ?? '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-500 uppercase font-bold">دهون</p>
                                      <p className="text-sm font-black text-white">{fat ?? '—'}%</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-500 uppercase font-bold">عضل</p>
                                      <p className="text-sm font-black text-white">{muscle ?? '—'}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                              return (
                                <div className="bg-gradient-to-br from-slate-900/80 to-slate-950 border border-emerald-500/20 rounded-[2.5rem] p-6 space-y-5">
                                  <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                        <RefreshCw size={22} />
                                      </div>
                                      <div>
                                        <h3 className="text-xl font-bold text-white">المقارنة البصرية ({daysApart} يوم)</h3>
                                        <p className="text-xs text-slate-500">
                                          آخر قياسين جنبًا إلى جنب — لقطة قبل/بعد على دورة الـ14 يوم
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <PhotoCol
                                      title="قبل"
                                      date={previous.date}
                                      photos={previous.photos}
                                      weight={previous.weight}
                                      fat={previous.fatPercentage}
                                      muscle={previous.muscleMass}
                                      tone="before"
                                    />
                                    <PhotoCol
                                      title="بعد"
                                      date={latest.date}
                                      photos={latest.photos}
                                      weight={latest.weight}
                                      fat={latest.fatPercentage}
                                      muscle={latest.muscleMass}
                                      tone="after"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {renderDelta('Δ الوزن', latest.weight, previous.weight, 'كجم', true)}
                                    {renderDelta('Δ الدهون', latest.fatPercentage, previous.fatPercentage, '%', true)}
                                    {renderDelta('Δ العضل', latest.muscleMass, previous.muscleMass, 'كجم', false)}
                                    {renderDelta('Δ الماء', latest.waterPercentage, previous.waterPercentage, '%', false)}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* History List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {selectedClient.measurementHistory.slice().reverse().map((m, idx) => (
                                <div key={idx} className="bg-slate-800/30 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-bold text-slate-500 mb-1">{new Date(m.date).toLocaleDateString('ar-EG', {dateStyle: 'long'})}</p>
                                    <div className="flex gap-4">
                                      <span className="text-sm font-bold text-white"><span className="text-slate-500">وزن:</span> {m.weight}</span>
                                      <span className="text-sm font-bold text-white"><span className="text-slate-500">دهون:</span> {m.fatPercentage}%</span>
                                      <span className="text-sm font-bold text-white"><span className="text-slate-500">عضل:</span> {m.muscleMass}</span>
                                      <span className="text-sm font-bold text-white"><span className="text-slate-500">ماء:</span> {m.waterPercentage}%</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {(m.photos?.front || m.photos?.side || m.photos?.inBody) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const all = [
                                          ...(m.photos?.front  ? [{ url: m.photos.front,  title: 'صورة من الأمام' }] : []),
                                          ...(m.photos?.side   ? [{ url: m.photos.side,   title: 'صورة من الجانب' }] : []),
                                          ...(m.photos?.inBody ? [{ url: m.photos.inBody, title: 'تقرير InBody'    }] : []),
                                        ];
                                        if (all.length) lb.open(all);
                                      }}
                                      className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 hover:ring-2 hover:ring-blue-500/40 transition"
                                      title="فتح الصور"
                                    >
                                      {m.photos?.front
                                        ? <img src={m.photos.front} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        : <div className="w-full h-full flex items-center justify-center bg-slate-900"><Camera size={14} className="text-slate-500" /></div>
                                      }
                                    </button>
                                    )}
                                    {m.photos?.inBody && (
                                    <button
                                      type="button"
                                      onClick={() => lb.open([{ url: m.photos.inBody, title: 'تقرير InBody' }])}
                                      className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 flex items-center justify-center bg-slate-900 hover:bg-slate-800 transition"
                                      title="فتح تقرير الـ InBody"
                                    >
                                      <FileText size={16} className="text-blue-500" />
                                    </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Detailed Assessment History */}
                            <div className="space-y-6 pt-10 border-t border-white/5 pb-10">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400">
                                    <RefreshCw size={24} />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold">تاريخ التقييمات والاختبارات الذكية</h3>
                                    <p className="text-slate-500 text-xs uppercase tracking-widest font-black">نتائج اختبارات الـ 1RM والقدرة البدنية</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(selectedClient.assessmentHistory || []).map((ass: any, origIdx: number) => ({ ass, origIdx })).reverse().map(({ ass, origIdx }) => (
                                  <div key={`det-ass-${origIdx}`} className="bg-slate-900 border border-white/5 p-5 rounded-[2rem] space-y-3 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                      <Zap size={40} />
                                    </div>
                                    <div className="flex justify-between items-start relative z-10">
                                      <div>
                                        <p className="text-[10px] text-slate-600 font-bold uppercase mb-1">{new Date(ass.date).toLocaleDateString('ar-EG', {dateStyle: 'medium'})}</p>
                                        <h5 className="font-bold text-white group-hover:text-blue-400 transition-colors">{ass.testName}</h5>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-2xl font-black text-blue-500">{ass.value}</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{ass.unit || 'Score'}</p>
                                      </div>
                                    </div>
                                    {ass.estimated1RM && (
                                      <div className="pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
                                        <span className="text-[10px] text-slate-500 uppercase font-black flex items-center gap-1">
                                          <ShieldCheck size={10} className="text-pink-500" /> AI 1RM Est.
                                        </span>
                                        <span className="text-sm font-black text-pink-500">{ass.estimated1RM}kg</span>
                                      </div>
                                    )}
                                    <div className="pt-3 border-t border-white/5 flex justify-end gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={async () => {
                                          const newVal = window.prompt('القيمة الجديدة:', String(ass.value));
                                          if (newVal == null || newVal === String(ass.value)) return;
                                          const updated = [...(selectedClient.assessmentHistory || [])];
                                          updated[origIdx] = { ...ass, value: isNaN(Number(newVal)) ? newVal : Number(newVal) };
                                          try {
                                            await updateDoc(doc(db, 'users', selectedClient.uid), { assessmentHistory: updated });
                                            setMessage({ text: 'تم تعديل التقييم.', type: 'success' });
                                            setTimeout(() => setMessage(null), 2500);
                                          } catch (err: any) {
                                            setMessage({ text: 'فشل التعديل: ' + (err?.message || ''), type: 'error' });
                                          }
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors text-[10px] font-bold uppercase tracking-wider px-2.5"
                                        title="تعديل القيمة"
                                      >تعديل</button>
                                      <button
                                        onClick={async () => {
                                          if (!window.confirm(`هل أنت متأكد من حذف "${ass.testName}"؟`)) return;
                                          const updated = (selectedClient.assessmentHistory || []).filter((_: any, i: number) => i !== origIdx);
                                          try {
                                            await updateDoc(doc(db, 'users', selectedClient.uid), { assessmentHistory: updated });
                                            setMessage({ text: 'تم حذف التقييم.', type: 'success' });
                                            setTimeout(() => setMessage(null), 2500);
                                          } catch (err: any) {
                                            setMessage({ text: 'فشل الحذف: ' + (err?.message || ''), type: 'error' });
                                          }
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors text-[10px] font-bold uppercase tracking-wider px-2.5"
                                        title="حذف التقييم"
                                      >حذف</button>
                                    </div>
                                  </div>
                                ))}
                                {(selectedClient.assessmentHistory || []).length === 0 && (
                                  <div className="col-span-full py-12 text-center bg-slate-900/30 rounded-[2rem] border border-dashed border-white/5">
                                    <Activity className="mx-auto text-slate-800 mb-2" size={32} />
                                    <p className="text-slate-600 text-xs italic">لم يتم إجراء اختبارات بدنية ذكية لهذا العميل بعد.</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Daily Task Tracking for Admins */}
                            <div className="space-y-6 pt-10 border-t border-white/5">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400">
                                    <CheckCircle2 size={24} />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold">متابعة الإنجاز اليومي</h3>
                                    <p className="text-slate-500 text-xs uppercase tracking-widest font-black">تتبع التمارين والوجبات وتحديث حالتها</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-2xl border border-white/5">
                                  <Calendar size={18} className="text-slate-500 mr-2" />
                                  <input 
                                    type="date" 
                                    value={trackingDate}
                                    onChange={(e) => setTrackingDate(e.target.value)}
                                    className="bg-transparent border-none text-white text-sm font-bold focus:ring-0 cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-8">
                                {/* Workout Progress */}
                                <div className="bg-slate-800/30 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                                  <h4 className="font-bold flex items-center gap-2 text-blue-400 border-b border-white/5 pb-4">
                                    <Dumbbell size={20} /> تمارين اليوم ({getDayName(trackingDate) as string})
                                  </h4>
                                  
                                  {(() => {
                                    const dayName = getDayName(trackingDate);
                                    const dayWorkout = selectedClient.plans?.weeklyPlan?.[dayName]?.workout || [];
                                    const progress = selectedClient.dailyProgress?.[trackingDate]?.exercisesCompleted || [];
                                    
                                    if (dayWorkout.length === 0) {
                                      return <p className="text-sm text-slate-500 italic text-center py-4">لا يوجد تمارين مجدولة لهذا اليوم.</p>;
                                    }

                                    return (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {dayWorkout.map((ex, idx) => {
                                          const isCompleted = progress.includes(idx);
                                          return (
                                            <div key={idx} className={`p-4 rounded-3xl border transition-all flex items-center justify-between gap-4 ${isCompleted ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900 border-white/5'}`}>
                                              <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                                  <Dumbbell size={18} />
                                                </div>
                                                <div>
                                                  <p className={`font-bold text-sm ${isCompleted ? 'text-green-400' : 'text-slate-200'}`}>{ex.name}</p>
                                                  <p className="text-[10px] text-slate-500">{ex.sets} مجموعات × {ex.reps} عدات</p>
                                                </div>
                                              </div>
                                              <button
                                                onClick={() => toggleTaskStatus(selectedClient.uid, trackingDate, idx, 'exercise')}
                                                className={`p-2 rounded-xl transition-all ${isCompleted ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                              >
                                                <Check size={20} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Nutrition Progress */}
                                <div className="bg-slate-800/30 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                                  <h4 className="font-bold flex items-center gap-2 text-green-400 border-b border-white/5 pb-4">
                                    <Utensils size={20} /> وجبات اليوم
                                  </h4>
                                  
                                  {(() => {
                                    const dayName = getDayName(trackingDate);
                                    const dayNutrition = selectedClient.plans?.weeklyPlan?.[dayName]?.nutrition || [];
                                    const progress = selectedClient.dailyProgress?.[trackingDate]?.mealsCompleted || [];
                                    
                                    if (dayNutrition.length === 0) {
                                      return <p className="text-sm text-slate-500 italic text-center py-4">لا يوجد وجبات مجدولة لهذا اليوم.</p>;
                                    }

                                    return (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {dayNutrition.map((meal, idx) => {
                                          const isCompleted = progress.includes(idx);
                                          return (
                                            <div key={idx} className={`p-4 rounded-3xl border transition-all flex items-center justify-between gap-4 ${isCompleted ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900 border-white/5'}`}>
                                              <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                                  <Utensils size={18} />
                                                </div>
                                                <div>
                                                  <p className={`font-bold text-sm ${isCompleted ? 'text-green-400' : 'text-slate-200'}`}>{meal.name}</p>
                                                  <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{meal.items}</p>
                                                </div>
                                              </div>
                                              <button 
                                                onClick={() => toggleTaskStatus(selectedClient.uid, trackingDate, idx, 'meal')}
                                                className={`p-2 rounded-xl transition-all ${isCompleted ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                              >
                                                <Check size={20} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                          </>
                        ) : (
                          <div className="p-20 text-center space-y-4 bg-slate-800/20 rounded-[2rem] border border-dashed border-white/5">
                            <RefreshCw size={48} className="mx-auto text-slate-700 animate-spin-slow" />
                            <p className="text-slate-500 font-bold italic">لا توجد سجلات قياسات دورية لهذا العميل بعد.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
                {expandedClient === client.uid && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-white/5 bg-slate-900/20"
                  >
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        {predictionResults[client.uid] && (
                          <div className="mb-6 p-4 bg-purple-600/10 border border-purple-500/20 rounded-3xl relative">
                            <button onClick={() => setPredictionResults(prev => {
                              const next = {...prev};
                              delete next[client.uid];
                              return next;
                            })} className="absolute top-2 right-2 text-slate-500 hover:text-white"><X size={12}/></button>
                            <h4 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                              <Zap size={14} /> لوحة توقعات الذكاء الاصطناعي (Elite Analytics)
                            </h4>
                            <div className="text-xs text-slate-300 prose prose-invert max-w-none">
                              <Markdown>{predictionResults[client.uid]}</Markdown>
                            </div>
                          </div>
                        )}
                        <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                          <FileText size={16} />
                          بيانات الاستبيان
                        </h4>
                        {client.onboardingData ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-500">الوزن</p>
                                <p className="font-bold text-white">{client.onboardingData.weight} كجم</p>
                              </div>
                              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-500">الطول</p>
                                <p className="font-bold text-white">{client.onboardingData.height} سم</p>
                              </div>
                              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-500">السن</p>
                                <p className="font-bold text-white">{calculateAge(client.onboardingData.birthDate)} سنة</p>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl">
                              <p className="text-xs text-slate-500 mb-1">تاريخ الميلاد</p>
                              <p className="font-bold text-white">{client.onboardingData.birthDate}</p>
                            </div>
                            {client.onboardingData.hasInjury && (
                              <div className="bg-red-600/10 border border-red-500/20 p-4 rounded-xl">
                                <p className="text-xs font-bold text-red-500 mb-1 flex items-center gap-2">
                                  <CircleAlert size={14} /> إصابة مسجلة
                                </p>
                                <p className="text-sm text-slate-300">{client.onboardingData.injuryDescription}</p>
                              </div>
                            )}
                            <div className="bg-slate-800/50 p-4 rounded-xl">
                              <p className="text-xs text-slate-500 mb-1">الهدف</p>
                              <p className="font-bold text-blue-400">
                                {client.onboardingData.goal === 'shape' ? 'تحسين القوام' :
                                 client.onboardingData.goal === 'loss' ? 'خسارة وزن' :
                                 client.onboardingData.goal === 'bulk' ? 'تضخيم عضلي' :
                                 client.onboardingData.goal === 'fitness' ? 'لياقة بدنية' : 'تأهيل إصابة'}
                              </p>
                            </div>
                            {client.onboardingData.notes && (
                              <div className="bg-slate-800/50 p-4 rounded-xl">
                                <p className="text-xs text-slate-500 mb-1">ملاحظات</p>
                                <p className="text-sm text-slate-300">{client.onboardingData.notes}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-600 italic">لم يكمل الاستبيان بعد</p>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                          <Activity size={16} />
                          تفاصيل الباقة
                        </h4>
                        <div className="space-y-2">
                          {client.packages?.workout && <p className="text-sm">باقة التمرين: <span className="text-white font-bold">{client.packages.workout.months} شهر</span></p>}
                          {client.packages?.nutrition && <p className="text-sm">باقة التغذية: <span className="text-white font-bold">{client.packages.nutrition.months} شهر</span></p>}
                          {client.packages?.rehab && <p className="text-sm">باقة التأهيل: <span className="text-white font-bold">{client.packages.rehab.months} شهر</span></p>}
                          {client.packages?.ems && <p className="text-sm">باقة EMS: <span className="text-white font-bold">{client.packages.ems.sessions} جلسة</span></p>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
        {/* ── End: Tab العملاء ────── */}
        </>}

        {/* ── Tab: حضور EMS ──────────────────────────────────────── */}
        {adminMainTab === 'ems' && (
          <EMSAttendance clients={clients} />
        )}

        {/* ── Tab: العضويات ──────────────────────────────────────── */}
        {adminMainTab === 'memberships' && (
          <MembershipManager />
        )}

        {/* ── Tab: المالية ────────────────────────────────────────── */}
        {adminMainTab === 'finance' && (
          <FinancialDashboard clients={clients} />
        )}

        {/* Add Client Modal */}
        <AnimatePresence>
          {isAdding && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <h3 className="text-3xl font-bold text-white mb-8">إضافة مشترك جديد</h3>
                <form onSubmit={handleAddClient} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">الاسم بالكامل</label>
                      <input
                        required
                        type="text"
                        className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">النوع (الجنس)</label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'male'})}
                          className={`flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border ${
                            formData.gender === 'male'
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                              : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <Users size={18} />
                          <span>ذكر Male</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'female'})}
                          className={`flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border ${
                            formData.gender === 'female'
                              ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/20'
                              : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <Users size={18} />
                          <span>أنثى Female</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">البريد الإلكتروني</label>
                    <input
                      required
                      type="email"
                      className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all ltr"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-4">تخصيص الباقات</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Workout */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.workout ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg accent-blue-600"
                            checked={formData.packages.workout}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, workout: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التمرين</span>
                        </label>
                        {formData.packages.workout && (
                          <select 
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            value={formData.workoutMonths}
                            onChange={e => setFormData({...formData, workoutMonths: parseInt(e.target.value)})}
                          >
                            <option value={1}>شهر واحد</option>
                            <option value={3}>3 شهور</option>
                            <option value={6}>6 شهور</option>
                            <option value={12}>سنة كاملة</option>
                          </select>
                        )}
                      </div>

                      {/* Nutrition */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.nutrition ? 'bg-green-600/10 border-green-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg accent-green-600"
                            checked={formData.packages.nutrition}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, nutrition: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التغذية</span>
                        </label>
                        {formData.packages.nutrition && (
                          <select 
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            value={formData.nutritionMonths}
                            onChange={e => setFormData({...formData, nutritionMonths: parseInt(e.target.value)})}
                          >
                            <option value={1}>شهر واحد</option>
                            <option value={3}>3 شهور</option>
                            <option value={6}>6 شهور</option>
                          </select>
                        )}
                      </div>

                      {/* Rehab */}
                      <div className={`p-4 rounded-3xl border transition-all ${formData.packages.rehab ? 'bg-red-600/10 border-red-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg accent-red-600"
                            checked={formData.packages.rehab}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, rehab: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة التأهيل</span>
                        </label>
                        {formData.packages.rehab && (
                          <select 
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            value={formData.rehabMonths}
                            onChange={e => setFormData({...formData, rehabMonths: parseInt(e.target.value)})}
                          >
                            <option value={1}>شهر واحد</option>
                            <option value={3}>3 شهور</option>
                          </select>
                        )}
                      </div>

                      {/* EMS */}
                      <div className={`p-4 rounded-3xl border transition-all col-span-1 sm:col-span-2 ${formData.packages.ems ? 'bg-purple-600/10 border-purple-500' : 'bg-slate-800/50 border-white/5'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg accent-purple-600"
                            checked={formData.packages.ems}
                            onChange={e => setFormData({...formData, packages: {...formData.packages, ems: e.target.checked}})}
                          />
                          <span className="font-bold text-white">باقة EMS</span>
                        </label>
                        {formData.packages.ems && (
                          membershipsRegistry.length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className="w-full bg-slate-900 border border-purple-500/30 rounded-xl px-3 py-2 text-sm text-white"
                                value={formData.emsMembershipId}
                                onChange={e => {
                                  const mem = membershipsRegistry.find(m => m.id === e.target.value);
                                  setFormData({
                                    ...formData,
                                    emsMembershipId: e.target.value,
                                    emsSessions: mem?.totalSessions || formData.emsSessions
                                  });
                                }}
                              >
                                <option value="">-- اختر العضوية --</option>
                                {membershipsRegistry.filter(m => m.isActive).map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} — {m.totalSessions} جلسة — {m.price.toLocaleString()} ج.م
                                  </option>
                                ))}
                              </select>
                              {formData.emsMembershipId && (() => {
                                const mem = membershipsRegistry.find(m => m.id === formData.emsMembershipId);
                                return mem ? (
                                  <div className="flex gap-3 text-xs text-purple-300 bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                                    <span>💜 {mem.name}</span><span>•</span>
                                    <span>{mem.totalSessions} جلسة</span><span>•</span>
                                    <span>{mem.price.toLocaleString()} ج.م</span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <input 
                              type="number"
                              placeholder="عدد الجلسات"
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              value={formData.emsSessions}
                              onChange={e => setFormData({...formData, emsSessions: parseInt(e.target.value) || 0})}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">كلمة المرور المؤقتة</label>
                    <input
                      required
                      type="password"
                      className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all ltr"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-xl shadow-blue-600/20"
                    >
                      {loading ? 'جاري الحفظ...' : 'تأكيد الإضافة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-bold transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
          {/* Targeted Notification Modal */}
          <AnimatePresence>
            {showNotificationModal && notificationTarget && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowNotificationModal(false)}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      <Bell className="text-blue-500" />
                      إرسال تنبيه إلى {notificationTarget.name}
                    </h3>
                    <button onClick={() => setShowNotificationModal(false)} className="text-slate-500 hover:text-white">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">نوع التنبيه</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'custom', label: 'مخصص', icon: <Zap size={14} /> },
                          { id: 'birthday', label: 'عيد ميلاد', icon: <Calendar size={14} /> },
                          { id: 'inactivity', label: 'تحفيز (غياب)', icon: <Activity size={14} /> },
                          { id: 'plan_update', label: 'تحديث خطة', icon: <FileText size={14} /> }
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setNotificationForm({ ...notificationForm, type: type.id as any })}
                            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all ${
                              notificationForm.type === type.id 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                              : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/20'
                            }`}
                          >
                            {type.icon}
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">العنوان</label>
                      <input
                        type="text"
                        value={notificationForm.title}
                        onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-all font-bold"
                        placeholder="أدخل عنوان التنبيه..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">الرسالة</label>
                      <textarea
                        value={notificationForm.message}
                        onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm h-32 outline-none focus:border-blue-500 transition-all leading-relaxed"
                        placeholder="اكتب رسالتك التحفيزية هنا..."
                      />
                    </div>

                    <button
                      disabled={loading || !notificationForm.title || !notificationForm.message}
                      onClick={handleSendNotification}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[1.5rem] font-bold text-lg shadow-xl shadow-blue-600/30 transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {loading ? <RefreshCw className="animate-spin" /> : <Bell size={20} />}
                      إرسال التنبيه الآن
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        {/* Physical Assessment Tests Modal */}
        <AnimatePresence>
          {showPhysicalTestsModal && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPhysicalTestsModal(false)}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full max-w-2xl bg-slate-900 border border-pink-500/20 rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <Scale className="text-pink-400" size={22} />
                    اختبارات التقييم البدني المخصصة
                  </h2>
                  <button onClick={() => setShowPhysicalTestsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={22} />
                  </button>
                </div>

                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  تم توليد هذه الاختبارات بالذكاء الاصطناعي بناءً على ملف <span className="text-pink-400 font-bold">{selectedClient?.name}</span>. يمكنك تعديل الأسماء والأوصاف قبل الإرسال.
                </p>

                <div className="space-y-3 mb-6">
                  {generatedTests.map((test, idx) => (
                    <div key={idx} className="bg-slate-800/60 border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-pink-600/30 text-pink-400 rounded-lg text-xs font-black flex items-center justify-center">{idx + 1}</span>
                        <input
                          className="flex-1 bg-transparent text-white font-bold text-sm outline-none border-b border-white/10 focus:border-pink-500 transition-colors pb-1"
                          value={test.name}
                          onChange={e => {
                            const updated = [...generatedTests];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setGeneratedTests(updated);
                          }}
                        />
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-lg">{test.measurement}</span>
                        <button
                          onClick={() => setGeneratedTests(generatedTests.filter((_, i) => i !== idx))}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        className="w-full bg-transparent text-slate-400 text-xs outline-none"
                        value={test.description}
                        onChange={e => {
                          const updated = [...generatedTests];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setGeneratedTests(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPhysicalTestsModal(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleConfirmPhysicalAssessment}
                    disabled={loading || generatedTests.length === 0}
                    className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-pink-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    إرسال للعميل وتفعيل التقييم
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        </AnimatePresence>
      </main>
    </div>
  );
}
