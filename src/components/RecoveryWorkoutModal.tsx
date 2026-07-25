import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Heart, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { safeGenerateContent, handleAIError } from '../services/aiMasterEngine';
import { UserProfile } from '../types';

interface RecoveryWorkoutModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  energy: number;
}

/**
 * Generates an energy-aware recovery / de-load session on demand.
 * The client clicks the orange banner ("طاقتك منخفضة النهاردة") and we
 * call Gemini with a focused prompt that uses the existing health flags.
 */
export default function RecoveryWorkoutModal({ open, onClose, profile, energy }: RecoveryWorkoutModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setContent('');
    setError('');
    setLoading(true);

    (async () => {
      try {
        const injuries = (profile as any).nutritionSurveyData?.painPoints?.join('، ')
          || (profile as any).onboardingData?.injuries
          || 'لا يوجد';
        const goal = (profile as any).onboardingData?.goal || 'fitness';
        const prompt = `اعمل لي جلسة "استشفاء فعّال" واحدة فقط لمدة 30 دقيقة لشخص:
- الطاقة اليوم: ${energy}/10 (منخفضة جداً)
- الهدف العام: ${goal}
- إصابات / آلام: ${injuries}

شروط:
- بدون أوزان ثقيلة، بدون قفز، بدون مجهود قلبي عالي.
- المحتوى: تمارين حركة (Mobility) + تمرين تنفس + إطالات + مشي خفيف اختياري.
- اذكر "ليه" كل تمرين مفيد علمياً اليوم.
- بالعربي فقط، بدون جداول.
- كل تمرين في سطر مستقل بصيغة:
  • اسم التمرين — المدة/التكرار — السبب العلمي.
- اختم بسطر تحفيزي قصير وبنصيحة لتحسين النوم الليلة.`;

        const result = await safeGenerateContent(
          'gemini-2.5-flash',
          prompt,
          'You are an elite recovery / mobility specialist. Reply in Arabic only.',
          { maxOutputTokens: 8192 },
        );
        const text = typeof result === 'string'
          ? result
          : (result?.response?.text?.() ?? result?.text ?? String(result ?? ''));
        setContent(text);
      } catch (err) {
        setError(handleAIError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, profile.uid, energy]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-slate-900 border border-orange-500/20 rounded-[2rem] overflow-hidden shadow-2xl"
            dir="rtl"
          >
            <div className="p-5 border-b border-white/5 bg-gradient-to-l from-orange-600/20 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
                  <Heart size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">جلسة استشفاء — مخصصة لطاقتك اليوم</h3>
                  <p className="text-[11px] text-orange-300/70">طاقة اليوم: {energy}/10 — لا تجبر جسمك، خفف وارتاح.</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {loading && (
                <div className="py-16 flex flex-col items-center gap-3 text-orange-300">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-xs font-bold">الذكاء الاصطناعي يحضّر جلستك...</p>
                </div>
              )}
              {error && !loading && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm">{error}</div>
              )}
              {!loading && !error && content && (
                <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed text-right">
                  <Markdown>{content}</Markdown>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-slate-800/30 flex items-center justify-between">
              <p className="text-[10px] text-slate-500 italic flex items-center gap-1.5">
                <Sparkles size={11} className="text-orange-400" />
                مولّد بواسطة كوتش برو AI — مراجَع طبياً بناءً على ملفك الصحي.
              </p>
              <button onClick={onClose} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl">
                تمام، خلاص
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
