import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, CheckCircle2, Activity, ArrowLeft, Loader2, Info, Scale, Target, Sparkles, AlertTriangle, Maximize2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { MeasurementHistory } from '../types';
import { compressImage, validateInBodyImage } from '../lib/imageUtils';
import { safeGenerateContent } from '../services/aiMasterEngine';
import { useLightbox } from './Lightbox';

interface MeasurementUpdateProps {
  userId: string;
  /** When true, the dismiss controls are hidden — the user MUST submit fresh
   *  measurements before they can use the rest of the app. */
  mandatory?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export default function MeasurementUpdate({ userId, mandatory = false, onComplete, onCancel }: MeasurementUpdateProps) {
  /** Status of the OCR pass: idle | running | success | error. Surfaces a
   *  small badge to the user so they know whether to trust the auto-filled
   *  numbers or override them manually. */
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [ocrError, setOcrError] = useState<string>('');
  const [ocrFieldsFilled, setOcrFieldsFilled] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [localPreviews, setLocalPreviews] = useState<{front?: string, side?: string, inBody?: string}>({});
  const [ocrLoading, setOcrLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<MeasurementHistory>({
    date: new Date().toISOString(),
    weight: 0,
    fatPercentage: 0,
    muscleMass: 0,
    waterPercentage: 0,
    protein: 0,
    chest: 0,
    waist: 0,
    hips: 0,
    arm: 0,
    pushUps: 0,
    squats: 0,
    plank: 0,
    photos: {
      front: '',
      side: '',
      inBody: ''
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof MeasurementHistory['photos']) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!userId) {
      console.error("UserId missing in MeasurementUpdate");
      alert("خطأ في هوية المستخدم.");
      return;
    }

    if (type === 'inBody') {
      const validationError = validateInBodyImage(file);
      if (validationError) {
        alert(validationError);
        e.target.value = '';
        return;
      }
    }

    // Create local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [type]: previewUrl }));

    // REQUIREMENT: Replace the placeholder immediately
    setData(prev => ({
      ...prev,
      photos: { ...prev.photos, [type]: previewUrl }
    }));

    setLoading(true);
    setUploadStatus('1. جاري التحضير...');
    try {
      // Step 1: Compress. We use a higher resolution for the InBody printout
      // (numbers must stay legible when zoomed inside the lightbox) than for
      // the body shots. Firestore's 1MB doc limit still has room for all
      // three at these settings.
      setUploadStatus('2. معالجة سريعة لضغط الصورة...');
      const isReport = type === 'inBody';
      const compressedBlob = await compressImage(
        file,
        isReport ? 1600 : 1100,
        isReport ? 0.88 : 0.82
      );
      // REQUIREMENT: Consider upload "successful" for UI purposes immediately
      // AI Analysis Trigger (Early)
      if (type === 'inBody') {
        performOCR(compressedBlob).catch(err => console.error('[MeasurementUpdate] OCR Error:', err));
      }

      // Step 2: Convert to Base64
      setUploadStatus('3. تحويل البيانات...');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      // Step 3: Set Base64 in state for Firestore doc
      setData(prev => ({
        ...prev,
        photos: { ...prev.photos, [type]: base64 }
      }));

      setUploadStatus('تم!');
      setTimeout(() => {
        setLoading(false);
        setUploadStatus('');
      }, 1000);
    } catch (error: any) {
      console.error("Upload critical error:", error);
      if (error.message === 'TIMEOUT' || error.message === 'URL_TIMEOUT') {
        alert("انتهى وقت الرفع بسبب ضعف الشبكة. تم الاحتفاظ بالصورة للمعاينة محلياً، يمكنك المتابعة.");
      } else {
        alert(`فشل الرفع: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  /**
   * Reads the InBody report image with Gemini Vision and auto-fills the form.
   * Uses gemini-2.5-flash (the supported model in this project) and a much
   * stricter Arabic-aware prompt so the model recognises both English InBody
   * 770 reports AND Arabic-localised printouts.
   *
   * Failure modes are non-fatal: the user can still type the numbers manually.
   */
  const performOCR = async (blob: Blob | File) => {
    setOcrLoading(true);
    setOcrStatus('running');
    setOcrError('');
    setOcrFieldsFilled(0);
    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      const prompt = `You are reading an InBody body-composition report. Reports may be in English, Arabic, or mixed.

Extract these numeric metrics and return ONLY a single JSON object — no markdown, no prose. Keys MUST be exactly:
{
  "weight": number,            // kg, "Weight" / "الوزن"
  "fatPercentage": number,     // %, "PBF" or "Body Fat Percentage" / "نسبة الدهون"
  "muscleMass": number,        // kg, "SMM" Skeletal Muscle Mass / "الكتلة العضلية"
  "waterPercentage": number,   // %, "TBW" Total Body Water as % of weight / "نسبة الماء"
  "protein": number,           // kg, "Protein" / "البروتين"
  "visceralFat": number,       // level (typically 1-20), "Visceral Fat Level" — 0 if absent
  "bmr": number,               // kcal, "BMR" Basal Metabolic Rate — 0 if absent
  "inbodyScore": number        // 0-100, "InBody Score" — 0 if absent
}

Rules:
- If a value is unreadable or missing, return 0 for that field. Do NOT guess.
- Numbers only — no units, no quotes, no thousand separators.
- Decimal point '.' (never comma).
- Output MUST be valid JSON parseable with JSON.parse.`;

      const response = await safeGenerateContent(
        "gemini-2.5-flash",
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: blob.type || 'image/jpeg'
              }
            }
          ]
        },
        undefined,
        { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 600 }
      );

      const text = response.text || '';
      // Robust JSON extraction (model occasionally wraps in ```json fences)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('لم يتم العثور على بيانات JSON في استجابة المحلل');
      const extractedData = JSON.parse(jsonMatch[0]);

      // Count how many real (non-zero) values came back so we can show a
      // confidence indicator to the user.
      const numericKeys = ['weight', 'fatPercentage', 'muscleMass', 'waterPercentage', 'protein'] as const;
      const filled = numericKeys.filter(k => Number(extractedData[k]) > 0).length;
      setOcrFieldsFilled(filled);

      setData(prev => ({
        ...prev,
        weight: Number(extractedData.weight) || prev.weight,
        fatPercentage: Number(extractedData.fatPercentage) || prev.fatPercentage,
        muscleMass: Number(extractedData.muscleMass) || prev.muscleMass,
        waterPercentage: Number(extractedData.waterPercentage) || prev.waterPercentage,
        protein: Number(extractedData.protein) || prev.protein,
        // Extra metrics auto-saved for the AI engine (no form input shown).
        visceralFat: Number(extractedData.visceralFat) || prev.visceralFat || 0,
        bmr: Number(extractedData.bmr) || prev.bmr || 0,
        inbodyScore: Number(extractedData.inbodyScore) || prev.inbodyScore || 0,
        chest: prev.chest || 0,
        waist: prev.waist || 0,
        hips: prev.hips || 0,
        arm: prev.arm || 0,
        pushUps: prev.pushUps || 0,
        squats: prev.squats || 0,
        plank: prev.plank || 0
      }));
      setOcrStatus(filled >= 3 ? 'success' : 'error');
      if (filled < 3) setOcrError(`المحلل قرأ ${filled} حقول فقط — يرجى مراجعة وإكمال الباقي يدوياً.`);
    } catch (error: any) {
      console.error("OCR Error:", error);
      setOcrStatus('error');
      setOcrError(error?.message || 'فشل تحليل الصورة — يرجى إدخال الأرقام يدوياً.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Hard gate: refuse to save garbage. Weight is the minimum signal we
    // need for AI re-tuning so nothing goes through without it.
    if (!data.weight || data.weight < 30 || data.weight > 250) {
      alert('من فضلك أدخل وزن صحيح قبل الحفظ (30-250 كجم).');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(db, 'users', userId);
      // Persist the new measurement entry plus a top-level timestamp the
      // admin dashboard can sort/filter by. `arrayUnion` keeps the full
      // history intact so the trend chart still works.
      await updateDoc(userRef, {
        measurementHistory: arrayUnion(data),
        lastMeasurementSubmittedAt: new Date().toISOString(),
        // Reset the AI-generated brain summary — admin should regenerate
        // with the fresh numbers on next view.
        brainSummary: null,
      });

      // Notify the admin so they can review + regenerate the plan with
      // fresh numbers. Best-effort; failure shouldn't block the client.
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: 'admin',
          title: 'قياسات جديدة بانتظار المراجعة',
          message: `تم تحديث قياسات InBody — الوزن: ${data.weight} كجم، الدهون: ${data.fatPercentage}%`,
          type: 'system',
          isRead: false,
          createdAt: serverTimestamp(),
          relatedUserId: userId,
        });
      } catch (notifyErr) {
        console.warn('[MeasurementUpdate] admin notification failed:', notifyErr);
      }

      onComplete();
    } catch (error) {
      console.error("Error updating measurements:", error);
      alert('فشل حفظ القياسات. تأكد من الاتصال وأعد المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  // Lightbox controller — shared instance opens with whichever photo the
  // user just clicked (front / side / inBody) so they can zoom in to verify.
  const lb = useLightbox();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
      {lb.element}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-slate-800/50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {mandatory ? 'مطلوب: تحديث القياسات' : 'تحديث المقاييس الدورية'}
            </h2>
            <p className={`text-sm ${mandatory ? 'text-amber-300' : 'text-slate-400'}`}>
              {mandatory
                ? 'لقد مر أكثر من 14 يوماً — لا يمكن استكمال التطبيق قبل رفع تقرير الـ InBody الجديد.'
                : 'كل 14 يوم نتابع تقدمك بدقة'}
            </p>
          </div>
          {!mandatory && (
            <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
              <ArrowLeft size={24} />
            </button>
          )}
        </div>

        {mandatory && (
          <div className="px-8 py-3 bg-amber-600/15 border-b border-amber-500/30 flex items-center gap-2 text-amber-200 text-xs">
            <AlertTriangle size={14} />
            <span>هذه الشاشة إجبارية — حفظ القياسات الجديدة يفتح بقية المنصة وكوتش الذكاء الاصطناعي يعيد ضبط خطتك تلقائياً.</span>
          </div>
        )}

        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { id: 'front', label: 'صورة من الأمام', icon: <Camera /> },
                  { id: 'side', label: 'صورة من الجانب', icon: <Camera /> },
                  { id: 'inBody', label: 'تقرير InBody', icon: <Upload /> }
                ].map((item) => (
                  <div key={item.id} className="space-y-3">
                    <label className="text-sm font-bold text-slate-300 block text-center">{item.label}</label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, item.id as any)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className={`aspect-[3/4] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
                        data.photos[item.id as keyof typeof data.photos] || localPreviews[item.id as keyof typeof localPreviews]
                          ? 'border-green-500 bg-green-500/5' 
                          : 'border-white/10 bg-slate-800/50 group-hover:border-blue-500/50'
                      }`}>
                        {(data.photos[item.id as keyof typeof data.photos] || localPreviews[item.id as keyof typeof localPreviews]) ? (
                          <div className="relative w-full h-full">
                            <img 
                              src={data.photos[item.id as keyof typeof data.photos] || localPreviews[item.id as keyof typeof localPreviews]} 
                              className="w-full h-full object-cover rounded-[1.4rem] cursor-zoom-in" 
                              alt={item.label}
                              referrerPolicy="no-referrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Sits above the file input overlay so a click
                                // means "view full-size", not "pick a new file".
                                const url = data.photos[item.id as keyof typeof data.photos] || localPreviews[item.id as keyof typeof localPreviews];
                                if (url) lb.open([{ url, title: item.label }]);
                              }}
                              style={{ position: 'relative', zIndex: 20 }}
                            />
                            <div className="absolute bottom-2 left-2 z-30 pointer-events-none p-1.5 bg-black/60 rounded-lg text-white">
                              <Maximize2 size={11} />
                            </div>
                            {loading && !data.photos[item.id as keyof typeof data.photos] && (
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-[1.4rem] p-4 text-center">
                                <div className="relative w-10 h-10 mb-2">
                                  <div className="absolute inset-0 border-3 border-white/20 rounded-full" />
                                  <div className="absolute inset-0 border-3 border-green-500 rounded-full border-t-transparent animate-spin" />
                                </div>
                                <span className="text-[10px] text-white font-bold mb-1">جاري الرفع...</span>
                                <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mt-1 max-w-[60%]">
                                  <motion.div 
                                    className="bg-green-500 h-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            {data.photos[item.id as keyof typeof data.photos] && (
                              <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full text-white">
                                <CheckCircle2 size={12} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="p-4 bg-slate-700 rounded-2xl text-slate-400 group-hover:text-blue-400 transition-colors">
                              {item.icon}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold">اضغط للرفع</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex gap-3">
                <Info className="text-blue-400 shrink-0" size={20} />
                <p className="text-xs text-blue-200 leading-relaxed">
                  ارفع تقرير الـ InBody وسيقوم الذكاء الاصطناعي باستخراج بياناتك تلقائياً لتوفير وقتك.
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!data.photos.front || !data.photos.side || !data.photos.inBody}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
              >
                التالي: مراجعة البيانات
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {ocrLoading && (
                <div className="flex flex-col items-center justify-center p-12 bg-blue-600/5 rounded-3xl border border-blue-500/20 animate-pulse">
                  <Loader2 className="text-blue-500 animate-spin mb-4" size={40} />
                  <p className="text-blue-400 font-bold">جاري استخراج البيانات بالذكاء الاصطناعي...</p>
                </div>
              )}

              {!ocrLoading && ocrStatus === 'success' && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-600/10 border border-emerald-500/30">
                  <Sparkles size={18} className="text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-emerald-300 font-bold text-sm">تم استخراج {ocrFieldsFilled} حقول من تقرير الـ InBody تلقائياً</p>
                    <p className="text-emerald-400/80 text-[11px] mt-1">راجع الأرقام بالأسفل وعدّل أي قيمة غير دقيقة قبل الحفظ.</p>
                  </div>
                </div>
              )}
              {!ocrLoading && ocrStatus === 'error' && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-600/10 border border-amber-500/30">
                  <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 font-bold text-sm">القراءة التلقائية لم تكتمل</p>
                    <p className="text-amber-400/80 text-[11px] mt-1">{ocrError || 'يرجى إدخال الأرقام يدوياً من تقرير الـ InBody.'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-500 uppercase flex items-center gap-2">
                  <Activity size={16} /> مقاييس الـ InBody
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'الوزن (كجم)', key: 'weight' },
                    { label: 'نسبة الدهون (%)', key: 'fatPercentage' },
                    { label: 'الكتلة العضلية (كجم)', key: 'muscleMass' },
                    { label: 'نسبة الماء (%)', key: 'waterPercentage' },
                    { label: 'البروتين (كجم)', key: 'protein' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 mr-2">{field.label}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={data[field.key as keyof MeasurementHistory] as number}
                        onChange={(e) => setData({ ...data, [field.key]: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-pink-500 uppercase flex items-center gap-2">
                  <Scale size={16} /> جدول القياسات (cm)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'الصدر', key: 'chest' },
                    { label: 'الخصر', key: 'waist' },
                    { label: 'الأرداف', key: 'hips' },
                    { label: 'الذراع', key: 'arm' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 mr-2">{field.label}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={data[field.key as keyof MeasurementHistory] as number}
                        onChange={(e) => setData({ ...data, [field.key]: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-pink-500 outline-none transition-all text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-green-500 uppercase flex items-center gap-2">
                  <Target size={16} /> الاختبارات البدنية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'الضغط (تكرار)', key: 'pushUps' },
                    { label: 'السكوات (تكرار)', key: 'squats' },
                    { label: 'البلانك (ثانية)', key: 'plank' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 mr-2">{field.label}</label>
                      <input
                        type="number"
                        value={data[field.key as keyof MeasurementHistory] as number}
                        onChange={(e) => setData({ ...data, [field.key]: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-all text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all"
                >
                  رجوع
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-green-600/20 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                  <span>حفظ وإرسال التحديث</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
