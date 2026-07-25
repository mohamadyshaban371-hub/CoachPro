import React, { useMemo, useState } from 'react';
import { CalendarHeart, Droplet, Sparkles, AlertCircle } from 'lucide-react';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
}

/** Average length used to project the next cycle when the user gives only the
 *  start date. Configurable per-cycle by the user. */
const DEFAULT_CYCLE_DAYS = 28;
const PERIOD_DAYS = 5;

interface CycleAdvice {
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'pre-period';
  title: string;
  body: string;
  tone: 'rose' | 'amber' | 'emerald' | 'violet';
}

/**
 * Pure helper — given the last period start date, returns where the user is
 * in their cycle and a tailored Arabic recommendation. The same logic is
 * also referenced by the AI plan engine to lower RPE during the period week.
 */
export function adviceForCycle(lastStartIso: string | undefined, cycleLength = DEFAULT_CYCLE_DAYS): CycleAdvice | null {
  if (!lastStartIso) return null;
  const last = new Date(lastStartIso);
  const today = new Date();
  // Normalise to whole days
  const ms = today.getTime() - last.getTime();
  const dayInCycle = Math.floor(ms / 86400000) % cycleLength;
  if (dayInCycle < 0) return null;

  if (dayInCycle < PERIOD_DAYS) {
    return {
      phase: 'menstrual',
      tone: 'rose',
      title: 'أيام الدورة — راحة نسبية',
      body: 'الكوتش الذكي قلّل شدة التمرين 20% النهاردة. ركّزي على الترطيب (2.5-3 لتر مياه) وأطعمة غنية بالحديد والمغنيسيوم (سبانخ، شوفان، شوكولاتة داكنة 70%+). استبدلي الأوزان التقيلة بمشي/بيلاتس.',
    };
  }
  if (dayInCycle < 13) {
    return {
      phase: 'follicular',
      tone: 'emerald',
      title: 'المرحلة الجريبية — أعلى طاقة',
      body: 'دي أفضل أيامك للقوة والكارديو الشديد. زوّدي الأوزان ودوسي على PRs، الجسم في أعلى استجابة للتدريب.',
    };
  }
  if (dayInCycle < 16) {
    return {
      phase: 'ovulation',
      tone: 'amber',
      title: 'الإباضة — قمة الأداء',
      body: 'الطاقة في الذروة. استغلي اليومين دول لجلسات الـ HIIT أو رفع الأوزان التقيلة. اشربي مياه كتير وراقبي درجة حرارتك.',
    };
  }
  if (dayInCycle < cycleLength - 3) {
    return {
      phase: 'luteal',
      tone: 'violet',
      title: 'المرحلة الأصفرية — تدريب متوسط',
      body: 'الطاقة هتبدأ تنزل تدريجياً. خفّفي الكارديو الشديد وزوّدي تمارين القوة بإيقاع متوسط. ركّزي على البروتين والكاربوهيدرات المعقدة.',
    };
  }
  return {
    phase: 'pre-period',
    tone: 'amber',
    title: 'قبل الدورة بأيام — تنبيه',
    body: 'الدورة المتوقعة خلال 1-3 أيام. ابدئي تنزّلي شدة التمارين 10-15% وزوّدي المغنيسيوم والكالسيوم لتقليل التقلصات. خصّصي وقت كافٍ للنوم.',
  };
}

const TONE_MAP: Record<CycleAdvice['tone'], { border: string; bg: string; text: string; chip: string }> = {
  rose: {
    border: 'border-rose-400/40', bg: 'bg-rose-500/10', text: 'text-rose-200',
    chip: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  },
  emerald: {
    border: 'border-emerald-400/40', bg: 'bg-emerald-500/10', text: 'text-emerald-200',
    chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  },
  amber: {
    border: 'border-amber-400/40', bg: 'bg-amber-500/10', text: 'text-amber-200',
    chip: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  },
  violet: {
    border: 'border-violet-400/40', bg: 'bg-violet-500/10', text: 'text-violet-200',
    chip: 'bg-violet-500/20 text-violet-200 border-violet-400/30',
  },
};

/**
 * Female-only widget on the Today tab — log the start date of the most
 * recent period and the typical cycle length, then read tailored advice.
 *
 * Gender-gated by ClientDashboard so male athletes never see it.
 */
