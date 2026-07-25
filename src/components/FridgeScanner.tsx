import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, RefreshCw, Loader2, Sparkles, AlertCircle, Refrigerator } from 'lucide-react';
import Markdown from 'react-markdown';
import { aiMasterEngine, handleAIError } from '../services/aiMasterEngine';
import { compressImage } from '../lib/imageUtils';
import { awardCoins } from '../lib/gamification';
import { UserProfile } from '../types';

interface FridgeScannerProps {
  profile: UserProfile;
  onClose: () => void;
}

type Phase = 'idle' | 'preview' | 'analyzing' | 'result' | 'error';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function FridgeScanner({ profile, onClose }: FridgeScannerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1024, 0.7);
      const url = URL.createObjectURL(compressed instanceof Blob ? compressed : file);
      setPreviewUrl(url);
      const dataUrl = await blobToDataUrl(compressed instanceof Blob ? compressed : file);
      setBase64(dataUrl);
      setPhase('preview');
      setResult(null);
      setErrorText(null);
    } catch (err) {
      console.error(err);
      setErrorText('ما قدرتش أقرأ الصورة. جرّب صورة تانية.');
      setPhase('error');
    }
  };

  const handleAnalyze = async () => {
    if (!base64) return;
    setPhase('analyzing');
    setResult(null);
    setErrorText(null);
    try {
      const text = await aiMasterEngine.analyzeMealImage(base64);
      setResult(text);
      const earned = await awardCoins(profile.uid, 'FRIDGE_SCAN');
      setPointsEarned(earned);
      setPhase('result');
    } catch (err) {
      console.error(err);
      setErrorText(handleAIError(err));
      setPhase('error');
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBase64(null);
    setResult(null);
    setErrorText(null);
    setPhase('idle');
    setPointsEarned(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-t-[2rem] sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Refrigerator size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white leading-tight">ماسح الثلاجة</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                Fridge Scanner · Vision AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <AnimatePresence mode="wait">
            {/* IDLE */}
            {phase === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-3xl border-2 border-dashed border-white/15 bg-slate-900/40 hover:bg-slate-900/70 hover:border-cyan-400/40 transition flex flex-col items-center justify-center gap-3 text-slate-400 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center group-hover:scale-110 transition">
                    <Camera size={26} className="text-cyan-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">صور ثلاجتك أو ارفع صورة</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">هاقترح عليك وصفات من اللي عندك</p>
                  </div>
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-3">
                  المكافأة: <span className="text-amber-400 font-bold">+10 XP</span> لكل فحص ناجح
                </p>
              </motion.div>
            )}

            {/* PREVIEW */}
            {phase === 'preview' && previewUrl && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-slate-950">
                  <img src={previewUrl} alt="ثلاجة" className="w-full h-auto max-h-[50vh] object-contain" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-white/5 transition"
                  >
                    صورة تانية
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 transition"
                  >
                    <Sparkles size={15} /> حلل بالذكاء الاصطناعي
                  </button>
                </div>
              </motion.div>
            )}

            {/* ANALYZING */}
            {phase === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                  <Loader2 size={28} className="text-cyan-300 animate-spin" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">بحلل الثلاجة...</p>
                  <p className="text-[12px] text-slate-500 mt-1">Gemini Vision بيشتغل، ثواني قليلة</p>
                </div>
              </motion.div>
            )}

            {/* RESULT */}
            {phase === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {previewUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/5 max-h-32">
                    <img src={previewUrl} alt="ثلاجة" className="w-full h-32 object-cover opacity-70" />
                    {pointsEarned > 0 && (
                      <div className="absolute top-2 end-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-amber-950 text-[11px] font-black shadow-lg">
                        <Sparkles size={11} /> +{pointsEarned} XP
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-3xl bg-slate-950/60 border border-cyan-400/15 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                      <Sparkles size={14} className="text-cyan-300" />
                    </div>
                    <h4 className="text-sm font-black text-white">اقتراحات الذكاء الاصطناعي</h4>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-slate-200 leading-relaxed">
                    <Markdown>{result}</Markdown>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={reset}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-white/5 transition"
                  >
                    <RefreshCw size={14} /> فحص آخر
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition"
                  >
                    تمام
                  </button>
                </div>
              </motion.div>
            )}

            {/* ERROR */}
            {phase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center gap-3 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center">
                  <AlertCircle size={26} className="text-rose-300" />
                </div>
                <p className="text-sm text-rose-200 max-w-xs">{errorText}</p>
                <button
                  onClick={reset}
                  className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
                >
                  حاول تاني
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
