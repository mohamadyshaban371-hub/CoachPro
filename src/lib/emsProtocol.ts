/**
 * emsProtocol.ts — Deterministic safety rails for EMS sessions.
 *
 * Spec (April-2026 mandatory rules):
 *   • RPE 10 (Danger) is BANNED. The maximum allowed RPE for an EMS
 *     session is 9. The coach must never schedule a 10/10 effort.
 *   • Hz mapping:
 *       1–20 Hz  → recovery / lymphatic (low intensity, long pulses)
 *       20–50 Hz → endurance / fat-burn  (medium pulse width)
 *       50–100 Hz→ strength / hypertrophy (short pulse width, high effort)
 *   • Recovery: minimum 48 hours between EMS sessions.
 *   • Frequency: maximum 1–2 EMS sessions per week (never more).
 */

export type EMSBand = 'recovery' | 'endurance' | 'strength';

export interface EMSBandInfo {
  band: EMSBand;
  hzRange: [number, number];
  pulseWidthUs: [number, number];
  rationaleAr: string;
  recommendedRPE: [number, number];
}

export const EMS_HZ_BANDS: EMSBandInfo[] = [
  {
    band: 'recovery',
    hzRange: [1, 20],
    pulseWidthUs: [200, 400],
    rationaleAr: 'استشفاء / تحفيز ليمفاوي — تردد منخفض، شدة خفيفة، نبضة طويلة.',
    recommendedRPE: [3, 5],
  },
  {
    band: 'endurance',
    hzRange: [20, 50],
    pulseWidthUs: [150, 300],
    rationaleAr: 'تحمل عضلي / حرق دهون — تردد متوسط، شدة متوسطة، استمرارية أعلى.',
    recommendedRPE: [5, 7],
  },
  {
    band: 'strength',
    hzRange: [50, 100],
    pulseWidthUs: [100, 200],
    rationaleAr: 'قوة وتضخيم — تردد عالي، شدة قصوى آمنة (RPE ≤ 9)، نبضة قصيرة.',
    recommendedRPE: [7, 9],
  },
];

/** Hard cap — RPE 10 is never allowed for EMS. */
export const EMS_MAX_RPE = 9;

