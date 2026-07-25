import React, { useState, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, OnboardingData } from '../types';
import { compressImage } from '../lib/imageUtils';
import { ChevronLeft, ChevronRight, Check, Mic, Upload, Activity, Target, User, Lock, Dumbbell, Calendar, CircleAlert, Square, MessageCircle, Phone, Camera, Sparkles, ArrowRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { BodyMap } from './BodyMap';
import { safeGenerateContent } from '../services/aiMasterEngine';

interface OnboardingProps {
  profile: UserProfile;
}

export default function Onboarding({ profile }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [localImagePreviews, setLocalImagePreviews] = useState<string[]>([]);
  const [tempAudioURL, setTempAudioURL] = useState<string | null>(null);
  const [tempAudioBlob, setTempAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [data, setData] = useState<Partial<OnboardingData>>(() => {
    // Pre-fill from any previously saved onboarding data so the client
    // doesn't have to re-enter info they already provided.
    const saved: Partial<OnboardingData> = profile.onboardingData ?? {};
    return {
      height: saved.height ?? (undefined as any),
      weight: saved.weight ?? (undefined as any),
      birthDate: saved.birthDate || '',
      gender: saved.gender || profile.gender || 'male',
      hasInjury: saved.hasInjury ?? false,
      goal: saved.goal || 'shape',
      painPoints: saved.painPoints || [],
      notes: saved.notes || '',
      injuryDescription: saved.injuryDescription || '',
      images: saved.images || [],
      inBodyPhoto: saved.inBodyPhoto,
      workoutDuration: saved.workoutDuration || 60,
      trainingLocation: saved.trainingLocation || 'gym',
      homeEquipment: saved.homeEquipment || '',
      likes: saved.likes || '',
      dislikes: saved.dislikes || '',
      hasAgreedToWaiver: saved.hasAgreedToWaiver ?? false,
      manualInBody: saved.manualInBody,
      inBodyExtracted: saved.inBodyExtracted,
    };
  });

  // Local state for the InBody photo upload feedback (step 2).
  const [inBodyUploading, setInBodyUploading] = useState(false);
  // Pre-fill preview from saved inBodyPhoto URL if available
  const [inBodyPreview, setInBodyPreview] = useState<string | null>(profile.onboardingData?.inBodyPhoto || null);
  const inBodyInputRef = useRef<HTMLInputElement>(null);

  // ─── Mandatory at registration: phone + avatar ──────────────────────
  // Captured on step 1 so the coach has a way to reach the client and
  // every chat / leaderboard / champions feed shows a real face.
  const [phone, setPhone] = useState<string>(profile.phone || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.profilePicUrl || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);


  // ─── Helper: upload base64 to Firebase Storage via server ───────────
  // allowBase64Fallback=true: if Firebase Storage bucket isn't provisioned yet,
  // the server returns the compressed data URL directly so Firestore can store it.
  const uploadToStorage = async (
    base64DataUrl: string,
    path: string,
    contentType = 'image/jpeg',
    allowBase64Fallback = true,
  ): Promise<string> => {
    const apiBase = (import.meta as any).env?.BASE_URL || '/';
    const res = await fetch(`${apiBase}api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64DataUrl, path, contentType, allowBase64Fallback }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed (${res.status})`);
    }
    const { url } = await res.json();
    return url as string;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const compressedBlob = await compressImage(file, 600, 0.8);
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(compressedBlob);
      });
      // Upload to Firebase Storage to avoid storing large base64 in Firestore
      const ts = Date.now();
      const storageUrl = await uploadToStorage(
        dataUrl,
        `avatars/${profile.uid}_${ts}.jpg`,
        'image/jpeg',
      );
      setAvatarPreview(storageUrl);
    } catch (err: any) {
      alert('تعذر رفع الصورة: ' + (err?.message || String(err)));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Egyptian/Saudi-friendly phone validation: must be 9-15 digits, optional leading +.
  const isPhoneValid = (p: string) => /^\+?\d{9,15}$/.test(p.replace(/\s|-/g, ''));

  const tips = [
    "شرب الماء بانتظام يحسن من أدائك الرياضي بنسبة 20%.",
    "النوم الكافي هو المفتاح الحقيقي لبناء العضلات وحرق الدهون.",
    "الاستمرارية أهم من الكثافة؛ ابدأ صغيراً واستمر.",
    "التنفس الصحيح أثناء التمرين يقلل من خطر الإصابة.",
    "وجبة ما بعد التمرين ضرورية لترميم الألياف العضلية."
  ];

  const [currentTip, setCurrentTip] = useState(0);

  React.useEffect(() => {
    if (isSubmitted) {
      const interval = setInterval(() => {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isSubmitted]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalSteps = 5;

  const handleNext = () => {
    // Force step 4 (Health Status) to show after step 3 (Goal)
    // We remove the conditional skipping to ensure the body map is always accessible
    if (step === 3) {
      setStep(4);
      return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setTempAudioBlob(audioBlob);
        setTempAudioURL(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('يرجى السماح بالوصول للميكروفون للتسجيل');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const confirmAudio = async () => {
    if (!tempAudioBlob) return;
    setUploading(true);
    setUploadStatus('1. جاري التحضير...');
    try {
      // 1) Convert blob to base64 data URL.
      setUploadStatus('2. معالجة التسجيل...');
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(tempAudioBlob);
      });

      // 2) Save AUDIO into a dedicated field (NOT into the free-text notes).
      //    The previous version concatenated the entire base64 blob into
      //    `notes`, which is why the admin saw garbage strings.
      const mime = tempAudioBlob.type || 'audio/webm';
      setData(prev => ({
        ...prev,
        voiceNote: base64Data,
        voiceNoteMime: mime,
      }));

      // 3) Auto-transcribe with Gemini so the coach can read it later.
      //    Failure here is non-fatal — the audio is still saved.
      setUploadStatus('3. تفريغ الصوت تلقائياً...');
      try {
        const base = (import.meta as any).env?.BASE_URL || '/';
        const res = await fetch(`${base}api/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: mime,
            language: 'ar',
            summarize: false,
          }),
        });
        if (res.ok) {
          const { transcript } = await res.json();
          if (transcript) {
            setData(prev => ({ ...prev, voiceTranscript: transcript }));
          }
        }
      } catch (txErr) {
        console.warn('[Onboarding] transcription skipped:', txErr);
      }

      setTempAudioURL(null);
      setTempAudioBlob(null);
      setUploadStatus('تم!');
    } catch (err: any) {
      console.error('Audio upload error:', err);
      alert('خطأ في حفظ التسجيل: ' + (err.message || String(err)));
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };
  const cancelAudio = () => {
    setTempAudioURL(null);
    setTempAudioBlob(null);
  };

  const togglePainPoint = (id: string) => {
    setData(prev => {
      const current = prev.painPoints || [];
      const next = current.includes(id) 
        ? current.filter(p => p !== id) 
        : [...current, id];
      return { ...prev, painPoints: next, hasInjury: next.length > 0 };
    });
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalImagePreviews(prev => [...prev, previewUrl]);

    setUploading(true);
    setUploadStatus('1. جاري التحضير...');
    try {
      setUploadStatus('2. ضغط للصورة...');
      // 900px / 0.75 keeps photos crisp enough for lightbox viewing while
      // staying well under the 400 KB inline-fallback limit (~150-250 KB binary).
      const compressedBlob = await compressImage(file, 900, 0.75);
      // Convert to base64
      setUploadStatus('3. تحويل البيانات...');
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      setUploadStatus('رفع على السحابة...');
      const ts = Date.now();
      const idx = (data.images?.length || 0);
      const path = `progress/${profile.uid}/${ts}_${idx}.jpg`;
      let storageUrl: string | null = null;
      try {
        storageUrl = await uploadToStorage(base64Data, path, 'image/jpeg');
      } catch {
        // Fallback: smaller compression (650px / 0.65 ≈ 60-100 KB binary)
        setUploadStatus('ضغط أصغر...');
        const tinyBlob = await compressImage(file, 650, 0.65);
        const r2 = new FileReader();
        const b64tiny = await new Promise<string>((res, rej) => {
          r2.onload = () => res(r2.result as string);
          r2.onerror = rej;
          r2.readAsDataURL(tinyBlob);
        });
        try {
          storageUrl = await uploadToStorage(b64tiny, path, 'image/jpeg');
        } catch (err2: any) {
          // Both failed — keep local preview, continue silently
          console.warn('[Onboarding] Progress photo upload failed:', err2?.message);
        }
      }
      if (storageUrl) {
        setData(prev => ({ ...prev, images: [...(prev.images || []), storageUrl!] }));
      }
      setUploadStatus('تم!');
    } catch (error: any) {
      console.error('[Onboarding] Progress photo error:', error);
    } finally {
      setUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Uploads the InBody printout photo to Firebase Storage (via /api/upload)
   * and stores the public URL in `data.inBodyPhoto`. Avoids base64 blobs in
   * Firestore which would hit the 1 MB document limit.
   */
  const handleInBodyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInBodyUploading(true);
    setUploadStatus('جاري ضغط صورة الـ InBody...');
    try {
      // Show local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setInBodyPreview(previewUrl);

      // ── Step 1: Compress high-quality for OCR ──────────────────────────
      const compressedBlob = await compressImage(file, 1600, 0.88);

      // ── Step 2: Fire OCR IMMEDIATELY — independent of upload success ───
      // OCR reads from the in-memory blob, so it never depends on storage.
      void analyzeInBodyPhoto(compressedBlob);

      // ── Step 3: Upload — try high quality then smaller fallback ────────
      const ts = Date.now();
      const path = `inbody/${profile.uid}/${ts}.jpg`;
      let storageUrl: string | null = null;

      // Attempt A: 1600px / 0.88 (preferred)
      try {
        setUploadStatus('رفع الصورة على السحابة...');
        const reader = new FileReader();
        const base64Hi = await new Promise<string>((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(compressedBlob);
        });
        storageUrl = await uploadToStorage(base64Hi, path, 'image/jpeg');
      } catch {
        // Attempt B: 850px / 0.70 — smaller file for the inline fallback
        try {
          setUploadStatus('جاري ضغط أصغر للحفظ...');
          const smallBlob = await compressImage(file, 850, 0.70);
          const reader2 = new FileReader();
          const base64Lo = await new Promise<string>((res, rej) => {
            reader2.onload = () => res(reader2.result as string);
            reader2.onerror = rej;
            reader2.readAsDataURL(smallBlob);
          });
          storageUrl = await uploadToStorage(base64Lo, path, 'image/jpeg');
        } catch (err2: any) {
          // Both failed — OCR is still running; coach won't see the photo
          // but the extracted numbers will still populate the form.
          console.warn('[Onboarding] All InBody upload attempts failed:', err2?.message);
        }
      }

      if (storageUrl) {
        setData(prev => ({ ...prev, inBodyPhoto: storageUrl! }));
      }
      setUploadStatus('تم! جاري تحليل الصورة...');
    } catch (err: any) {
      console.error('[Onboarding] InBody upload error:', err);
    } finally {
      setInBodyUploading(false);
      setUploadStatus('');
      if (inBodyInputRef.current) inBodyInputRef.current.value = '';
    }
  };

  // ─── InBody Vision OCR (auto-extract on upload) ─────────────────────
  // Mirrors the proven NutritionSurvey.analyzeInBody helper but writes the
  // extracted numbers into `data.inBodyExtracted` so they round-trip into
  // the user doc and the coach can see them in the dashboard.
  const [inBodyOcrStatus, setInBodyOcrStatus] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const analyzeInBodyPhoto = async (blob: Blob | File) => {
    setInBodyOcrStatus('busy');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const mimeType = blob.type || 'image/jpeg';
      const prompt = `You are an expert at reading InBody body composition reports (Arabic and English).
Look carefully at this InBody report image and extract the following values.
Return ONLY a valid JSON object with no additional text, markdown, or explanation:
{
  "weight": <Body Weight in kg as a number>,
  "fatPercentage": <Percent Body Fat or Body Fat % as a number>,
  "muscleMass": <Skeletal Muscle Mass or Lean Body Mass in kg as a number>,
  "waterPercentage": <Total Body Water % as a number, or 0 if not shown>,
  "protein": <Protein in kg as a number, or 0 if not shown>
}
If a value is not visible or readable in the image, use 0. Do not include units in the values — numbers only.`;
      // Pass contents as an ARRAY so the server's /api/ai-service handler
      // picks up the parts correctly (the handler only spreads array items).
      const resp: any = await safeGenerateContent(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }, { inlineData: { data: base64, mimeType } }] }],
        undefined,
        { responseMimeType: 'application/json', temperature: 0.1 },
      );
      const text = resp?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : '{}');
      const extracted = {
        weight: Number(parsed.weight) || 0,
        fatPercentage: Number(parsed.fatPercentage) || 0,
        muscleMass: Number(parsed.muscleMass) || 0,
        waterPercentage: Number(parsed.waterPercentage) || 0,
        protein: Number(parsed.protein) || 0,
      };
      // Only commit when at least one field was actually read — otherwise
      // we'd overwrite manual entries with zeros.
      const anyExtracted = Object.values(extracted).some((v) => v > 0);
      if (anyExtracted) {
        setData((prev) => {
          // Pre-fill manualInBody fields that the user hasn't typed yet.
          // This makes the extracted values visible in the form inputs.
          const existingManual = prev.manualInBody || {} as any;
          const mergedManual = {
            weight:          (existingManual.weight          ?? 0) > 0 ? existingManual.weight          : extracted.weight,
            fatPercentage:   (existingManual.fatPercentage   ?? 0) > 0 ? existingManual.fatPercentage   : extracted.fatPercentage,
            muscleMass:      (existingManual.muscleMass      ?? 0) > 0 ? existingManual.muscleMass      : extracted.muscleMass,
            waterPercentage: (existingManual.waterPercentage ?? 0) > 0 ? existingManual.waterPercentage : extracted.waterPercentage,
            protein:         (existingManual.protein         ?? 0) > 0 ? existingManual.protein         : extracted.protein,
          };
          return {
            ...prev,
            inBodyExtracted: extracted,
            manualInBody: mergedManual,
            // Also sync top-level weight if user hasn't set it
            weight: prev.weight || extracted.weight || prev.weight,
          };
        });
        setInBodyOcrStatus('done');
      } else {
        setInBodyOcrStatus('failed');
      }
    } catch (err) {
      console.warn('[Onboarding] InBody OCR failed:', err);
      setInBodyOcrStatus('failed');
    }
  };

  const handleSubmit = async () => {
    if (!data.hasAgreedToWaiver) {
      alert('يرجى الموافقة على الإقرار الرقمي أولاً');
      return;
    }
    if (!data.height || !data.weight || !data.birthDate) {
      alert('يرجى إدخال تاريخ الميلاد والطول والوزن أولاً.');
      setStep(2);
      return;
    }
    if (!isPhoneValid(phone)) {
      alert('يرجى إدخال رقم هاتف صحيح (9-15 رقم).');
      setStep(1);
      return;
    }
    if (!avatarPreview) {
      alert('يرجى إضافة صورة شخصية حتى يستطيع الكوتش التعرف عليك.');
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      // Strip undefined values — Firestore rejects them and throws an error.
      // JSON round-trip removes undefined fields while keeping null/0/false/''
      const cleanData = JSON.parse(JSON.stringify({
        ...data,
        submittedAt: new Date().toISOString(),
      }));
      await updateDoc(doc(db, 'users', profile.uid), {
        onboardingData: cleanData,
        onboardingComplete: true,
        phone: phone.trim(),
        profilePicUrl: avatarPreview,
      });
      setIsSubmitted(true);
    } catch (error: any) {
      console.error('[Onboarding] save error:', error);
      alert('حدث خطأ أثناء حفظ البيانات: ' + (error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / totalSteps) * 100;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full space-y-8 py-12"
        >
          {/* Status Tracker */}
          <div className="w-full space-y-4 mb-12">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
              <span>إرسال البيانات</span>
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

          {/* April-2026 spec: removed the fake "فيديو ترحيبي من الكوتش"
              placeholder — it never played anything and the WhatsApp CTA
              below already covers the welcome touchpoint. Keeping the
              post-submit screen clean (per "redundant UI cleanup" rule). */}

          <div className="space-y-4">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">تم استلام بياناتك بنجاح!</h2>
            <p className="text-slate-400 text-lg max-w-lg mx-auto">أهلاً بك في الفريق. الكوتش يقوم الآن بمراجعة ملفك لتصميم خطتك المثالية.</p>
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

          {/* WhatsApp Contact */}
          <div className="pt-8 flex flex-col items-center gap-4">
            <a 
              href="https://wa.me/201558685502" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-green-600/10 border border-green-500/30 text-green-500 rounded-2xl font-bold hover:bg-green-600 hover:text-white transition-all group"
            >
              <span>تواصل مع الكوتش عبر واتساب</span>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <MessageCircle size={20} />
              </motion.div>
            </a>
            <p className="text-slate-500 text-xs">سيتم تفعيل حسابك خلال 24 ساعة كحد أقصى.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-900 z-50">
        <motion.div 
          className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                {/* Back to login */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5 transition-all"
                  >
                    <ArrowRight size={14} />
                    رجوع لتسجيل الدخول
                  </button>
                </div>
                <div className="flex justify-center flex-col items-center text-center">
                  <div className="p-4 bg-blue-600/20 text-blue-500 rounded-3xl mb-4"><Lock size={48} /></div>
                  <h2 className="text-3xl font-bold mb-2">أهلاً بك، {profile.name}</h2>
                  <p className="text-slate-400 max-w-sm leading-relaxed">
                    هنعمل تقييم سريع عشان نحدد برنامجك بدقة. كل سؤال هيساعد الكوتش يبني خطتك على المقاس.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setData({...data, gender: 'male'})}
                    className={`flex-1 py-6 rounded-[2rem] font-bold transition-all flex flex-col items-center justify-center gap-4 border-2 ${
                      data.gender === 'male'
                        ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-slate-900 border-white/5 text-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl ${data.gender === 'male' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      <User size={32} />
                    </div>
                    <div className="text-center">
                      <div className="text-lg">ذكر</div>
                      <div className="text-[10px] opacity-60 uppercase tracking-widest">Male</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setData({...data, gender: 'female'})}
                    className={`flex-1 py-6 rounded-[2rem] font-bold transition-all flex flex-col items-center justify-center gap-4 border-2 ${
                      data.gender === 'female'
                        ? 'bg-pink-600/10 border-pink-500 text-white shadow-lg shadow-pink-600/20'
                        : 'bg-slate-900 border-white/5 text-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`p-4 rounded-2xl ${data.gender === 'female' ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      <User size={32} />
                    </div>
                    <div className="text-center">
                      <div className="text-lg">أنثى</div>
                      <div className="text-[10px] opacity-60 uppercase tracking-widest">Female</div>
                    </div>
                  </button>
                </div>

                {/* ─── Mandatory: profile picture + phone ─── */}
                <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 space-y-5">
                  <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-widest">
                    <Camera size={14} /> صورتك ورقم تواصلك
                  </h3>

                  {/* Avatar uploader */}
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className={`relative w-28 h-28 rounded-full overflow-hidden border-2 transition-all ${
                        avatarPreview
                          ? 'border-blue-500 shadow-lg shadow-blue-600/30'
                          : 'border-dashed border-white/20 hover:border-blue-500'
                      } bg-slate-800 flex items-center justify-center`}
                      disabled={avatarUploading}
                    >
                      {avatarUploading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : avatarPreview ? (
                        <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <Camera size={28} />
                          <span className="text-[10px] font-bold">إضافة صورة</span>
                        </div>
                      )}
                    </button>
                    {/* Drop `capture="user"` so the OS shows BOTH the camera AND
                        the gallery picker. Mobile users couldn't pick an existing
                        photo before — they were forced into a live selfie. */}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => setAvatarPreview(null)}
                        className="text-xs text-red-400 hover:text-red-300 underline"
                      >
                        إزالة الصورة
                      </button>
                    )}
                    <p className="text-[11px] text-slate-500 text-center max-w-xs">
                      الصورة تساعد الكوتش على التعرف عليك وتظهر في صفحة الأبطال.
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-slate-400 text-xs font-bold flex items-center gap-2 mb-1">
                      <Phone size={14} /> رقم الهاتف (واتساب)
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="01012345678"
                      dir="ltr"
                      className={`w-full bg-slate-800 border rounded-xl p-3 text-white text-center font-bold tracking-wider outline-none transition-all ${
                        phone && !isPhoneValid(phone)
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-blue-500'
                      }`}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    {phone && !isPhoneValid(phone) && (
                      <p className="text-[11px] text-red-400">صيغة رقم غير صحيحة (9-15 رقم).</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!data.gender || !avatarPreview || !isPhoneValid(phone)}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 py-5 rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <span>ابدأ التقييم</span>
                  <ChevronLeft size={20} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">البيانات الشخصية</h2>
                  <p className="text-slate-400">المقاسات الحيوية مهمة لدقة خطتك</p>
                </div>
                <div className="space-y-6 bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                  <div className="space-y-2">
                    <label className="text-slate-400 text-sm font-bold flex items-center gap-2 mb-3"><Calendar size={16}/> تاريخ الميلاد</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-all text-center font-bold"
                      value={data.birthDate || ''}
                      onChange={e => setData({...data, birthDate: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-slate-400 text-sm font-bold block mb-2">الطول (سم)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="170"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-center text-xl font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={data.height ?? ''}
                        onChange={e => {
                          const v = e.target.value;
                          setData({...data, height: v === '' ? (undefined as any) : parseInt(v)});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-slate-400 text-sm font-bold block mb-2">الوزن (كجم)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="70"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-center text-xl font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={data.weight ?? ''}
                        onChange={e => {
                          const v = e.target.value;
                          setData({...data, weight: v === '' ? (undefined as any) : parseInt(v)});
                        }}
                      />
                    </div>
                  </div>

                  {/* InBody photo upload — moved up from step 5 so the coach
                      sees the printout before he ever opens the manual fields. */}
                  <div className="space-y-2 pt-2">
                    <label className="text-slate-400 text-sm font-bold flex items-center gap-2 mb-3">
                      <Upload size={16}/> صورة تقرير الـ InBody (اختياري)
                    </label>
                    <input
                      ref={inBodyInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleInBodyUpload}
                      className="hidden"
                    />
                    {data.inBodyPhoto || inBodyPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-800">
                        <img
                          src={data.inBodyPhoto || inBodyPreview || ''}
                          alt="InBody preview"
                          className="w-full max-h-64 object-contain bg-black"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => inBodyInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white text-[11px] font-bold border border-white/10"
                          >
                            تغيير
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setData(prev => ({ ...prev, inBodyPhoto: undefined }));
                              setInBodyPreview(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-bold border border-rose-500/30"
                          >
                            إزالة
                          </button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[11px] font-bold py-1.5 text-center flex items-center justify-center gap-1">
                          <Check size={12}/> تم حفظ صورة الـ InBody
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => inBodyInputRef.current?.click()}
                        disabled={inBodyUploading}
                        className="w-full p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-slate-800/50 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {inBodyUploading ? (
                          <>
                            <div className="w-7 h-7 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-[11px] text-slate-400 font-bold">جاري الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <div className="p-3 bg-blue-600/10 text-blue-400 rounded-2xl">
                              <Upload size={20} />
                            </div>
                            <span className="text-sm text-slate-300 font-bold">اضغط لرفع صورة الـ InBody</span>
                            <span className="text-[10px] text-slate-500">JPG / PNG — تظهر للكوتش بجودة عالية</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* مدة التمرين والبيئة تم نقلها لاستبيان التمارين لتفادي التكرار */}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">ما هو هدفك الأساسي؟</h2>
                  <p className="text-slate-400">اختر الوجهة التي تريد الوصول إليها</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'shape', label: 'شكل أفضل', icon: <User size={24} /> },
                    { id: 'loss', label: 'إنقاص وزن', icon: <Activity size={24} /> },
                    { id: 'bulk', label: 'تضخيم عضلي', icon: <Dumbbell size={24} /> },
                    { id: 'fitness', label: 'لياقة بدنية', icon: <Target size={24} /> },
                    { id: 'rehab', label: 'تأهيل إصابة', icon: <Activity size={24} /> }
                  ].map((goal) => (
                    <button 
                      key={goal.id} 
                      onClick={() => setData({...data, goal: goal.id as any, hasInjury: goal.id === 'rehab'})} 
                      className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${data.goal === goal.id ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10'}`}
                    >
                      {goal.icon}
                      <span className="font-bold">{goal.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">الإصابات والآلام العضلية</h2>
                  <p className="text-slate-400">ساعدنا في فهم حالتك لتصميم تمرين آمن</p>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  {/* Start Question */}
                  <div className="space-y-4">
                    <p className="text-center text-sm text-slate-500">هل تعاني من أي إصابات أو آلام عضلية حالياً؟</p>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setData({...data, hasInjury: true})} 
                        className={`flex-1 p-4 rounded-2xl border-2 transition-all font-bold ${data.hasInjury === true ? 'bg-red-600/10 border-red-500 text-white shadow-lg shadow-red-500/10' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                      >
                        نعم
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          setData({...data, hasInjury: false}); 
                          // Auto move to next step after a short delay if "No" selected
                          setTimeout(() => handleNext(), 300);
                        }} 
                        className={`flex-1 p-4 rounded-2xl border-2 transition-all font-bold ${data.hasInjury === false ? 'bg-green-600/10 border-green-500 text-white shadow-lg shadow-green-500/10' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {data.hasInjury && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-8 overflow-hidden"
                      >
                        <div className="bg-slate-800 p-4 rounded-2xl border border-red-500/20 flex items-start gap-3 mt-4">
                          <CircleAlert className="text-red-500 shrink-0" size={20} />
                          <p className="text-xs text-slate-400 leading-relaxed">يرجى تحديد مكان الألم على المجسم وشرح الإصابة بالتفصيل لمساعدة الكوتش.</p>
                        </div>
                        
                        {/* Pain Intensity Slider */}
                        <div className="space-y-4 text-center bg-slate-800/40 p-6 rounded-3xl border border-white/5">
                          <label className="text-sm font-bold text-slate-300">حدد شدة الألم (1-10)</label>
                          <div className="px-4 py-2">
                             <input 
                              type="range" 
                              min="1" 
                              max="10" 
                              step="1"
                              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                              style={{ accentColor: '#ef4444' }}
                              value={data.painIntensity || 5}
                              onChange={(e) => setData({ ...data, painIntensity: parseInt(e.target.value) })}
                             />
                             <div className="flex justify-between mt-4 px-1">
                                {[1,2,3,4,5,6,7,8,9,10].map(v => (
                                  <div key={v} className="flex flex-col items-center gap-1">
                                    <div className={`w-1 h-1 rounded-full ${data.painIntensity === v ? 'bg-red-500' : 'bg-slate-700'}`} />
                                    <span className={`text-[10px] ${data.painIntensity === v ? 'text-red-500 font-bold scale-125 transition-transform' : 'text-slate-600'}`}>{v}</span>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </div>

                        <BodyMap 
                          selectedParts={data.painPoints || []} 
                          onTogglePart={togglePainPoint} 
                        />

                        <div className="space-y-3">
                          <label className="text-xs text-slate-500 font-bold pr-1 block">اشرح لنا بالتفصيل طبيعة الإصابة أو أي معلومات إضافية تود ذكرها كابتن</label>
                          <textarea 
                            placeholder="مثلاً: نوع الإصابة، تاريخها، هل أجريت أي عمليات جراحية؟" 
                            className="w-full bg-slate-800 border border-white/10 rounded-2xl p-6 h-40 outline-none focus:border-red-500 transition-all resize-none text-white leading-relaxed"
                            value={data.injuryDescription}
                            onChange={e => setData({...data, injuryDescription: e.target.value})}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">الوسائط والملاحظات</h2>
                  <p className="text-slate-400">أضف أي تفاصيل إضافية للكوتش</p>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    {tempAudioURL ? (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-blue-600/10 border border-blue-500/30 rounded-3xl space-y-4">
                        <p className="text-center text-sm font-bold text-blue-400">معاينة التسجيل الصوتي</p>
                        <audio src={tempAudioURL} controls className="w-full h-10" />
                        <div className="flex gap-3">
                          <button onClick={confirmAudio} disabled={uploading} className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-sm transition-all">
                            {uploading ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
                          </button>
                          <button onClick={cancelAudio} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold text-sm transition-all text-slate-400">إلغاء</button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex flex-col items-center gap-3 p-8 border rounded-3xl transition-all ${isRecording ? 'bg-red-600/20 border-red-500 animate-pulse' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800'}`}
                        >
                          {isRecording ? <Square className="text-red-500" size={32} /> : <Mic className="text-blue-500" size={32} />}
                          <span className="text-sm font-bold">{isRecording ? 'جاري التسجيل...' : 'رسالة صوتية'}</span>
                          {isRecording && (
                            <div className="flex gap-1 mt-2">
                              {[1,2,3,4].map(i => (
                                <motion.div 
                                  key={i}
                                  animate={{ height: [4, 12, 4] }}
                                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                  className="w-1 bg-red-500 rounded-full"
                                />
                              ))}
                            </div>
                          )}
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex flex-col items-center gap-3 p-8 bg-slate-900/50 border border-white/5 rounded-3xl hover:bg-slate-800 transition-all disabled:opacity-50"
                        >
                          <Upload className="text-green-500" size={32} />
                          <span className="text-sm font-bold">{uploading ? 'جاري الرفع...' : 'رفع صور'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea placeholder="اكتب ملاحظاتك هنا..." className="w-full bg-slate-900/50 border border-white/5 rounded-3xl p-6 h-32 outline-none focus:border-blue-500 transition-all resize-none" value={data.notes} onChange={e => setData({...data, notes: e.target.value})} />

                  {/* Manual InBody fallback — used when the photo isn't readable */}
                  <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        <Activity size={18} />
                      </div>
                      <div className="space-y-1 flex-1">
                        <h4 className="font-bold text-sm">قياسات الـ InBody (يدوي — اختياري)</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">لو صورة الـ InBody مش واضحة أو مش متاحة دلوقتي، تقدر تكتب الأرقام يدوياً عشان الكوتش يبدأ بيك على طول.</p>
                        {/* OCR status badge */}
                        {inBodyOcrStatus === 'busy' && (
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-blue-400 font-semibold animate-pulse">
                            <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                            جاري تحليل صورة الـ InBody بالذكاء الاصطناعي...
                          </div>
                        )}
                        {inBodyOcrStatus === 'done' && (
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-green-400 font-semibold">
                            <Check size={13} />
                            تم استخراج الأرقام تلقائياً من الصورة — راجعها وعدّل لو محتاج
                          </div>
                        )}
                        {inBodyOcrStatus === 'failed' && (
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-amber-400 font-semibold">
                            <Activity size={13} />
                            تعذر قراءة الأرقام تلقائياً — يرجى إدخالها يدوياً
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'weight',           label: 'الوزن (كجم)',  step: '0.1' },
                        { key: 'fatPercentage',    label: 'نسبة الدهون %', step: '0.1' },
                        { key: 'muscleMass',       label: 'الكتلة العضلية (كجم)', step: '0.1' },
                        { key: 'waterPercentage',  label: 'نسبة الماء %', step: '0.1' },
                        { key: 'protein',          label: 'البروتين (كجم)', step: '0.1' },
                      ].map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">{field.label}</label>
                          <input
                            type="number"
                            step={field.step}
                            inputMode="decimal"
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500 transition-all text-center font-bold"
                            value={(data.manualInBody as any)?.[field.key] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v = raw === '' ? undefined : parseFloat(raw);
                              setData(prev => ({
                                ...prev,
                                manualInBody: { ...(prev.manualInBody || {}), [field.key]: v },
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {(localImagePreviews.length > 0 || (data.images && data.images.length > 0)) && (
                    <div className="flex gap-2 overflow-x-auto py-2">
                      {/* Show finalized images or local previews */}
                      {(data.images || []).length >= localImagePreviews.length ? (
                        data.images?.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 border-green-500">
                            <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute top-1 right-1 p-0.5 bg-green-500 rounded-full text-white">
                              <Check size={10} />
                            </div>
                          </div>
                        ))
                      ) : (
                        localImagePreviews.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10">
                            <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            {i >= (data.images?.length || 0) && (
                              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-1 text-center gap-1">
                                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-[7px] text-white font-bold leading-tight">{uploadStatus || 'جاري الرفع...'}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-4">
                    <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest">إقرار وتوقيع رقمي</h4>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${data.hasAgreedToWaiver ? 'bg-blue-600 border-blue-600' : 'border-white/10 group-hover:border-white/20'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={data.hasAgreedToWaiver}
                          onChange={e => setData({...data, hasAgreedToWaiver: e.target.checked})}
                        />
                        {data.hasAgreedToWaiver && <Check size={14} />}
                      </div>
                      <span className="text-sm text-slate-300 leading-relaxed">
                        أقر بأن كافة البيانات الصحية والبدنية المسجلة أعلاه صحيحة تماماً وعلى مسؤوليتي الشخصية، وأتحمل المسؤولية الكاملة عن أي تبعات ناتجة عن إخفاء أي معلومة طبية.
                      </span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step > 1 && (
            <div className="mt-12 flex gap-4">
              <button onClick={handleBack} className="p-4 bg-slate-900 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all"><ChevronRight size={24} /></button>
              {step === totalSteps ? (
                <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-600/20 transition-all flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={20} /><span>إرسال البيانات</span></>}
                </button>
              ) : (
                <button onClick={handleNext} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2">
                  <span>التالي</span><ChevronLeft size={20} />
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
    </div>
  );
}
