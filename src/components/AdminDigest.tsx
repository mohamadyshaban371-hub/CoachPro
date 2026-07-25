import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, RefreshCw, Brain, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { UserProfile } from '../types';
import { safeGenerateContent } from '../services/aiMasterEngine';

interface AdminDigestProps {
  clients: UserProfile[];
}

const CACHE_KEY = 'coachpro:admin-digest:v1';

interface DigestCache {
  date: string; // YYYY-MM-DD
  text: string;
  generatedAt: number;
}

/**
 * Builds a compact JSON snapshot of "what happened today" across every
 * activated client. We keep this small (top 30 most-active clients, only
 * today's data) so the prompt fits comfortably and the AI focuses on
 * actionable signals instead of drowning in history.
 */
function buildSnapshot(clients: UserProfile[]) {
  const today = new Date().toISOString().split('T')[0];

  const rows = clients
    .filter((c) => c.isActivated)
    .map((c) => {
      const dp: any = (c as any).dailyProgress?.[today] || {};
      const meas = c.measurementHistory || [];
      const lastMeas = meas[meas.length - 1] as any;
      const daysSinceMeas = lastMeas?.date
        ? Math.floor((Date.now() - new Date(lastMeas.date).getTime()) / 86400000)
        : null;
      const pendingAssessments = (c.assessmentRequests || []).filter((r: any) => r?.status === 'pending').length;

      return {
        name: c.name,
        gender: c.gender,
        goal: c.onboardingData?.goal,
        mood: dp.moodScore ?? null,
        energy: dp.energyLevel ?? null,
        mealsToday: (dp.mealsCompleted || []).length,
        workoutsToday: (dp.exercisesCompleted || []).length,
        waterToday: dp.waterLiters ?? null,
        daysSinceMeasurement: daysSinceMeas,
        pendingAssessments,
      };
    })
    // Drop fully silent clients to keep the prompt focused.
    .filter((r) =>
      r.mood !== null ||
      r.energy !== null ||
      r.mealsToday > 0 ||
      r.workoutsToday > 0 ||
      r.pendingAssessments > 0 ||
      (r.daysSinceMeasurement ?? 0) > 14
    )
    .slice(0, 30);

  return { today, totalActivated: clients.filter((c) => c.isActivated).length, rows };
}

function loadCache(): DigestCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DigestCache;
    if (parsed?.date !== new Date().toISOString().split('T')[0]) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(c: DigestCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

/**
 * AI-written daily briefing for the coach. One paragraph + a short bullet
 * list of clients who need attention today. Cached per-day so re-renders
 * don't re-hit the AI.
 */
export default function AdminDigest({ clients }: AdminDigestProps) {
  const initialCache = useMemo(loadCache, []);
  const [text, setText] = useState<string>(initialCache?.text || '');
  const [generatedAt, setGeneratedAt] = useState<number | null>(initialCache?.generatedAt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const snapshot = useMemo(() => buildSnapshot(clients), [clients]);

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const systemPrompt = `أنت مساعد كوتش لياقة محترف. كوّن "ملخص اليوم" للكوتش بالعربية المصرية، مختصر وعملي.

الإخراج المطلوب:
1) فقرة افتتاحية (سطرين كحد أقصى) عن الحالة العامة للنادي اليوم.
2) قسم بعنوان "**يحتاجوا اهتمام النهاردة:**" مع قائمة نقطية (3-6 عناصر فقط)، كل عنصر يبدأ باسم العميل + سطر سبب واضح + اقتراح تواصل محدد (مثال: "ابعت ليه رسالة صوتية تشجيع").
3) قسم "**نقاط مضيئة:**" بعنصر أو عنصرين عن العملاء اللي بيتألقوا (للاحتفاء معاهم).

ممنوع: الكلام العام، النصايح الطبية، أو ذكر أرقام مش موجودة في البيانات.

البيانات (JSON):
${JSON.stringify(snapshot)}`;

      const response = await safeGenerateContent('gemini-1.5-flash-latest', 'اكتب ملخص اليوم.', systemPrompt);
      const out = (response.text || '').trim();
      if (!out) throw new Error('الذكاء الاصطناعي مردش بنص.');
      setText(out);
      const now = Date.now();
      setGeneratedAt(now);
      saveCache({ date: snapshot.today, text: out, generatedAt: now });
    } catch (err: any) {
      console.error('[AdminDigest] generate failed:', err);
      setError(err?.message || 'تعذر توليد الملخص. جرّب تاني.');
    } finally {
      setLoading(false);
    }
  };

  const ageMinutes = generatedAt ? Math.floor((Date.now() - generatedAt) / 60000) : null;
  const isStale = ageMinutes !== null && ageMinutes > 240; // > 4h

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/40 border border-purple-500/20 p-6 space-y-4 mb-8"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Brain size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white leading-tight">ملخص اليوم بالذكاء الاصطناعي</h2>
            <p className="text-[11px] text-purple-300/80 font-bold uppercase tracking-widest">
              AI Daily Digest · {snapshot.rows.length} عميل نشط النهاردة
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || snapshot.rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : text ? <RefreshCw size={15} /> : <Sparkles size={15} />}
          {loading ? 'جاري التحليل…' : text ? 'تحديث' : 'توليد الملخص'}
        </button>
      </div>

      {snapshot.rows.length === 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-white/5 p-4 text-sm text-slate-400 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          مفيش نشاط مسجّل من العملاء النهاردة لحد دلوقتي. جرّب بعد ما يبدأوا يتفاعلوا.
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {text && (
        <div className="rounded-2xl bg-slate-950/60 border border-purple-500/15 p-5">
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
            <Markdown>{text}</Markdown>
          </div>
          {generatedAt && (
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <TrendingUp size={11} /> آخر تحديث:
                {ageMinutes! < 1 ? ' الآن' : ageMinutes! < 60 ? ` من ${ageMinutes} دقيقة` : ` من ${Math.floor(ageMinutes! / 60)} ساعة`}
              </span>
              {isStale && <span className="text-amber-400">قد تحتاج تحديث</span>}
            </div>
          )}
        </div>
      )}

      {!text && !error && snapshot.rows.length > 0 && (
        <p className="text-sm text-slate-400 leading-relaxed">
          اضغط "توليد الملخص" والذكاء الاصطناعي هيقرا حالة كل عميل نشط النهاردة (المود، الطاقة، الالتزام، القياسات) ويكتب لك بريف مختصر بمين محتاج اهتمامك دلوقتي.
        </p>
      )}
    </motion.section>
  );
}