export function getEMSBandForHz(hz: number): EMSBandInfo | null {
  for (const b of EMS_HZ_BANDS) {
    if (hz >= b.hzRange[0] && hz < b.hzRange[1]) return b;
  }
  if (hz === 100) return EMS_HZ_BANDS[2];
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
 * CLIENT-FACING LAYER — Hide all technical params (Hz, µs, duty cycle).
 * Surfaces only: Light / Moderate / High intensity + simple Arabic cue.
 * The technical values stay in the internal AI prompt + admin/coach view.
 * ──────────────────────────────────────────────────────────────────────── */

export type EMSClientIntensity = 'light' | 'moderate' | 'high';

export interface EMSClientView {
  intensity: EMSClientIntensity;
  intensityLabelAr: string;
  intensityColorClass: string;
  cueAr: string;
}

/** Convert any technical EMS string (e.g. "85Hz / 350μs", "Strength", "45Hz") to a client-safe label. */
export function toClientIntensity(
  pulseIntensity?: string,
  pulseProtocol?: 'Strength' | 'Metabolic' | 'Relax',
): EMSClientView {
  const src = `${pulseIntensity || ''} ${pulseProtocol || ''}`.toLowerCase();

  let intensity: EMSClientIntensity = 'moderate';
  const hzMatch = src.match(/(\d{1,3})\s*hz/);
  if (hzMatch) {
    const hz = Number(hzMatch[1]);
    if (hz <= 20) intensity = 'light';
    else if (hz < 50) intensity = 'moderate';
    else intensity = 'high';
  } else if (src.includes('strength') || src.includes('قوة')) {
    intensity = 'high';
  } else if (src.includes('relax') || src.includes('استرخاء') || src.includes('recovery')) {
    intensity = 'light';
  } else if (src.includes('metabolic') || src.includes('تحمل') || src.includes('endurance')) {
    intensity = 'moderate';
  }

  const meta: Record<EMSClientIntensity, Omit<EMSClientView, 'intensity'>> = {
    light: {
      intensityLabelAr: 'خفيفة',
      intensityColorClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
      cueAr: 'ركّز على التنفس العميق واسترخاء العضلة بين النبضات.',
    },
    moderate: {
      intensityLabelAr: 'متوسطة',
      intensityColorClass: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
      cueAr: 'ثبّت العضلة أثناء النبضة وتنفّس بانتظام في فترة الراحة.',
    },
    high: {
      intensityLabelAr: 'عالية',
      intensityColorClass: 'bg-red-500/15 text-red-300 border-red-400/30',
      cueAr: 'انكماش قوي وثابت أثناء النبضة، استرخاء كامل وتنفس عميق في الراحة.',
    },
  };

  return { intensity, ...meta[intensity] };
}

/** Pre-session safety checklist shown to the client BEFORE every EMS workout. */
export const EMS_PRE_SESSION_CHECKLIST: { id: string; ar: string }[] = [
  { id: 'water',      ar: 'شربت 500–750 مل ماء قبل الجلسة بساعتين.' },
  { id: 'meal',       ar: 'تناولت وجبة خفيفة قبل 60–90 دقيقة (مش جلسة على معدة فاضية أو ممتلئة).' },
  { id: 'sleep',      ar: 'نمت 6 ساعات على الأقل الليلة الماضية.' },
  { id: 'no_pain',    ar: 'لا يوجد ألم حاد أو إصابة جديدة منذ آخر جلسة.' },
  { id: 'no_alcohol', ar: 'لم أتناول كحول أو منشطات قلب خلال 24 ساعة.' },
  { id: 'no_recent',  ar: 'مر 48 ساعة على الأقل من آخر جلسة EMS.' },
];

export interface EMSValidationResult {
  ok: boolean;
  warnings: string[];
  blockers: string[];
}

/**
 * Validate a planned EMS session against the safety protocol.
 *
 * @param rpe              Planned RPE (1–10)
 * @param hz               Planned frequency (Hz)
 * @param hoursSinceLast   Hours elapsed since the previous EMS session (0 if first)
 * @param sessionsThisWeek Sessions already completed in the current 7-day window
 */
export function validateEMSSession(
  rpe: number,
  hz: number,
  hoursSinceLast: number,
  sessionsThisWeek: number,
): EMSValidationResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (rpe >= 10) blockers.push('ممنوع: RPE 10 محظور للجلسات الكهربائية. الحد الأقصى 9/10.');
  else if (rpe >= 9) warnings.push('شدة عالية (RPE 9) — تأكد من جودة النوم والتغذية قبل الجلسة.');

  const band = getEMSBandForHz(hz);
  if (!band) blockers.push(`تردد غير مدعوم (${hz}Hz). النطاق الآمن 1–100Hz.`);

  if (hoursSinceLast > 0 && hoursSinceLast < 48) {
    blockers.push(
      `لم يمر 48 ساعة على آخر جلسة (مر ${Math.round(hoursSinceLast)}س فقط). EMS يحتاج استشفاء كامل.`,
    );
  }

  if (sessionsThisWeek >= 2) {
    blockers.push('تم تجاوز الحد الأسبوعي (2 جلسات/أسبوع كحد أقصى للـ EMS).');
  } else if (sessionsThisWeek === 1) {
    warnings.push('هذه ستكون الجلسة الثانية هذا الأسبوع — لا تتجاوزها.');
  }

  return { ok: blockers.length === 0, warnings, blockers };
}

