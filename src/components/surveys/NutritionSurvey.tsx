import React, { useState, useRef } from 'react';
import { Clock, Utensils, Droplets, Ruler, Info, Camera, FileText, Zap, CircleAlert, Upload, CheckCircle2, ArrowLeft, Plus, Trash2, Mic, Square, Loader2 } from 'lucide-react';
import { NutritionSurveyData, DailyLogEntry, GeneralMedicalHistory } from '../../types';
import { motion } from 'motion/react';
import { safeGenerateContent } from '../../services/aiMasterEngine';
import { compressImage, validateInBodyImage } from '../../lib/imageUtils';
import TimePicker from '../ui/TimePicker';
import GeneralMedicalForm from './GeneralMedicalForm';
import { playClick, playSuccess, playError } from '../../lib/sounds';

interface NutritionSurveyProps {
  userId: string;
  gender: 'male' | 'female';
  initialData?: NutritionSurveyData;
  onComplete: (data: NutritionSurveyData) => void;
  isLoading?: boolean;
}

// Upload helper — mirrors the pattern used in Onboarding.tsx.
// Tries Firebase Storage first; falls back to inline base64 if Storage is
// not provisioned and the compressed file is small enough.
async function uploadPhoto(
  base64DataUrl: string,
  path: string,
  contentType = 'image/jpeg',
): Promise<string> {
  const apiBase = (import.meta as any).env?.BASE_URL || '/';
  const res = await fetch(`${apiBase}api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64DataUrl, path, contentType, allowBase64Fallback: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const { url } = await res.json();
  return url as string;
}

export default function NutritionSurvey({ userId, gender, initialData, onComplete, isLoading }: NutritionSurveyProps) {
  const defaultData: NutritionSurveyData = {
    timeline: { wakeup: '', work: '', workout: '', sleep: '', notes: '' },
    dailyLog: [{ time: '', activity: '' }],
    lifestyle: {
      sleepHours: 0,
      wakeHour: '',
      workShiftHours: 0,
      jobNature: '',
      insomnia: false,
      familyObesityHistory: false,
      dailyActivityLevel: '',
      workoutFrequencyPerWeek: 0,
    },
    habits: {
      mealsPerDay: 0,
      isConsistent: '' as any,
      sugarCravings: '' as any,
      peakHungerTimes: '',
      digestionIssues: ''
    },
    preferences: { likes: '', dislikes: '', allergies: [] },
    supplements: { waterLiters: 0, currentSupplements: '' },
    measurements: {
      chest: 0, waist: 0, arm: 0, thigh: 0,
      weight: 0, fatPercentage: 0, muscleMass: 0, waterPercentage: 0, protein: 0
    },
    photos: { front: '', side: '', inBody: '' },
    medical: { bloodPressure: false, diabetes: false, surgeries: false, surgeryDetails: '' }
  };

  const [data, setData] = useState<NutritionSurveyData>(() => {
    if (!initialData) return defaultData;
    return {
      ...defaultData,
      ...initialData,
      lifestyle: { ...defaultData.lifestyle, ...(initialData.lifestyle || {}) },
      habits: { ...defaultData.habits, ...(initialData.habits || {}) },
      preferences: { ...defaultData.preferences, ...(initialData.preferences || {}) },
      supplements: { ...defaultData.supplements, ...(initialData.supplements || {}) },
      measurements: { ...defaultData.measurements, ...(initialData.measurements || {}) },
      photos: { ...defaultData.photos, ...(initialData.photos || {}) },
      medical: { ...defaultData.medical, ...(initialData.medical || {}) } as typeof defaultData.medical,
      timeline: { ...defaultData.timeline, ...(initialData.timeline || {}) } as typeof defaultData.timeline,
      dailyLog: initialData.dailyLog?.length ? initialData.dailyLog : defaultData.dailyLog,
    };
  });

  const [uploading, setUploading] = useState<'front' | 'side' | 'inBody' | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoType, setActivePhotoType] = useState<'front' | 'side' | 'inBody' | null>(null);

  // Notes + voice dictation (Phase 2 / item #7). The mic captures speech via
  // MediaRecorder, posts the WebM blob to /api/transcribe (server uses
  // Gemini multimodal), and APPENDS the Arabic transcript into the
  // free-text `additionalNotes` field — never overwrites — so the user
  // can stack multiple recordings + manual edits.
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startNotesRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) { setIsTranscribing(false); return; }
        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const base64Data: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const base = (import.meta as any).env?.BASE_URL || '/';
          const res = await fetch(`${base}api/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: blob.type || 'audio/webm',
              language: 'ar',
              summarize: false,
            }),
          });
          if (!res.ok) throw new Error(`Transcription HTTP ${res.status}`);
          const { transcript } = await res.json();
          if (transcript) {
            setData(prev => ({
              ...prev,
              additionalNotes: prev.additionalNotes
                ? `${prev.additionalNotes}\n\n${transcript}`
                : transcript,
              notesVoiceTranscript: prev.notesVoiceTranscript
                ? `${prev.notesVoiceTranscript}\n\n${transcript}`
                : transcript,
            }));
          }
        } catch (err: any) {
          console.error('[NutritionSurvey] transcription failed:', err);
          alert('تعذّر تفريغ الصوت — اكتب ملاحظاتك يدوياً.');
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('[NutritionSurvey] mic permission denied:', err);
      alert('يرجى السماح بالوصول للميكروفون لتسجيل الملاحظات.');
    }
  };

  const stopNotesRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop(); } catch {}
      setIsRecording(false);
    }
  };

  const addLogEntry = () => {
    setData(prev => ({
      ...prev,
      dailyLog: [...prev.dailyLog, { time: '', activity: '' }]
    }));
  };

  const removeLogEntry = (index: number) => {
    if (data.dailyLog.length > 1) {
      setData(prev => ({
        ...prev,
        dailyLog: prev.dailyLog.filter((_, i) => i !== index)
      }));
    }
  };

  const updateLogEntry = (index: number, field: keyof DailyLogEntry, value: string) => {
    const nextLog = [...data.dailyLog];
    nextLog[index] = { ...nextLog[index], [field]: value };
    setData(prev => ({ ...prev, dailyLog: nextLog }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'side' | 'inBody') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!userId) {
      console.error('UserId is missing - cannot upload');
      alert('خطأ في تحديد هوية المستخدم. يرجى إعادة تسجيل الدخول.');
      return;
    }

    // InBody must be a real, legible report — block tiny / corrupt files up
    // front so we don't waste an OCR roundtrip and so the client retakes
    // the photo before continuing the questionnaire.
    if (type === 'inBody') {
      const validationError = validateInBodyImage(file);
      if (validationError) {
        alert(validationError);
        return;
      }
    }

    // Create local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [type]: previewUrl }));

    // REQUIREMENT: Replace the green square immediately
    setData(prev => ({
      ...prev,
      photos: { ...prev.photos, [type]: previewUrl }
    }));

    setUploading(type);
    setUploadStatus('جاري الضغط...');
    try {
      // ── Step 1: Compress ────────────────────────────────────────────
      // InBody: high quality for OCR legibility.
      // Body shots: smaller for faster upload and fallback size limit.
      const isReport = type === 'inBody';
      const compressedBlob = await compressImage(
        file,
        isReport ? 1600 : 900,
        isReport ? 0.88 : 0.75,
      );

      // ── Step 2: Trigger OCR immediately (doesn't depend on upload) ──
      if (type === 'inBody') {
        analyzeInBody(compressedBlob).catch(e => console.error('[NutritionSurvey] InBody OCR error:', e));
      }

      // ── Step 3: Convert to base64 ───────────────────────────────────
      setUploadStatus('رفع على السحابة...');
      const reader = new FileReader();
      const base64Hi = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      // ── Step 4: Upload (try high quality, then smaller fallback) ────
      const ts = Date.now();
      const folderName = type === 'inBody' ? 'inbody' : 'progress';
      const path = `${folderName}/${userId}/${ts}_${type}.jpg`;
      let photoUrl: string;
      try {
        photoUrl = await uploadPhoto(base64Hi, path);
      } catch {
        // Second attempt: much smaller for the inline base64 fallback
        setUploadStatus('ضغط أصغر للحفظ...');
        const smallBlob = await compressImage(file, isReport ? 900 : 650, 0.65);
        const reader2 = new FileReader();
        const base64Lo = await new Promise<string>((resolve, reject) => {
          reader2.onload = () => resolve(reader2.result as string);
          reader2.onerror = reject;
          reader2.readAsDataURL(smallBlob);
        });
        try {
          photoUrl = await uploadPhoto(base64Lo, path);
        } catch {
          // If all uploads fail, keep the local preview (blob URL).
          // The OCR is already running so the numbers still get extracted.
          photoUrl = previewUrl;
          console.warn(`[NutritionSurvey] All upload attempts failed for ${type} — using local preview`);
        }
      }

      setData(prev => ({
        ...prev,
        photos: { ...prev.photos, [type]: photoUrl }
      }));

      setUploadStatus('تم!');
      setTimeout(() => setUploading(null), 1000);
    } catch (error: any) {
      console.error('[NutritionSurvey] Upload error:', error);
      // Keep local preview even on total failure so user can continue
      setUploadStatus('');
      setUploading(null);
    }
  };

  const analyzeInBody = async (blob: Blob | File) => {
    setIsAnalyzing(true);
    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:image/jpeg;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64Data = await base64Promise;
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
If a value is not visible or readable in the image, use 0. Do not include units — numbers only.`;
      const response = await safeGenerateContent(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }] }],
        undefined,
        { responseMimeType: 'application/json', temperature: 0.1 },
      );

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsedResult = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      const anyExtracted = Object.values(parsedResult).some((v) => Number(v) > 0);
      if (anyExtracted) {
        setData(prev => ({
          ...prev,
          measurements: {
            ...prev.measurements,
            weight:          Number(parsedResult.weight)          || prev.measurements.weight,
            fatPercentage:   Number(parsedResult.fatPercentage)   || prev.measurements.fatPercentage,
            muscleMass:      Number(parsedResult.muscleMass)      || prev.measurements.muscleMass,
            waterPercentage: Number(parsedResult.waterPercentage) || prev.measurements.waterPercentage,
            protein:         Number(parsedResult.protein)         || prev.measurements.protein,
          }
        }));
      }
    } catch (error) {
      console.error('[NutritionSurvey] InBody OCR error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow submission if front photo is set (even as local preview blob URL)
    // or if there's a local preview fallback.
    const frontOk = !!data.photos.front || !!localPreviews.front;
    if (!frontOk) {
      playError();
      alert('يرجى رفع الصورة الأمامية على الأقل للمتابعة');
      return;
    }
    playSuccess();
    // Merge local previews as fallback for any photo that didn't finish uploading
    const mergedData: NutritionSurveyData = {
      ...data,
      photos: {
        front:  data.photos.front  || localPreviews.front  || '',
        side:   data.photos.side   || localPreviews.side   || '',
        inBody: data.photos.inBody || localPreviews.inBody || '',
      },
    };
    onComplete(mergedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-12 pb-12">
      {/* SECTION 1: الأساسيات والتقييم الطبي */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">القسم الأول: المعلومات الأساسية والطبية</h2>
          <p className="text-xs text-slate-500">نبدأ ببياناتك الصحية لضمان سلامة البرنامج</p>
        </div>

        {/* Global Medical Form */}
        <GeneralMedicalForm 
          medicalData={data.medical || { bloodPressure: false, diabetes: false, surgeries: false }} 
          gender={gender}
          onChange={(med) => setData({...data, medical: med})}
        />

        {/* Photos Section */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-green-400">
            <Camera size={24} /> الصور والمقاييس الشخصية
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: 'front', label: 'صورة من الأمام' },
              { id: 'side', label: 'صورة من الجانب' },
              { id: 'inBody', label: 'تقرير InBody' }
            ].map((photo) => (
              <div key={photo.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setActivePhotoType(photo.id as any);
                    fileInputRef.current?.click();
                  }}
                  className={`w-full aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden ${
                    data.photos[photo.id as keyof typeof data.photos] || localPreviews[photo.id as keyof typeof localPreviews]
                      ? 'border-green-500 bg-green-500/5' 
                      : 'border-white/10 bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  {(data.photos[photo.id as keyof typeof data.photos] || localPreviews[photo.id as keyof typeof localPreviews]) ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={data.photos[photo.id as keyof typeof data.photos] || localPreviews[photo.id as keyof typeof localPreviews]} 
                        className="w-full h-full object-cover" 
                        alt={photo.label}
                        referrerPolicy="no-referrer"
                      />
                      {uploading === photo.id && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-400">{photo.label}</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Measurements */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-green-400">
            <Ruler size={24} /> القياسات الحيوية (بالسنتيمتر)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'chest', label: 'الصدر' },
              { id: 'waist', label: 'الوسط (اختياري)' },
              { id: 'arm', label: 'الذراع' },
              { id: 'thigh', label: 'الفخذ' }
            ].map((m) => (
              <div key={m.id}>
                <label className="block text-[10px] text-slate-500 mb-2 uppercase">{m.label}</label>
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="0.0"
                  className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 text-white text-center font-bold outline-none focus:border-green-500"
                  value={data.measurements[m.id as keyof typeof data.measurements] || ''}
                  onChange={e => setData({...data, measurements: {...data.measurements, [m.id]: parseFloat(e.target.value) || 0}})}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-center pt-2">
            <p className="text-[10px] text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-white/5 font-bold uppercase tracking-widest">Optional - Skip if not available</p>
          </div>

          <hr className="border-white/5" />

          {/* InBody Data */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-400">بيانات الـ InBody</span>
              {isAnalyzing && <span className="text-[10px] text-blue-400 animate-pulse">جاري التحليل...</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: 'weight', label: 'الوزن' },
                { id: 'fatPercentage', label: 'دهون %' },
                { id: 'muscleMass', label: 'عضلات' },
                { id: 'waterPercentage', label: 'مياه %' },
                { id: 'protein', label: 'بروتين' }
              ].map((field) => (
                <div key={field.id}>
                  <label className="block text-[9px] text-slate-500 mb-1 text-center">{field.label}</label>
                  <input 
                    type="number" 
                    step="0.1"
                    placeholder="0.0"
                    className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white text-center font-bold text-sm"
                    value={data.measurements[field.id as keyof typeof data.measurements] || ''}
                    onChange={e => setData({...data, measurements: {...data.measurements, [field.id]: parseFloat(e.target.value) || 0}})}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center pt-4">
            <p className="text-[10px] text-slate-500">ملاحظة: إذا كنت لا تملك تقرير InBody حالياً، يمكنك البدء بدونه وتحديثه لاحقاً.</p>
          </div>
        </div>
      </div>

      {/* SECTION 1B: نمط الحياة (Lifestyle) — drives the macro calculator. */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">نمط الحياة</h2>
          <p className="text-xs text-slate-500">معلومات تساعدنا نحدد سعراتك بدقة</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2">عدد ساعات النوم يومياً</label>
              <input type="number" min="0" max="24" step="0.5"
                className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white text-center font-bold"
                value={data.lifestyle.sleepHours || ''}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, sleepHours: parseFloat(e.target.value) || 0}})} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2">ميعاد الاستيقاظ</label>
              <input type="time"
                className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white text-center font-bold"
                value={data.lifestyle.wakeHour}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, wakeHour: e.target.value}})} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2">ساعات الشغل اليومية</label>
              <input type="number" min="0" max="24" step="0.5"
                className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white text-center font-bold"
                value={data.lifestyle.workShiftHours || ''}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, workShiftHours: parseFloat(e.target.value) || 0}})} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2">عدد جلسات التمرين / الأسبوع</label>
              <input type="number" min="0" max="14"
                className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-white text-center font-bold"
                value={data.lifestyle.workoutFrequencyPerWeek || ''}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, workoutFrequencyPerWeek: parseInt(e.target.value) || 0}})} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-3">طبيعة الشغل</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'desk',   label: 'مكتبي'   },
                { id: 'mixed',  label: 'مختلط'  },
                { id: 'active', label: 'حركي'   },
              ].map(o => (
                <button key={o.id} type="button"
                  onClick={() => setData({...data, lifestyle: {...data.lifestyle, jobNature: o.id as any}})}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                    data.lifestyle.jobNature === o.id
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20'
                      : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold mb-3">مستوى نشاطك خارج التمرين</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'sedentary', label: 'خامل' },
                { id: 'light',     label: 'خفيف' },
                { id: 'moderate',  label: 'متوسط' },
                { id: 'high',      label: 'مرتفع' },
              ].map(o => (
                <button key={o.id} type="button"
                  onClick={() => setData({...data, lifestyle: {...data.lifestyle, dailyActivityLevel: o.id as any}})}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                    data.lifestyle.dailyActivityLevel === o.id
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20'
                      : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" className="w-5 h-5 rounded-lg bg-slate-700 border-none text-amber-500 focus:ring-0"
                checked={data.lifestyle.insomnia}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, insomnia: e.target.checked}})} />
              <span className="text-sm text-slate-300">أعاني من أرق / صعوبة نوم</span>
            </label>
            <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" className="w-5 h-5 rounded-lg bg-slate-700 border-none text-amber-500 focus:ring-0"
                checked={data.lifestyle.familyObesityHistory}
                onChange={e => setData({...data, lifestyle: {...data.lifestyle, familyObesityHistory: e.target.checked}})} />
              <span className="text-sm text-slate-300">تاريخ عائلي للسمنة / السكر</span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: عادات التغذية */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">القسم الثاني: عادات التغذية</h2>
          <p className="text-xs text-slate-500">تفاصيل نمط حياتك الغذائي</p>
        </div>

        <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[2.5rem] space-y-8">
          {/* Water Intake - FIXED COMPONENT */}
          <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-3xl">
            <label className="block text-sm font-bold text-blue-400 mb-4 text-center">كم لتر من الماء تشرب يومياً؟</label>
            <div className="flex items-center justify-center gap-4 max-w-xs mx-auto">
              <input 
                type="number" 
                step="0.5"
                min="0"
                placeholder="0"
                className="w-24 bg-slate-800 border-2 border-blue-500/20 rounded-2xl p-4 text-white font-black text-2xl text-center outline-none focus:border-blue-500 transition-all"
                value={data.supplements.waterLiters || ''}
                onChange={e => setData({...data, supplements: {...data.supplements, waterLiters: parseFloat(e.target.value) || 0}})}
              />
              <span className="text-lg font-black text-blue-400/60 uppercase tracking-tighter">Liters</span>
            </div>
            <p className="text-[10px] text-blue-400/40 text-center mt-3 font-medium">أدخل الرقم فقط (مثال: 3 أو 3.5)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Hunger and Consistency */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-slate-500 mb-3 font-bold">أوقات الجوع الذروة خلال اليوم؟</label>
                <div className="flex flex-wrap gap-2">
                  {['الصباح الباكر', 'قبل الغداء', 'بعد الظهر', 'المساء', 'قبل النوم'].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        const current = data.habits.peakHungerTimes.split(', ').filter(t => t);
                        const next = current.includes(time) ? current.filter(t => t !== time) : [...current, time];
                        setData({...data, habits: {...data.habits, peakHungerTimes: next.join(', ')}});
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        data.habits.peakHungerTimes.includes(time)
                          ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/20'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-3 font-bold">عدد الوجبات الحالية في اليوم</label>
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5,6].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setData({...data, habits: {...data.habits, mealsPerDay: n}})}
                      className={`w-12 h-12 rounded-xl font-black text-lg transition-all border-2 ${
                        data.habits.mealsPerDay === n
                          ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/20'
                          : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {data.habits.mealsPerDay === 0 && (
                  <p className="text-[10px] text-slate-500 mt-2">اختر عدد الوجبات</p>
                )}
              </div>
            </div>

            {/* Food Taboos / Restrictions */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-slate-500 mb-3 font-bold">الممنوعات الغذائية (أشياء تكرهها أو تمنعها)</label>
                <textarea 
                  placeholder="ما هي الأطعمة التي لا تطيقها أو تكره وجودها في النظام؟"
                  className="w-full bg-slate-800 border border-white/5 rounded-2xl p-4 text-white h-32 outline-none focus:border-green-500 transition-all resize-none text-sm"
                  value={data.preferences.dislikes}
                  onChange={e => setData({...data, preferences: {...data.preferences, dislikes: e.target.value}})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-bold text-slate-400 mb-2">التفضيلات والحساسية الأخرى</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <textarea 
                placeholder="ماذا تحب أن تأكل؟ (أطعمة مفضلة)"
                className="w-full bg-slate-800 border border-white/5 rounded-2xl p-4 text-white h-24 outline-none focus:border-green-500"
                value={data.preferences.likes}
                onChange={e => setData({...data, preferences: {...data.preferences, likes: e.target.value}})}
              />
              <div className="flex flex-wrap gap-2 content-start">
                {['لاكتوز', 'جلوتين', 'مكسرات', 'بيض', 'سمك'].map(allergy => (
                  <button
                    key={allergy}
                    type="button"
                    onClick={() => {
                      const next = data.preferences.allergies.includes(allergy)
                        ? data.preferences.allergies.filter(a => a !== allergy)
                        : [...data.preferences.allergies, allergy];
                      setData({...data, preferences: {...data.preferences, allergies: next}});
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      data.preferences.allergies.includes(allergy) ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    حساسية {allergy}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: توزيع الوجبات والنشاط اليومي */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">القسم الثالث: توزيع وجباتك على 24 ساعة</h2>
          <p className="text-xs text-slate-500 font-medium">سجل تفاصيل يومك من الاستيقاظ حتى النوم بدقة</p>
        </div>

        <div className="space-y-6">
          {data.dailyLog.map((entry, idx) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              key={idx} 
              className="bg-slate-900/60 border border-white/5 p-6 rounded-[2rem] shadow-xl space-y-5"
            >
              <div className="flex justify-between items-center px-2">
                <TimePicker 
                  label="توقيت النشاط" 
                  value={entry.time} 
                  onChange={(val) => updateLogEntry(idx, 'time', val)} 
                />
                {data.dailyLog.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeLogEntry(idx)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-slate-500 font-bold block px-2">وصف الأكل أو النشاط في هذا الوقت</label>
                <textarea 
                  placeholder="مثال: وجبة الإفطار (بيض ببيف وفول وجبن) أو وقت السناك أو التمرين..."
                  className="w-full bg-slate-800/80 border border-white/5 rounded-2xl p-5 text-white h-32 outline-none focus:border-green-500 transition-all resize-none text-sm leading-relaxed"
                  value={entry.activity}
                  onChange={(e) => updateLogEntry(idx, 'activity', e.target.value)}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <button 
          type="button" 
          onClick={addLogEntry}
          className="w-full py-6 bg-slate-800 border-2 border-dashed border-white/10 rounded-[2rem] text-slate-400 font-bold flex items-center justify-center gap-3 hover:bg-slate-700 hover:border-green-500/30 hover:text-green-500 transition-all group active:scale-95"
        >
          <div className="bg-slate-700 p-2 rounded-xl group-hover:bg-green-500 group-hover:text-white transition-colors">
            <Plus size={24} />
          </div>
          <span>إضافة نشاط أو وجبة أخرى في يومك</span>
        </button>
      </div>

      {/* SECTION 4: ملاحظات إضافية + تسجيل صوتي (Phase 2 / item #7) */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">القسم الرابع: ملاحظات إضافية</h2>
          <p className="text-xs text-slate-500">أي تفاصيل تساعد الكوتش على فهم وضعك بشكل أعمق — نص أو صوت</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-bold text-purple-300 flex items-center gap-2">
              <FileText size={16} /> ملاحظاتك
            </label>
            <button
              type="button"
              onClick={isRecording ? stopNotesRecording : startNotesRecording}
              disabled={isTranscribing}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                isRecording
                  ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30 animate-pulse'
                  : isTranscribing
                  ? 'bg-slate-800 border-white/5 text-slate-500 cursor-wait'
                  : 'bg-purple-600/15 border-purple-400/30 text-purple-200 hover:bg-purple-600/25'
              }`}
            >
              {isRecording ? (
                <><Square size={14} /> إيقاف التسجيل</>
              ) : isTranscribing ? (
                <><Loader2 size={14} className="animate-spin" /> جاري تفريغ الصوت...</>
              ) : (
                <><Mic size={14} /> تسجيل صوتي</>
              )}
            </button>
          </div>
          <textarea
            placeholder="مثال: عندي حساسية من المكسرات، أو بصوم 3 أيام في الأسبوع، أو بحب طبخ معين..."
            className="w-full bg-slate-800/80 border border-white/5 rounded-2xl p-5 text-white h-36 outline-none focus:border-purple-500 transition-all resize-none text-sm leading-relaxed"
            value={data.additionalNotes || ''}
            onChange={(e) => setData(prev => ({ ...prev, additionalNotes: e.target.value }))}
          />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            💡 الزر الصوتي يحوّل كلامك لنص عربي تلقائياً ويضيفه للمربع. تقدر تسجّل عدة مرات وتعدّل النص يدوياً.
          </p>
        </div>
      </div>

      <div className="pt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-6 bg-green-600 hover:bg-green-500 text-white rounded-[2rem] font-bold text-lg shadow-2xl shadow-green-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
             <>
               <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               <span>جاري الحفظ...</span>
             </>
          ) : (
            <>
              <CheckCircle2 size={24} />
              <span>تأكيد وحفظ استبيان التغذية بالكامل</span>
            </>
          )}
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={e => activePhotoType && handleFileUpload(e, activePhotoType)} 
      />
    </form>
  );
}