export default function PeriodTracker({ profile }: Props) {
  const cycleLog: any = (profile as any).cycleLog || {};
  const initialStart = cycleLog.lastPeriodStart || '';
  const initialLength = cycleLog.cycleLength || DEFAULT_CYCLE_DAYS;

  const [startDate, setStartDate] = useState<string>(initialStart);
  const [cycleLength, setCycleLength] = useState<number>(initialLength);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const advice = useMemo(() => adviceForCycle(startDate, cycleLength), [startDate, cycleLength]);
  const tone = advice ? TONE_MAP[advice.tone] : null;

  /**
   * Best-effort coach alert. Fires when the new save indicates the client
   * is currently in the menstrual phase AND we haven't already alerted for
   * this exact cycle start. We tag the de-dup with `cycleStart` so saving
   * the same date twice (e.g. user just changed cycleLength) doesn't spam.
   *
   * Failures are swallowed — the cycle save itself already succeeded and
   * the coach radar will catch the phase change on next dashboard load.
   */
  const notifyCoachIfMenstrual = async (newAdvice: CycleAdvice | null, lastAlertedStart?: string) => {
    if (!newAdvice || newAdvice.phase !== 'menstrual') return;
    if (lastAlertedStart === startDate) return;
    try {
      const adminsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const tasks = adminsSnap.docs.map((adminDoc) =>
        addDoc(collection(db, 'users', adminDoc.id, 'notifications'), {
          title: `${profile.name} دخلت مرحلة الدورة`,
          body: `الكوتش الذكي خفّض شدة تمارينها 20% تلقائياً وأضاف الحديد والمغنيسيوم لخطتها. ابعت ليها رسالة تشجيع لو حابب.`,
          type: 'cycle_phase',
          severity: 'info',
          clientUid: profile.uid,
          clientName: profile.name,
          cycleStart: startDate,
          isRead: false,
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(tasks);
    } catch (err) {
      console.warn('[PeriodTracker] coach notify skipped:', (err as Error)?.message);
    }
  };

  const handleSave = async () => {
    if (!startDate) return;
    try {
      setSaving(true);
      const lastAlertedStart = cycleLog.lastAlertedMenstrualStart;
      const nextAdvice = adviceForCycle(startDate, cycleLength);
      const isMenstrualNow = nextAdvice?.phase === 'menstrual';

      await updateDoc(doc(db, 'users', profile.uid), {
        cycleLog: {
          lastPeriodStart: startDate,
          cycleLength: Number(cycleLength) || DEFAULT_CYCLE_DAYS,
          updatedAt: new Date().toISOString(),
          // Stamp this so we don't notify the coach twice for the same cycle.
          lastAlertedMenstrualStart: isMenstrualNow ? startDate : (lastAlertedStart || null),
        },
      });

      // Fire-and-forget coach alert (no await blocking the UI).
      notifyCoachIfMenstrual(nextAdvice, lastAlertedStart);

      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      console.error('[PeriodTracker] save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[2rem] bg-slate-900 border border-white/5 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <CalendarHeart size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white leading-tight">متتبع الدورة الشهرية</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Cycle-Aware Coaching · AI Adjusts RPE
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
            تاريخ بداية آخر دورة
          </label>
          <input
            type="date"
            value={startDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-rose-400 transition"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
            متوسط طول الدورة (يوم)
          </label>
          <input
            type="number"
            min={20}
            max={45}
            value={cycleLength}
            onChange={(e) => setCycleLength(parseInt(e.target.value) || DEFAULT_CYCLE_DAYS)}
            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-rose-400 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!startDate || saving}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[12px] font-bold transition flex items-center gap-1.5"
        >
          <Droplet size={12} /> {saving ? 'جاري الحفظ…' : 'حفظ'}
        </button>
        {savedAt && <span className="text-[11px] text-emerald-300">تم الحفظ ✓</span>}
      </div>

      {advice && tone && (
        <div className={`rounded-2xl border p-3 flex gap-3 ${tone.border} ${tone.bg}`}>
          <Sparkles size={18} className={`shrink-0 mt-0.5 ${tone.text}`} />
          <div className="min-w-0">
            <p className={`text-[12px] font-bold ${tone.text}`}>
              {advice.title}
            </p>
            <p className={`text-[11px] leading-relaxed mt-1 opacity-90 ${tone.text}`}>
              {advice.body}
            </p>
          </div>
        </div>
      )}

      {!startDate && (
        <div className="flex gap-2 items-start text-[11px] text-slate-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-400" />
          <span>سجّلي تاريخ بداية الدورة الأخيرة عشان الكوتش الذكي يقدر يعدّل شدة التمارين والتغذية حسب مرحلتك.</span>
        </div>
      )}
    </div>
  );
}