/* ─────────────────────────────────────────────────────────────────────────
 * RECOVERY-ADJUSTED EMS RECOMMENDATION
 *
 * Takes wearable-derived recovery signals and returns a recommended EMS
 * band and RPE ceiling. Called by the AI engine before generating an EMS
 * draft so the LLM prompt includes recovery-aware safety rails.
 * ──────────────────────────────────────────────────────────────────────── */

export interface EMSRecoveryInput {
  /** 0-100. Derived locally or from provider (Oura, Whoop, Garmin). */
  recoveryScore?: number;
  /** RMSSD in ms. Higher = better parasympathetic tone. */
  hrv?: number;
  /** Last night's sleep in hours. */
  sleepHours?: number;
  /** 'high' HR strain from a recent (same-day or yesterday) session. */
  recentHrStrain?: 'low' | 'normal' | 'high';
}

export interface EMSRecoveryRecommendation {
  /** Safe band given recovery state. */
  recommendedBand: EMSBand;
  /** Maximum RPE to prescribe for this session. */
  rpeMax: number;
  /** Concise Arabic rationale shown to the coach / client. */
  rationaleAr: string;
  /** Whether the session should be blocked (extreme fatigue). */
  shouldBlock: boolean;
}

/**
 * Given wearable recovery data, returns the safest EMS band and RPE cap.
 *
 * Decision matrix (priority order):
 *  1. recoveryScore < 30 OR (sleepHours < 5 AND hrv < 30) → block
 *  2. recoveryScore < 50 OR sleepHours < 6 OR recentHrStrain=high → recovery band, RPE ≤ 5
 *  3. recoveryScore < 70 OR sleepHours < 7                         → endurance, RPE ≤ 7
 *  4. otherwise                                                     → strength, RPE ≤ 9
 */
export function computeEMSRecoveryAdjustment(
  input: EMSRecoveryInput
): EMSRecoveryRecommendation {
  const { recoveryScore, hrv, sleepHours, recentHrStrain } = input;

  // Guard: extreme fatigue
  const extremeFatigue =
    (recoveryScore !== undefined && recoveryScore < 30) ||
    (sleepHours !== undefined && sleepHours < 5 &&
      hrv !== undefined && hrv < 30);

  if (extremeFatigue) {
    return {
      recommendedBand: 'recovery',
      rpeMax: 4,
      rationaleAr:
        'الاستشفاء منخفض جداً (نوم < 5س + HRV منخفض / درجة استشفاء < 30). ' +
        'يُوصى بإلغاء الجلسة أو الاكتفاء بتحفيز لمفاوي خفيف فقط.',
      shouldBlock: true,
    };
  }

  const poorRecovery =
    (recoveryScore !== undefined && recoveryScore < 50) ||
    (sleepHours !== undefined && sleepHours < 6) ||
    recentHrStrain === 'high';

  if (poorRecovery) {
    return {
      recommendedBand: 'recovery',
      rpeMax: 5,
      rationaleAr:
        'استشفاء غير مكتمل (نوم < 6س، أو درجة استشفاء < 50، أو إجهاد قلبي مرتفع مؤخراً). ' +
        'تردد 1–20Hz واسترخاء — RPE لا يتجاوز 5/10.',
      shouldBlock: false,
    };
  }

  const moderateRecovery =
    (recoveryScore !== undefined && recoveryScore < 70) ||
    (sleepHours !== undefined && sleepHours < 7);

  if (moderateRecovery) {
    return {
      recommendedBand: 'endurance',
      rpeMax: 7,
      rationaleAr:
        'استشفاء متوسط — يُوصى بنطاق التحمل (20–50Hz)، شدة متوسطة، RPE ≤ 7/10.',
      shouldBlock: false,
    };
  }

  return {
    recommendedBand: 'strength',
    rpeMax: EMS_MAX_RPE,
    rationaleAr:
      'استشفاء جيد — يمكن تطبيق نطاق القوة (50–100Hz)، RPE حتى 9/10 كحد أقصى.',
    shouldBlock: false,
  };
}
