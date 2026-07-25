/**
 * scientificEngine.ts — Deterministic implementation of the 10-step
 * adaptive training logic. Steps 0–5 are fully implemented; Step 9
 * (progressLoad) is exposed as a small helper used by the 14-day
 * progression cycle.
 *
 * The engine is PURE: no Firebase, no fetch. The aiMasterEngine calls
 * `runScientificEngine(input)` to compute the prescription, then forwards
 * the result to Gemini as additional hard rails. This guarantees that
 * the math (50/65/85% intensity, readiness penalties, weakness rule)
 * is applied identically every run, regardless of LLM output drift.
 */

export type Goal = 'shape' | 'loss' | 'bulk' | 'fitness' | 'rehab';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Gender = 'male' | 'female';
export type Location = 'gym' | 'home';
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'none';

/** STEP 0 — INPUT DATA */
export interface ReadinessInput {
  /** 1–10, perceived stress today */
  stress: number;
  /** hours slept last night */
  sleepHours: number;
  /** 1–10, current physical pain */
  pain: number;
  /** Free-text injury description (used only for context) */
  injuries?: string;
}

export interface ScientificInput {
  age: number;
  gender: Gender;
  goal: Goal;
  location: Location;
  level: Level;
  readiness: ReadinessInput;
  cyclePhase?: CyclePhase;
}

/** STEP 1 — READINESS CHECK */
export interface ReadinessResult {
  status: 'normal' | 'reduce' | 'rest';
  intensityFactor: number; // 1.0 / 0.85 / 0.70
  alerts: string[];
}

export function checkReadiness(r: ReadinessInput): ReadinessResult {
  const alerts: string[] = [];
  // Hard rule: any single severe trigger drops factor to 0.70
  const severe = r.stress > 8 || r.sleepHours < 5 || r.pain > 6;
  // Moderate rule: a soft trigger drops to 0.85
  const moderate = r.stress > 6 || r.sleepHours < 6 || r.pain > 4;

  if (severe) {
    if (r.stress > 8) alerts.push(`الضغط النفسي مرتفع (${r.stress}/10) — تخفيض الشدة`);
    if (r.sleepHours < 5) alerts.push(`النوم أقل من 5 ساعات (${r.sleepHours}س) — تخفيض الشدة`);
    if (r.pain > 6) alerts.push(`الألم مرتفع (${r.pain}/10) — تخفيض الشدة`);
    // If two severe triggers stack we recommend a full rest day
    const severeCount = [r.stress > 8, r.sleepHours < 5, r.pain > 6].filter(Boolean).length;
    if (severeCount >= 2) {
      alerts.push('عدة مؤشرات حرجة — يوم استشفاء كامل (Active Rest)');
      return { status: 'rest', intensityFactor: 0.5, alerts };
    }
    return { status: 'reduce', intensityFactor: 0.7, alerts };
  }
  if (moderate) {
    alerts.push('الاستعداد متوسط — تخفيف خفيف للشدة');
    return { status: 'reduce', intensityFactor: 0.85, alerts };
  }
  return { status: 'normal', intensityFactor: 1.0, alerts };
}

/** STEP 2 + 3 — TEST CATALOG */
export interface FitnessTest {
  id: string;
  nameAr: string;
  nameEn: string;
  instructionsAr: string;
  measurement: string; // unit label
  /** Goals this test serves; tests tagged 'core' are always selected */
  goalRelevance: (Goal | 'core')[];
  /** If true, lower value = better (e.g. waist, resting HR, pain) */
  inverted?: boolean;
}

export const FITNESS_TESTS: FitnessTest[] = [
  // ─── 6 CORE TESTS ─────────────────────────────────────────────
  {
    id: 'pushup',
    nameAr: 'تمرين الضغط (دقيقة)',
    nameEn: 'Push-up Test (1 min)',
    instructionsAr: 'أكبر عدد ضغط بشكل صحيح خلال 60 ثانية. الجسم مشدود من الكتف إلى الكاحل.',
    measurement: 'reps',
    goalRelevance: ['core'],
  },
  {
    id: 'squat',
    nameAr: 'القرفصاء (دقيقة)',
    nameEn: 'Bodyweight Squat (1 min)',
    instructionsAr: 'أكبر عدد قرفصاء حتى زاوية 90° خلال 60 ثانية. الكعب على الأرض.',
    measurement: 'reps',
    goalRelevance: ['core'],
  },
  {
    id: 'plank',
    nameAr: 'البلانك',
    nameEn: 'Plank Hold',
    instructionsAr: 'الثبات على وضع البلانك أطول مدة ممكنة، الجذع مستقيم بدون هبوط الورك.',
    measurement: 'seconds',
    goalRelevance: ['core'],
  },
  {
    id: 'sitreach',
    nameAr: 'الجلوس والوصول',
    nameEn: 'Sit & Reach',
    instructionsAr: 'اجلس على الأرض والقدمين مفرودتان. مد ذراعيك للأمام بأقصى مرونة. سجل المسافة بالسم.',
    measurement: 'cm',
    goalRelevance: ['core'],
  },
  {
    id: 'singleleg',
    nameAr: 'الوقوف على رجل واحدة',
    nameEn: 'Single-Leg Stand',
    instructionsAr: 'الوقوف على رجل واحدة بعينين مغلقتين. سجل الزمن حتى فقدان التوازن.',
    measurement: 'seconds',
    goalRelevance: ['core'],
  },
  {
    id: 'restingHR',
    nameAr: 'النبض في الراحة',
    nameEn: 'Resting Heart Rate',
    instructionsAr: 'قس النبض بعد 5 دقائق راحة كاملة في وضع الجلوس.',
    measurement: 'bpm',
    goalRelevance: ['core'],
    inverted: true,
  },

  // ─── GOAL-SPECIFIC TESTS ──────────────────────────────────────
  // Bulk — switched to 5RM (safer than 1RM); engine derives 1RM via Brzycki.
  {
    id: 'bench5rm',
    nameAr: 'البنش بريس — 5RM',
    nameEn: 'Bench Press 5RM',
    instructionsAr: 'بعد إحماء جيد، ابحث عن أقصى وزن تستطيع رفعه 5 تكرارات بدون ضعف فني (مع مراقب). النظام يحول إلى 1RM تلقائياً (Brzycki).',
    measurement: 'kg @ 5 reps',
    goalRelevance: ['bulk'],
  },
  {
    id: 'squat1rm',
    nameAr: 'سكوات — أقصى مرة',
    nameEn: 'Squat 1RM',
    instructionsAr: 'استخدم Brzycki: ابدأ بإحماء، ثم حدد أقصى وزن لمرة واحدة بأمان.',
    measurement: 'kg',
    goalRelevance: ['bulk'],
  },
  {
    id: 'deadlift1rm',
    nameAr: 'الديدلفت — أقصى مرة',
    nameEn: 'Deadlift 1RM',
    instructionsAr: 'استخدم Brzycki: ابدأ بإحماء، ثم حدد أقصى وزن لمرة واحدة بأمان وظهر مفرود.',
    measurement: 'kg',
    goalRelevance: ['bulk'],
  },
  {
    id: 'pullup',
    nameAr: 'العقلة — أقصى تكرار',
    nameEn: 'Pull-up Max Reps',
    instructionsAr: 'أكبر عدد عقلات متواصلة بدون توقف، الذقن فوق البار.',
    measurement: 'reps',
    goalRelevance: ['bulk', 'fitness'],
  },
  // Loss / Fitness — replaced Burpees + Beep with High Knees + 1km Run
  // (April-2026 spec: easier to self-administer at home, no cone setup needed).
  {
    id: 'highknees1m',
    nameAr: 'الركض في المكان (دقيقة)',
    nameEn: 'High Knees (1 min)',
    instructionsAr: 'الجري في المكان مع رفع الركبة لمستوى الورك لمدة 60 ثانية. سجل عدد لمسات القدم اليمنى للأرض.',
    measurement: 'reps',
    goalRelevance: ['loss', 'fitness'],
  },
  {
    id: 'run1km',
    nameAr: 'جري 1 كم',
    nameEn: '1 km Run',
    instructionsAr: 'اجري مسافة 1 كم على مضمار ثابت أو جهاز جري بأقل زمن ممكن. سجل الزمن بالثواني.',
    measurement: 'seconds',
    goalRelevance: ['loss', 'fitness'],
    inverted: true,
  },
  // Core sit-ups: 60s crunch test for trunk endurance — required by the
  // April-2026 spec (10-test battery).
  {
    id: 'crunch60s',
    nameAr: 'تمرين البطن (60 ثانية)',
    nameEn: 'Crunches (60s)',
    instructionsAr: 'استلق على ظهرك مع ثني الركبتين. سجل أكبر عدد تكرارات صحيحة خلال 60 ثانية.',
    measurement: 'reps',
    goalRelevance: ['core'],
  },
  {
    id: 'waist',
    nameAr: 'محيط الخصر',
    nameEn: 'Waist Measurement',
    instructionsAr: 'قس محيط الخصر عند مستوى السرة في وضع وقوف، صباحاً قبل الإفطار.',
    measurement: 'cm',
    goalRelevance: ['loss', 'shape'],
    inverted: true,
  },
  {
    id: 'fatpct',
    nameAr: 'نسبة الدهون (InBody)',
    nameEn: 'Body Fat %',
    instructionsAr: 'استخرج نسبة الدهون من جهاز InBody أو كاليبر.',
    measurement: '%',
    goalRelevance: ['loss', 'shape'],
    inverted: true,
  },
  {
    id: 'plyojump',
    nameAr: 'القفز العمودي',
    nameEn: 'Vertical Jump',
    instructionsAr: 'قف بجوار الحائط، ضع علامة بأقصى مدى ثابت، ثم اقفز وضع علامة جديدة. الفرق بالسم.',
    measurement: 'cm',
    goalRelevance: ['shape', 'fitness'],
  },
  // Rehab
  {
    id: 'rom',
    nameAr: 'مدى حركة المفصل',
    nameEn: 'Joint Range of Motion',
    instructionsAr: 'استخدم مسطرة زاوية (Goniometer) لقياس درجة الانحناء/الفرد للمفصل المصاب.',
    measurement: 'degrees',
    goalRelevance: ['rehab'],
  },
  {
    id: 'painvas',
    nameAr: 'مقياس الألم البصري (VAS)',
    nameEn: 'Visual Analog Scale',
    instructionsAr: 'قيّم شدة الألم من 0 (لا يوجد) إلى 10 (لا يحتمل) الآن وأثناء الحركة.',
    measurement: '0–10',
    goalRelevance: ['rehab'],
    inverted: true,
  },
  {
    id: 'grip',
    nameAr: 'قوة قبضة اليد',
    nameEn: 'Grip Strength',
    instructionsAr: 'استخدم Dynamometer واضغط بأقصى قوة لمدة 5 ثواني. سجل أعلى محاولة.',
    measurement: 'kg',
    goalRelevance: ['rehab', 'fitness'],
  },
  {
    id: 'balance',
    nameAr: 'اختبار التوازن (Y-Balance)',
    nameEn: 'Y-Balance Test',
    instructionsAr: 'الوقوف على رجل وامتداد الرجل الأخرى لثلاث اتجاهات (أمام، خلف-داخل، خلف-خارج).',
    measurement: 'cm',
    goalRelevance: ['rehab'],
  },
];

/**
 * STEP 2 — TEST SELECTION
 * Returns the 6 core tests + up to 5 goal-specific tests.
 */
export function selectTests(goal: Goal): FitnessTest[] {
  const core = FITNESS_TESTS.filter((t) => t.goalRelevance.includes('core'));
  const goalSpecific = FITNESS_TESTS.filter(
    (t) => !t.goalRelevance.includes('core') && t.goalRelevance.includes(goal)
  ).slice(0, 5);
  return [...core, ...goalSpecific];
}

/**
 * STEP 4 — SCORING SYSTEM
 *
 * Normalize a single test result to a 0–100 score, then apply
 * age + gender modifiers so that an "average" 50-year-old female
 * doesn't get penalized against a 25-year-old male baseline.
 */
const TEST_BASELINES: Record<string, { min: number; max: number }> = {
  pushup:      { min: 0,   max: 50  },
  squat:       { min: 0,   max: 60  },
  plank:       { min: 0,   max: 180 },
  sitreach:    { min: -10, max: 25  },
  singleleg:   { min: 0,   max: 60  },
  restingHR:   { min: 50,  max: 80  }, // inverted: 50 = best, 80 = worst
  bench5rm:    { min: 0,   max: 130 },
  squat1rm:    { min: 0,   max: 200 },
  deadlift1rm: { min: 0,   max: 220 },
  pullup:      { min: 0,   max: 25  },
  highknees1m: { min: 0,   max: 80  },
  run1km:      { min: 200, max: 480 }, // inverted: 200s = elite, 480s = poor
  crunch60s:   { min: 0,   max: 50  },
  waist:       { min: 70,  max: 120 }, // inverted
  fatpct:      { min: 8,   max: 35  }, // inverted
  plyojump:    { min: 10,  max: 70  },
  rom:         { min: 0,   max: 180 },
  painvas:     { min: 0,   max: 10  }, // inverted
  grip:        { min: 0,   max: 60  },
  balance:     { min: 30,  max: 110 },
};

/**
 * Convert raw 5RM to estimated 1RM using the Brzycki formula:
 *   1RM = weight × (36 / (37 - reps))
 * For a 5RM that's a constant ×1.125 multiplier — applied so downstream
 * intensity prescriptions stay calibrated to "% of 1RM".
 */
export function brzycki1RM(weight: number, reps: number): number {
  if (reps < 1 || reps > 12) return weight;
  return Math.round(weight * (36 / (37 - reps)));
}

export function scoreTest(test: FitnessTest, value: number, age: number, gender: Gender): number {
  const range = TEST_BASELINES[test.id];
  if (!range || isNaN(value)) return 0;
  let raw: number;
  if (test.inverted) {
    // Lower = better; map [min..max] → [100..0]
    raw = ((range.max - value) / (range.max - range.min)) * 100;
  } else {
    raw = ((value - range.min) / (range.max - range.min)) * 100;
  }
  raw = Math.max(0, Math.min(100, raw));

  // Age + gender adjustment (April-2026 spec: 4 tiers — youth, prime,
  // master 35-50, senior 50+). Divide by modifier so older/younger/female
  // athletes get a fair score against the same absolute number.
  const ageMod = ageModifierFor(age);
  const genderMod = gender === 'female' ? 0.9 : 1.0;
  return Math.round(Math.min(100, raw / (ageMod * genderMod)));
}

/**
 * Age tier modifier (used by both scoring and intensity prescription).
 *   <18  → 0.85 (still-developing skeletal system, reduced expected load)
 *   18–34→ 1.00 (baseline / prime)
 *   35–49→ 0.92 (master tier, mild deload)
 *   50+  → 0.85 (senior tier, deload + tempo emphasis)
 */
export function ageModifierFor(age: number): number {
  if (age < 18) return 0.85;
  if (age >= 50) return 0.85;
  if (age >= 35) return 0.92;
  return 1.0;
}

/**
 * Map a 0–100 normalized score to one of the 5 evaluation labels required
 * by the April-2026 spec. Used by the test-results UI and admin dashboard.
 */
export type EvaluationLabel = 'ضعيف' | 'مقبول' | 'جيد' | 'جيد جداً' | 'ممتاز';

export interface EvaluationGrade {
  label: EvaluationLabel;
  labelEn: 'Weak' | 'Acceptable' | 'Good' | 'Very Good' | 'Excellent';
  color: string; // tailwind class fragment ("red-500", "green-500", …)
}

export function evaluateScore(score: number): EvaluationGrade {
  if (score >= 91) return { label: 'ممتاز',   labelEn: 'Excellent',  color: 'emerald-500' };
  if (score >= 81) return { label: 'جيد جداً', labelEn: 'Very Good',  color: 'green-500'   };
  if (score >= 61) return { label: 'جيد',     labelEn: 'Good',       color: 'blue-500'    };
  if (score >= 41) return { label: 'مقبول',   labelEn: 'Acceptable', color: 'amber-500'   };
  return            { label: 'ضعيف',         labelEn: 'Weak',       color: 'red-500'     };
}

/** Convenience: score every test in one pass */
export function scoreAllTests(
  tests: FitnessTest[],
  rawResults: Record<string, number>,
  age: number,
  gender: Gender
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const t of tests) {
    if (rawResults[t.id] !== undefined) {
      scores[t.id] = scoreTest(t, rawResults[t.id], age, gender);
    }
  }
  return scores;
}

/** STEP 5 — DECISION ENGINE */
export interface DecisionOutput {
  /** Final prescribed % of 1RM for primary lifts */
  intensityPercent: number;
  /** Test IDs that scored < 40 — must be addressed first (Weakness Rule) */
  weakAreas: string[];
  /** Goal that drives exercise selection priority */
  goalPriority: Goal;
  /** Step-by-step modifier breakdown so the coach can audit the math */
  appliedModifiers: { name: string; effect: string }[];
  /** Suggested rep range derived from the final % */
  repRange: string;
  /** Target RPE range (Rate of Perceived Exertion 1-10) */
  targetRPE: string;
  /** RIR — Reps In Reserve target */
  rirRange: string;
  /** Recommended workout split based on level */
  workoutSplit: string;
  /** Number of training days per week */
  trainingDaysPerWeek: number;
}

const LEVEL_BASE_INTENSITY: Record<Level, number> = {
  beginner: 50,
  intermediate: 65,
  advanced: 85,
};

function repRangeFor(intensity: number): string {
  if (intensity >= 85) return '3-5 تكرار (قوة قصوى)';
  if (intensity >= 75) return '5-8 تكرار (قوة)';
  if (intensity >= 65) return '8-12 تكرار (تضخيم)';
  if (intensity >= 55) return '12-15 تكرار (تحمل عضلي)';
  return '15-20 تكرار (تحمل / استشفاء)';
}

/** RPE and RIR targets by level */
function rpeTargetFor(level: Level, intensityPercent: number): { rpe: string; rir: string } {
  if (intensityPercent <= 50) return { rpe: 'RPE 5–6', rir: 'RIR 4–5' };
  if (level === 'beginner')     return { rpe: 'RPE 6–7', rir: 'RIR 3–4' };
  if (level === 'intermediate') return { rpe: 'RPE 7–8', rir: 'RIR 2–3' };
  return                               { rpe: 'RPE 8–9', rir: 'RIR 1–2' };
}

/** Workout split and training days recommendation by level and goal */
function workoutSplitFor(level: Level, goal: Goal): { split: string; days: number } {
  if (level === 'beginner') {
    return { split: 'Full Body (3 أيام كامل الجسم)', days: 3 };
  }
  if (level === 'intermediate') {
    if (goal === 'loss' || goal === 'shape') {
      return { split: 'Full Body / Upper-Lower (4 أيام)', days: 4 };
    }
    return { split: 'Upper / Lower Split (4 أيام)', days: 4 };
  }
  // advanced
  if (goal === 'bulk') {
    return { split: 'Push / Pull / Legs (6 أيام PPL)', days: 6 };
  }
  return { split: 'Push / Pull / Legs (5 أيام PPL)', days: 5 };
}

export function decideIntensity(
  input: ScientificInput,
  scores: Record<string, number>
): DecisionOutput {
  const baseIntensity = LEVEL_BASE_INTENSITY[input.level];
  const readiness = checkReadiness(input.readiness);

  // Use the shared 4-tier modifier (youth / prime / master / senior).
  const ageMod = ageModifierFor(input.age);
  let cycleMod = 1.0;
  if (input.gender === 'female' && input.cyclePhase === 'menstrual') cycleMod = 0.85;
  if (input.gender === 'female' && input.cyclePhase === 'luteal') cycleMod = 0.95;

  const intensityPercent = Math.round(
    baseIntensity * readiness.intensityFactor * ageMod * cycleMod
  );

  const weakAreas = Object.entries(scores)
    .filter(([, v]) => v < 40)
    .map(([k]) => k);

  const { rpe, rir } = rpeTargetFor(input.level, intensityPercent);
  const { split, days } = workoutSplitFor(input.level, input.goal);

  return {
    intensityPercent,
    weakAreas,
    goalPriority: input.goal,
    repRange: repRangeFor(intensityPercent),
    targetRPE: rpe,
    rirRange: rir,
    workoutSplit: split,
    trainingDaysPerWeek: days,
    appliedModifiers: [
      { name: 'Base intensity for level', effect: `${baseIntensity}% (${input.level})` },
      { name: 'Readiness factor', effect: `×${readiness.intensityFactor.toFixed(2)} (${readiness.status})` },
      { name: 'Age modifier', effect: `×${ageMod.toFixed(2)} (age ${input.age})` },
      { name: 'Cycle modifier', effect: `×${cycleMod.toFixed(2)} (${input.cyclePhase ?? 'n/a'})` },
      { name: '⇒ Final prescribed % of 1RM', effect: `${intensityPercent}%` },
      { name: '⇒ Target RPE / RIR', effect: `${rpe} (${rir})` },
      { name: '⇒ Suggested rep range', effect: repRangeFor(intensityPercent) },
      { name: '⇒ Recommended split', effect: split },
    ],
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * STEPS 6 → 9 — ADAPTIVE 14-DAY PROGRESSION ENGINE
 * ─────────────────────────────────────────────────────────────────────
 *
 *  STEP 6 — Track daily completion + perceived effort (RPE proxy from
 *           energy/mood/pain) over the rolling 14-day cycle.
 *  STEP 7 — Aggregate the window into a deterministic ProgressionStatus
 *           ('improved' | 'fatigued' | 'neutral') with a clear, auditable
 *           reason. No LLM is involved — same inputs, same output.
 *  STEP 8 — Compute the next prescribed % of 1RM and volume (sets multiplier)
 *           by applying the cycle's adjustment to the current prescription.
 *  STEP 9 — `progressLoad()` is the pure math primitive used by Step 8.
 *           `runProgressionAnalysis()` runs Steps 6→8 together and is what
 *           the UI / aiMasterEngine call.
 */

/** STEP 6 — DAILY LOG OBSERVATION (one entry per calendar day) */
export interface DailyProgressLog {
  /** YYYY-MM-DD */
  date: string;
  /** Number of prescribed exercises actually completed */
  exercisesCompleted: number;
  /** Total prescribed exercises that day (0 = rest/unscheduled day) */
  totalExercises: number;
  /** Self-reported energy 1–10 (proxy for inverse RPE: high energy = low RPE) */
  energyLevel?: number;
  /** Self-reported mood 1–10 */
  moodScore?: number;
  /** Did the user mark the workout as completed in dailyLogs? */
  completedWorkout?: boolean;
  /** Optional: explicit RPE recorded for the session (1–10) */
  rpe?: number;
  /** HR strain tag from the paired wearable for this day's session. */
  hrStrain?: 'low' | 'normal' | 'high';
}

/** STEP 7 — AGGREGATED 14-DAY WINDOW METRICS */
export interface ProgressionWindow {
  /** Number of days in the window with totalExercises > 0 */
  scheduledDays: number;
  /** Number of those days where the user completed ≥80% of prescribed work */
  fullySessionDays: number;
  /** Mean of (exercisesCompleted/totalExercises) across scheduledDays, 0–1 */
  completionRate: number;
  /** Mean of energyLevel across days that reported it (1–10), or null */
  avgEnergy: number | null;
  /** Mean of mood across days that reported it (1–10), or null */
  avgMood: number | null;
  /** Mean RPE across days that explicitly logged one (1–10), or null */
  avgRPE: number | null;
  /** Number of days the user completely skipped a scheduled session */
  missedDays: number;
  /** Days with 'high' HR strain from a paired wearable (≥2 → fatigue signal). */
  highHrStrainDays: number;
}

export type ProgressionStatus = 'improved' | 'fatigued' | 'neutral';

export interface ProgressionAnalysis {
  status: ProgressionStatus;
  window: ProgressionWindow;
  /** Arabic-language reasons used by the admin card + LLM prompt */
  reasons: string[];
}

/**
 * STEP 7 — Aggregate raw DailyProgressLog rows into a ProgressionWindow
 * and derive the ProgressionStatus deterministically.
 *
 * Decision matrix (in this exact order):
 *   1. fatigued  if completionRate < 0.50 OR missedDays ≥ 4 OR avgEnergy ≤ 4
 *                OR avgRPE ≥ 9
 *   2. improved  if completionRate ≥ 0.80 AND (avgEnergy ≥ 6 || avgEnergy=null)
 *                AND (avgRPE ≤ 7 || avgRPE=null) AND missedDays ≤ 1
 *   3. neutral   otherwise
 */
export function analyzeProgressionWindow(logs: DailyProgressLog[]): ProgressionAnalysis {
  const scheduled = logs.filter((l) => l.totalExercises > 0);
  const ratios = scheduled.map((l) =>
    Math.min(1, l.exercisesCompleted / Math.max(1, l.totalExercises))
  );
  const completionRate = ratios.length
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length
    : 0;
  const fullySessionDays = ratios.filter((r) => r >= 0.8).length;
  const missedDays = scheduled.filter(
    (l) => l.exercisesCompleted === 0 && l.completedWorkout !== true
  ).length;

  const energyVals = logs
    .map((l) => l.energyLevel)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const moodVals = logs
    .map((l) => l.moodScore)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const rpeVals = logs
    .map((l) => l.rpe)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

  const highHrStrainDays = logs.filter((l) => l.hrStrain === 'high').length;

  const window: ProgressionWindow = {
    scheduledDays: scheduled.length,
    fullySessionDays,
    completionRate: Math.round(completionRate * 100) / 100,
    avgEnergy: avg(energyVals),
    avgMood: avg(moodVals),
    avgRPE: avg(rpeVals),
    missedDays,
    highHrStrainDays,
  };

  const reasons: string[] = [];
  let status: ProgressionStatus = 'neutral';

  // No data → neutral with a clear "no data" reason
  if (window.scheduledDays === 0) {
    reasons.push('لا توجد جلسات مجدولة في آخر 14 يوم — استمرار على نفس الحمل.');
    return { status: 'neutral', window, reasons };
  }

  const fatigueFlags: string[] = [];
  if (window.completionRate < 0.5)
    fatigueFlags.push(`نسبة الإكمال ${(window.completionRate * 100).toFixed(0)}% (أقل من 50%)`);
  if (window.missedDays >= 4)
    fatigueFlags.push(`${window.missedDays} أيام تخطي خلال أسبوعين`);
  if (window.avgEnergy !== null && window.avgEnergy <= 4)
    fatigueFlags.push(`متوسط الطاقة ${window.avgEnergy}/10 (منخفض)`);
  if (window.avgRPE !== null && window.avgRPE >= 9)
    fatigueFlags.push(`متوسط RPE ${window.avgRPE}/10 (إجهاد مرتفع)`);
  // Wearable signal: ≥2 high-strain sessions in 14 days → cumulative fatigue
  if (window.highHrStrainDays >= 2)
    fatigueFlags.push(`${window.highHrStrainDays} جلسات بإجهاد قلبي مرتفع (HR Strain High) — تراكم إرهاق عضوي`);

  if (fatigueFlags.length) {
    status = 'fatigued';
    reasons.push('علامات إجهاد ظاهرة — تطبيق ديلود (De-load): ' + fatigueFlags.join('، '));
    return { status, window, reasons };
  }

  const improvedOk =
    window.completionRate >= 0.8 &&
    window.missedDays <= 1 &&
    (window.avgEnergy === null || window.avgEnergy >= 6) &&
    (window.avgRPE === null || window.avgRPE <= 7);

  if (improvedOk) {
    status = 'improved';
    reasons.push(
      `أداء ممتاز — إكمال ${(window.completionRate * 100).toFixed(0)}% من الجلسات المجدولة` +
        (window.avgEnergy !== null ? `، متوسط الطاقة ${window.avgEnergy}/10` : '') +
        (window.avgRPE !== null ? `، متوسط RPE ${window.avgRPE}/10` : '') +
        '. تطبيق Progressive Overload.'
    );
    return { status, window, reasons };
  }

  reasons.push(
    `أداء متوسط — إكمال ${(window.completionRate * 100).toFixed(0)}% من الجلسات. ` +
      'الحفاظ على نفس الحمل والحجم لدورة جديدة (Maintenance).'
  );
  return { status, window, reasons };
}

/**
 * STEP 9 — CONTINUOUS PROGRESSION (pure math primitive).
 *
 * Called by the 14-day cycle to extend (not restart) the previous program.
 * - improved → +5% load
 * - fatigued → -10% volume (load stays the same, sets drop)
 * - neutral  → keep both
 */
export interface ProgressionResult {
  newLoad: number;
  newVolume: number;
  rationale: string;
}

export function progressLoad(
  previousLoad: number,
  previousVolume: number,
  status: ProgressionStatus
): ProgressionResult {
  if (status === 'improved') {
    return {
      // +2.5% weekly (≈ +5% per 14-day cycle) — safe progressive overload
      newLoad: Math.round(previousLoad * 1.025 * 10) / 10,
      newVolume: previousVolume,
      rationale: 'تحسن في الأداء — تطبيق Progressive Overload بزيادة 2.5% على الوزن هذا الأسبوع.',
    };
  }
  if (status === 'fatigued') {
    return {
      // De-load: reduce volume 30–40% AND load 10% to allow recovery
      newLoad: Math.round(previousLoad * 0.9 * 10) / 10,
      newVolume: Math.max(1, Math.round(previousVolume * 0.65 * 10) / 10),
      rationale: 'علامات إجهاد مرتفع — أسبوع Deload: تقليل الحمل 10% والحجم 35% للاستشفاء الكامل.',
    };
  }
  return {
    newLoad: previousLoad,
    newVolume: previousVolume,
    rationale: 'أداء ثابت — استمرار على نفس الحمل والحجم لأسبوع إضافي.',
  };
}

/**
 * STEP 8 — END-TO-END PROGRESSION RUN.
 *
 * Wraps Step 7 + Step 9 into a single call the UI / aiMasterEngine
 * uses. Produces both the new prescribed % of 1RM (load adjustment)
 * and the new volume multiplier (sets adjustment).
 */
export interface ProgressionPrescription extends ProgressionAnalysis {
  /** The intensity % that came in (for audit) */
  previousIntensityPercent: number;
  /** New prescribed % of 1RM after applying Step 9 */
  newIntensityPercent: number;
  /** Volume multiplier vs. previous cycle (1.0 = unchanged, 0.9 = -10%) */
  volumeMultiplier: number;
  /** Arabic rationale string from progressLoad() */
  prescription: ProgressionResult;
}

export function runProgressionAnalysis(
  logs: DailyProgressLog[],
  previousIntensityPercent: number,
  previousVolume = 1
): ProgressionPrescription {
  const analysis = analyzeProgressionWindow(logs);
  const prescription = progressLoad(previousIntensityPercent, previousVolume, analysis.status);
  // Cap the new intensity at 95% (keeps lifters out of true 1RM territory)
  const newIntensityPercent = Math.min(95, prescription.newLoad);
  return {
    ...analysis,
    previousIntensityPercent,
    newIntensityPercent,
    volumeMultiplier: prescription.newVolume / Math.max(0.0001, previousVolume),
    prescription,
  };
}

/**
 * Format a ProgressionPrescription as a hard-rail block for the LLM
 * prompt. Mirrors `formatEngineForPrompt` so the engine's "look and
 * feel" carries through every cycle.
 */
export function formatProgressionForPrompt(p: ProgressionPrescription): string {
  return `=========== PROGRESSION ENGINE (DETERMINISTIC — DO NOT OVERRIDE) ===========
14-day window: scheduledDays=${p.window.scheduledDays}, completion=${(p.window.completionRate * 100).toFixed(0)}%, missed=${p.window.missedDays}, avgEnergy=${p.window.avgEnergy ?? 'n/a'}, avgRPE=${p.window.avgRPE ?? 'n/a'}.
Decision: ${p.status.toUpperCase()} — ${p.reasons.join(' | ')}
Previous prescribed intensity: ${p.previousIntensityPercent}% 1RM.
NEW PRESCRIBED INTENSITY: ${p.newIntensityPercent}% 1RM.
NEW VOLUME MULTIPLIER: ×${p.volumeMultiplier.toFixed(2)} (apply to set count of every primary lift).

ABSOLUTE RULES:
1. Use NEW PRESCRIBED INTENSITY (${p.newIntensityPercent}%) instead of last cycle's number for every primary lift.
2. Multiply the previous cycle's set count by NEW VOLUME MULTIPLIER (${p.volumeMultiplier.toFixed(2)}) — round to nearest whole set, min 2 sets.
3. If status=fatigued, replace the heaviest scheduled day with active recovery (mobility + zone-2 cardio) regardless of the % above.
============================================================================`;
}

/**
 * Runs the entire pipeline (Steps 0 → 5) deterministically.
 * Optional `rawResults` lets the coach pass test measurements so the
 * scoring + weakness rule kick in. Without them the engine still
 * outputs the prescribed intensity based on level + readiness.
 */
export interface ScientificEngineResult {
  step0_input: ScientificInput;
  step1_readiness: ReadinessResult;
  step2_tests: FitnessTest[];
  step3_testDetails: FitnessTest[]; // same list, kept explicit per spec
  step4_scores: Record<string, number>;
  step5_decision: DecisionOutput;
}

export function runScientificEngine(
  input: ScientificInput,
  rawResults: Record<string, number> = {}
): ScientificEngineResult {
  const tests = selectTests(input.goal);
  const scores = scoreAllTests(tests, rawResults, input.age, input.gender);
  return {
    step0_input: input,
    step1_readiness: checkReadiness(input.readiness),
    step2_tests: tests,
    step3_testDetails: tests,
    step4_scores: scores,
    step5_decision: decideIntensity(input, scores),
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * STEPS 2–6 — CATEGORIZED PHYSICAL TEST BATTERY (per user spec)
 * ─────────────────────────────────────────────────────────────────────
 * 
 * Tests are grouped into 5 categories:
 *   1. القوة      (Strength)
 *   2. التحمل    (Endurance)
 *   3. الكارديو  (Cardio)
 *   4. المرونة   (Flexibility)
 *   5. التوازن   (Balance/Control)
 *
 * Each category has its own index (0–100) and the overall fitness
 * score is the average of all 5 category indices.
 */

export type TestCategory = 'strength' | 'endurance' | 'cardio' | 'flexibility' | 'balance';

/**
 * Risk classification — determines which tests are safe for the user.
 * Computed from age, pain level, injuries, sleep, stress.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Optional safety profile attached to each test — used by the adaptive selector */
export interface TestSafetyProfile {
  /** Maximum risk level allowed to perform this test */
  maxRisk: RiskLevel;
  /** Skip this test if user has any of these injury keywords (Arabic substring match) */
  contraindicatedFor?: string[];
  /** Minimum level required (some advanced lifts require intermediate+) */
  minLevel?: Level;
  /** Maximum age allowed (high-impact tests) */
  maxAge?: number;
}

/** Extended categorized test — backward compatible with the original CategorizedTest */
export interface CategorizedTest {
  id: string;
  nameAr: string;
  nameEn: string;
  category: TestCategory;
  categoryAr: string;
  description: string;
  measurement: string;
  measurementType: 'reps' | 'seconds' | 'kg' | 'cm' | 'time';
  instructions: string;
  inverted?: boolean;
  baseline: { min: number; max: number };
  /** Safety profile — used by selectAdaptiveTests */
  safety?: TestSafetyProfile;
  /** If true, this test requires gym equipment (barbell/bench/cables). Filtered out for home-only clients. */
  requiresGym?: boolean;
}

/** The expanded test library — Adaptive Testing System.
 * STRICTLY SYSTEM-OWNED. The AI is forbidden from inventing or mutating tests. */
export const CATEGORIZED_TESTS: CategorizedTest[] = [
  // ─── القوة (Strength Expanded) ─────────────────────────────────────
  {
    id: 'cat_pushup',
    nameAr: 'تمرين الضغط',
    nameEn: 'Push-ups',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'اعمل أكبر عدد ضغط بشكل صحيح مع الحفاظ على استقامة الجسم',
    measurement: 'عدد التكرارات',
    measurementType: 'reps',
    instructions: 'الجسم مستقيم من الرأس للكاحل، انزل حتى تلمس الصدر الأرض تقريباً، ارجع للأعلى. لا يُسمح بتقوس الظهر.',
    baseline: { min: 0, max: 50 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['كتف', 'رسغ', 'مرفق'] },
  },
  {
    id: 'cat_squat',
    nameAr: 'السكوات',
    nameEn: 'Bodyweight Squat',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'اعمل أكبر عدد سكوات خلال دقيقة',
    measurement: 'عدد التكرارات في دقيقة',
    measurementType: 'reps',
    instructions: 'قف بعرض الكتفين، انزل حتى زاوية 90° مع الحفاظ على الكعب على الأرض. الركبة لا تتعدى القدم.',
    baseline: { min: 0, max: 60 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['ركبة', 'ظهر سفلي'] },
  },
  {
    id: 'cat_bench5rm',
    nameAr: 'ضغط الصدر (5RM)',
    nameEn: 'Bench Press 5RM',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'أقصى وزن تستطيع رفعه 5 مرات بشكل صحيح (5RM)',
    measurement: 'كجم',
    measurementType: 'kg',
    instructions: 'بعد إحماء جيد، ضع وزناً يمكنك رفعه 5 مرات فقط. النظام يحوّل تلقائياً للـ 1RM باستخدام Brzycki.',
    baseline: { min: 0, max: 130 },
    safety: { maxRisk: 'low', minLevel: 'intermediate', contraindicatedFor: ['كتف', 'صدر', 'مرفق'], maxAge: 60 },
    requiresGym: true,
  },
  {
    id: 'cat_deadlift',
    nameAr: 'الديدلفت (5RM)',
    nameEn: 'Deadlift 5RM',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'أقصى وزن تستطيع رفعه 5 مرات بشكل صحيح (5RM)',
    measurement: 'كجم',
    measurementType: 'kg',
    instructions: 'القدمان تحت البار، الظهر مستقيم، الرفع بالأرجل والورك لا بالظهر. النظام يحوّل تلقائياً للـ 1RM.',
    baseline: { min: 0, max: 220 },
    safety: { maxRisk: 'low', minLevel: 'intermediate', contraindicatedFor: ['ظهر', 'فقرات', 'ديسك', 'ركبة'], maxAge: 60 },
    requiresGym: true,
  },
  {
    id: 'cat_pullup',
    nameAr: 'العقلة',
    nameEn: 'Pull-ups',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'أكبر عدد عقلات بشكل صحيح من تعليق كامل',
    measurement: 'عدد التكرارات',
    measurementType: 'reps',
    instructions: 'اشبك البار باليدين بعرض الكتفين، الجسم متعلق بالكامل (Dead Hang). اسحب نفسك حتى تتجاوز ذقنك البار. لا ارجحة.',
    baseline: { min: 0, max: 20 },
    safety: { maxRisk: 'medium', minLevel: 'intermediate', contraindicatedFor: ['كتف', 'مرفق', 'رسغ'] },
    requiresGym: true,
  },
  {
    id: 'cat_shoulder_press',
    nameAr: 'ضغط الكتف (5RM)',
    nameEn: 'Shoulder Press 5RM',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'أقصى وزن لضغط الكتف من الوقوف 5 تكرارات صحيحة',
    measurement: 'كجم',
    measurementType: 'kg',
    instructions: 'قف ثابتاً، البار/الدامبل عند مستوى الكتف. ادفع للأعلى حتى استقامة المرفق دون قوس مفرط في الظهر.',
    baseline: { min: 0, max: 80 },
    safety: { maxRisk: 'medium', minLevel: 'intermediate', contraindicatedFor: ['كتف', 'رقبة', 'ظهر علوي'], maxAge: 65 },
    requiresGym: true,
  },
  {
    id: 'cat_db_curl',
    nameAr: 'دامبل بايسبس (10 تكرارات)',
    nameEn: 'Dumbbell Curl Test',
    category: 'strength',
    categoryAr: 'القوة',
    description: 'أقصى وزن دامبل لكل ذراع تستطيع رفعه 10 مرات صحيحة',
    measurement: 'كجم',
    measurementType: 'kg',
    instructions: 'وقوف، الذراعان بجانب الجسم. ارفع بثبات بدون ارجحة الجذع. سجل وزن الدامبل الواحد.',
    baseline: { min: 0, max: 25 },
    safety: { maxRisk: 'high', contraindicatedFor: ['مرفق', 'رسغ'] },
  },

  // ─── التحمل (Endurance Expanded) ─────────────────────────────────
  {
    id: 'cat_crunch',
    nameAr: 'تمرين البطن (60 ثانية)',
    nameEn: 'Crunches (60s)',
    category: 'endurance',
    categoryAr: 'التحمل',
    description: 'أكبر عدد تكرارات بطن صحيحة خلال 60 ثانية',
    measurement: 'عدد التكرارات',
    measurementType: 'reps',
    instructions: 'استلق على ظهرك مع ثني الركبتين. اليدان خلف الرأس أو على الصدر. ارفع الكتفين عن الأرض مع شهيق عميق.',
    baseline: { min: 0, max: 50 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['رقبة', 'ظهر سفلي', 'ديسك'] },
  },
  {
    id: 'cat_plank',
    nameAr: 'البلانك',
    nameEn: 'Plank Hold',
    category: 'endurance',
    categoryAr: 'التحمل',
    description: 'الثبات على وضع البلانك أطول مدة ممكنة',
    measurement: 'ثانية',
    measurementType: 'seconds',
    instructions: 'استند على الساعدين والأصابع. الجسم مستقيم من الرأس للكاحل. لا هبوط في الورك، لا ارتفاع في المؤخرة.',
    baseline: { min: 0, max: 180 },
    safety: { maxRisk: 'high', contraindicatedFor: ['كتف', 'رسغ'] },
  },
  {
    id: 'cat_wallsit',
    nameAr: 'جلوس الحائط (Wall Sit)',
    nameEn: 'Wall Sit',
    category: 'endurance',
    categoryAr: 'التحمل',
    description: 'الثبات بوضع كرسي وهمي على الحائط أطول مدة ممكنة',
    measurement: 'ثانية',
    measurementType: 'seconds',
    instructions: 'اسند الظهر على الحائط، انزل حتى تكون الفخذ موازية للأرض (90°)، الركبتان فوق الكاحلين. ابدأ التوقيت.',
    baseline: { min: 0, max: 120 },
    safety: { maxRisk: 'high', contraindicatedFor: ['ركبة'] },
  },
  {
    id: 'cat_burpees60',
    nameAr: 'بيربي (60 ثانية)',
    nameEn: 'Burpees (60s)',
    category: 'endurance',
    categoryAr: 'التحمل',
    description: 'أكبر عدد بيربي صحيحة خلال 60 ثانية',
    measurement: 'عدد التكرارات',
    measurementType: 'reps',
    instructions: 'من الوقوف: اهبط للأرض، ضغطة، عد للوقوف، قفزة مع تصفيق فوق الرأس. كرر بأقصى سرعة آمنة.',
    baseline: { min: 0, max: 35 },
    safety: { maxRisk: 'medium', minLevel: 'intermediate', contraindicatedFor: ['ركبة', 'كاحل', 'ظهر', 'قلب'], maxAge: 55 },
  },
  {
    id: 'cat_mountain_climbers',
    nameAr: 'تسلق الجبل (60 ثانية)',
    nameEn: 'Mountain Climbers (60s)',
    category: 'endurance',
    categoryAr: 'التحمل',
    description: 'أكبر عدد لمسات ركبة (لجهة واحدة) من وضع التمرين الكامل',
    measurement: 'عدد لمسات الركبة اليمنى',
    measurementType: 'reps',
    instructions: 'وضع تمرين الضغط، الجسم مستقيم. بدّل الركبتين بسرعة نحو الصدر. عد الركبة اليمنى فقط.',
    baseline: { min: 0, max: 60 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['كتف', 'رسغ', 'ركبة'] },
  },

  // ─── الكارديو (Cardio Expanded) ──────────────────────────────────
  {
    id: 'cat_highknees',
    nameAr: 'رفع الركبة (60 ثانية)',
    nameEn: 'High Knees (1 min)',
    category: 'cardio',
    categoryAr: 'الكارديو',
    description: 'الجري في المكان مع رفع الركبتين لمدة 60 ثانية',
    measurement: 'عدد لمسات القدم اليمنى',
    measurementType: 'reps',
    instructions: 'ارفع الركبة لمستوى الورك أو أعلى. سرعة متوسطة-عالية. عد لمسات القدم اليمنى فقط.',
    baseline: { min: 0, max: 80 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['ركبة', 'كاحل'] },
  },
  {
    id: 'cat_run1km',
    nameAr: 'الجري 1 كيلومتر',
    nameEn: '1km Run',
    category: 'cardio',
    categoryAr: 'الكارديو',
    description: 'اجري 1 كم بأقل وقت ممكن',
    measurement: 'الزمن بالثواني',
    measurementType: 'seconds',
    instructions: 'على مضمار أو جهاز جري. ابدأ الزمن عند الانطلاق. سجل الزمن الكلي بالثواني.',
    inverted: true,
    baseline: { min: 200, max: 480 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['ركبة', 'كاحل', 'قلب'], maxAge: 65 },
  },
  {
    id: 'cat_run3km',
    nameAr: 'الجري 3 كيلومتر',
    nameEn: '3km Run',
    category: 'cardio',
    categoryAr: 'الكارديو',
    description: 'اجري 3 كم بأقل وقت ممكن (اختبار VO₂max المنزلي)',
    measurement: 'الزمن بالثواني',
    measurementType: 'seconds',
    instructions: 'مضمار أو جهاز جري. تحرّك بوتيرة ثابتة. سجل الزمن الكلي بالثواني. هذا اختبار شدة عالية — تأكد من الإحماء.',
    inverted: true,
    baseline: { min: 720, max: 1800 },
    safety: { maxRisk: 'low', minLevel: 'intermediate', contraindicatedFor: ['ركبة', 'كاحل', 'قلب', 'ضغط'], maxAge: 55 },
  },
  {
    id: 'cat_jumprope2',
    nameAr: 'نط الحبل (دقيقتين)',
    nameEn: 'Jump Rope (2 min)',
    category: 'cardio',
    categoryAr: 'الكارديو',
    description: 'أكبر عدد نطّات حبل متواصلة دون توقف خلال دقيقتين',
    measurement: 'عدد النطّات',
    measurementType: 'reps',
    instructions: 'حبل بطول مناسب. ابدأ النط بإيقاع مريح، استمر للدقيقتين. إذا توقفت، استأنف فوراً واحسب الإجمالي.',
    baseline: { min: 0, max: 250 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['ركبة', 'كاحل'], maxAge: 60 },
  },
  {
    id: 'cat_step3min',
    nameAr: 'اختبار الدرج (3 دقائق)',
    nameEn: 'Step Test (3 min)',
    category: 'cardio',
    categoryAr: 'الكارديو',
    description: 'الصعود والنزول على درجة 30سم لمدة 3 دقائق وقياس النبض',
    measurement: 'نبضة/دقيقة بعد 1 دقيقة راحة',
    measurementType: 'reps',
    instructions: 'استخدم درجة بارتفاع 30سم. صعود-صعود-نزول-نزول بإيقاع 24 دورة/دقيقة. بعد 3 دقائق، اجلس واقس نبضك لمدة دقيقة كاملة.',
    inverted: true,
    baseline: { min: 60, max: 160 },
    safety: { maxRisk: 'high', contraindicatedFor: ['قلب', 'ضغط'] },
  },

  // ─── المرونة (Flexibility Expanded) ───────────────────────────────
  {
    id: 'cat_sitreach',
    nameAr: 'اختبار المرونة (Sit & Reach)',
    nameEn: 'Sit & Reach',
    category: 'flexibility',
    categoryAr: 'المرونة',
    description: 'قياس مرونة هامسترينج وأسفل الظهر',
    measurement: 'سم',
    measurementType: 'cm',
    instructions: 'اجلس على الأرض، القدمان مفرودتان أمامك. مد ذراعيك للأمام بالتدريج. سجل أقصى مسافة (ما بعد القدمين = +، قبلهما = -).',
    baseline: { min: -10, max: 25 },
    safety: { maxRisk: 'high' },
  },
  {
    id: 'cat_shoulder_mobility',
    nameAr: 'مرونة الكتف (Apley Scratch)',
    nameEn: 'Shoulder Mobility',
    category: 'flexibility',
    categoryAr: 'المرونة',
    description: 'قياس قدرة الكتفين على الوصول خلف الظهر',
    measurement: 'المسافة بين أصابع اليدين بالسم',
    measurementType: 'cm',
    instructions: 'مد يداً من فوق الكتف إلى أسفل الظهر، والأخرى من تحت إلى أعلى الظهر. حاول لمس الأصابع. قس المسافة (تلامس = 0، تشابك = -).',
    inverted: true,
    baseline: { min: 0, max: 30 },
    safety: { maxRisk: 'high', contraindicatedFor: ['كتف'] },
  },
  {
    id: 'cat_hip_mobility',
    nameAr: 'مرونة الورك (Deep Squat Hold)',
    nameEn: 'Hip Mobility',
    category: 'flexibility',
    categoryAr: 'المرونة',
    description: 'الثبات في وضع السكوات العميق دون رفع الكعب',
    measurement: 'ثانية',
    measurementType: 'seconds',
    instructions: 'انزل لسكوات كامل (الورك تحت الركبة)، الكعب على الأرض، الظهر مستقيم. ابدأ التوقيت حتى ترفع الكعب أو تفقد الوضع.',
    baseline: { min: 0, max: 90 },
    safety: { maxRisk: 'high', contraindicatedFor: ['ركبة', 'كاحل'] },
  },
  {
    id: 'cat_spine_flex',
    nameAr: 'مرونة العمود الفقري (Cat-Cow Range)',
    nameEn: 'Spine Flexibility',
    category: 'flexibility',
    categoryAr: 'المرونة',
    description: 'قياس مدى انحناء وامتداد العمود الفقري من وضع الأربع',
    measurement: 'الدرجة (1=محدود، 10=ممتاز)',
    measurementType: 'reps',
    instructions: 'من وضع الأربع، تحرك ببطء بين Cat (انحناء للأعلى) و Cow (انحناء للأسفل). قيّم نفسك من 1-10 (10 = حركة كاملة بدون ألم).',
    baseline: { min: 1, max: 10 },
    safety: { maxRisk: 'high' },
  },

  // ─── التوازن والتحكم (Balance Expanded) ───────────────────────────
  {
    id: 'cat_balance',
    nameAr: 'الوقوف على رجل واحدة (عيون مفتوحة)',
    nameEn: 'Single-Leg Stand',
    category: 'balance',
    categoryAr: 'التوازن',
    description: 'الوقوف على رجل واحدة بعيون مفتوحة أطول مدة ممكنة',
    measurement: 'ثانية',
    measurementType: 'seconds',
    instructions: 'قف على قدم واحدة، اليدان على الجنبين. سجل الزمن حتى تضع القدم الأخرى أو تخسر التوازن. كرر لكل رجل وخذ المتوسط.',
    baseline: { min: 0, max: 60 },
    safety: { maxRisk: 'high' },
  },
  {
    id: 'cat_balance_eyes_closed',
    nameAr: 'الوقوف على رجل واحدة (عيون مغلقة)',
    nameEn: 'Eyes-Closed Balance',
    category: 'balance',
    categoryAr: 'التوازن',
    description: 'الوقوف على رجل واحدة بعيون مغلقة أطول مدة ممكنة',
    measurement: 'ثانية',
    measurementType: 'seconds',
    instructions: 'قف على قدم واحدة، أغلق عينيك. سجل الزمن حتى تخسر التوازن. كرر مرتين وخذ الأعلى.',
    baseline: { min: 0, max: 45 },
    safety: { maxRisk: 'high' },
  },
  {
    id: 'cat_dynamic_reach',
    nameAr: 'الوصول الديناميكي (Y-Balance)',
    nameEn: 'Dynamic Balance Reach',
    category: 'balance',
    categoryAr: 'التوازن',
    description: 'الوقوف على رجل والوصول بالقدم الأخرى لأبعد نقطة في 3 اتجاهات',
    measurement: 'مجموع المسافات بالسم (3 اتجاهات)',
    measurementType: 'cm',
    instructions: 'قف على رجل، مد القدم الأخرى للأمام، ثم للجنب، ثم للخلف، بأبعد ما يمكنك مع الحفاظ على التوازن. اجمع المسافات الثلاث.',
    baseline: { min: 0, max: 250 },
    safety: { maxRisk: 'medium', contraindicatedFor: ['ركبة', 'كاحل'] },
  },
];

// ─────────────────────────────────────────────────────────────────────
// REHAB TESTS LIBRARY — Injury Assessment for Rehab clients only.
// Admin sends these; client fills them on the "تقييم الإصابة" tab.
// ─────────────────────────────────────────────────────────────────────

export interface RehabTest {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'rom' | 'pain' | 'stability' | 'strength' | 'function';
  categoryAr: string;
  description: string;
  measurement: string;
  instructions: string;
  targetAreas: string[];
  inverted?: boolean;
  baseline: { min: number; max: number };
}

export const REHAB_TESTS: RehabTest[] = [
  // ─── مدى الحركة (ROM) ───────────────────────────────────────────
  {
    id: 'rehab_knee_rom', nameAr: 'مدى حركة الركبة', nameEn: 'Knee Flexion ROM',
    category: 'rom', categoryAr: 'مدى الحركة',
    description: 'قياس أقصى زاوية انحناء لمفصل الركبة',
    measurement: 'درجة', instructions: 'الجلوس على حافة الطاولة، ثنِّ الركبة ببطء حتى أقصى مدى ممكن دون ألم شديد. استخدم مقياس الزاوية (Goniometer). سجل الزاوية.',
    targetAreas: ['ركبة'], baseline: { min: 0, max: 135 },
  },
  {
    id: 'rehab_shoulder_rom', nameAr: 'مدى حركة الكتف (رفع أمامي)', nameEn: 'Shoulder Flexion ROM',
    category: 'rom', categoryAr: 'مدى الحركة',
    description: 'قياس مدى الرفع الأمامي لمفصل الكتف',
    measurement: 'درجة', instructions: 'الوقوف مع ثبات الجذع. ارفع الذراع للأمام ببطء حتى أقصى مدى. قس الزاوية بين الذراع والجسم.',
    targetAreas: ['كتف'], baseline: { min: 0, max: 180 },
  },
  {
    id: 'rehab_ankle_rom', nameAr: 'مدى حركة الكاحل (Background Flexion)', nameEn: 'Ankle Dorsiflexion ROM',
    category: 'rom', categoryAr: 'مدى الحركة',
    description: 'قياس مدى ثني الكاحل للأعلى (Dorsiflexion)',
    measurement: 'درجة', instructions: 'الجلوس بالقدم معلقة. ثنِّ القدم للأعلى (نحو الساق) بأقصى مدى. سجل الزاوية باستخدام Goniometer.',
    targetAreas: ['كاحل', 'قدم'], baseline: { min: 0, max: 20 },
  },
  {
    id: 'rehab_hip_rom', nameAr: 'مدى حركة الورك (دوران داخلي)', nameEn: 'Hip Internal Rotation ROM',
    category: 'rom', categoryAr: 'مدى الحركة',
    description: 'قياس مدى الدوران الداخلي لمفصل الورك',
    measurement: 'درجة', instructions: 'الجلوس على الطاولة مع تعليق الساقين. أدر الساق للداخل (القدم للخارج) بأقصى مدى. سجل الزاوية.',
    targetAreas: ['ورك'], baseline: { min: 0, max: 45 },
  },
  {
    id: 'rehab_lumbar_rom', nameAr: 'مدى حركة أسفل الظهر', nameEn: 'Lumbar Flexion ROM',
    category: 'rom', categoryAr: 'مدى الحركة',
    description: 'قياس مدى انحناء العمود الفقري للأمام',
    measurement: 'سم (المسافة بين أطراف الأصابع والأرض)', instructions: 'الوقوف مع استقامة الساقين. انحنِ للأمام ببطء وامتد بأصابعك نحو الأرض. سجل المسافة المتبقية بين أطراف الأصابع والأرض.',
    targetAreas: ['ظهر', 'فقرات', 'ديسك'], inverted: true, baseline: { min: 0, max: 30 },
  },
  // ─── تقييم الألم (Pain) ──────────────────────────────────────────
  {
    id: 'rehab_pain_vas', nameAr: 'مقياس الألم البصري (VAS)', nameEn: 'Visual Analog Scale',
    category: 'pain', categoryAr: 'تقييم الألم',
    description: 'تقييم شدة الألم حالياً ومع الحركة',
    measurement: 'درجة من 0 إلى 10', instructions: '0 = لا يوجد ألم، 10 = أشد ألم يمكن تخيله. سجل الألم في الراحة أولاً، ثم عند الحركة.',
    targetAreas: ['ركبة', 'ظهر', 'كتف', 'كاحل', 'ورك', 'رقبة'], inverted: true, baseline: { min: 0, max: 10 },
  },
  {
    id: 'rehab_pain_movement', nameAr: 'الألم عند الحركة (NPRS)', nameEn: 'Numeric Pain Rating Scale (Movement)',
    category: 'pain', categoryAr: 'تقييم الألم',
    description: 'تقييم الألم أثناء الحركة المحددة',
    measurement: 'درجة من 0 إلى 10', instructions: 'نفّذ الحركة المؤلمة ببطء (مثل الوقوف، الصعود، رفع الذراع). سجل أعلى مستوى ألم أثناء الحركة.',
    targetAreas: ['ركبة', 'ظهر', 'كتف', 'كاحل', 'ورك'], inverted: true, baseline: { min: 0, max: 10 },
  },
  // ─── الاستقرار والتوازن (Stability) ─────────────────────────────
  {
    id: 'rehab_single_leg', nameAr: 'اختبار الوقوف على رجل واحدة', nameEn: 'Single Leg Stand',
    category: 'stability', categoryAr: 'الاستقرار والتوازن',
    description: 'قياس الاستقرار والتوازن أحادي الرجل',
    measurement: 'ثانية', instructions: 'الوقوف على الرجل المصابة. اليدان على الجنبين. سجل الزمن حتى تفقد التوازن. كرر 3 مرات وخذ الأعلى.',
    targetAreas: ['ركبة', 'كاحل', 'ورك'], baseline: { min: 0, max: 30 },
  },
  {
    id: 'rehab_step_down', nameAr: 'اختبار النزول من الدرج', nameEn: 'Step Down Test',
    category: 'stability', categoryAr: 'الاستقرار والتوازن',
    description: 'تقييم التحكم والاستقرار عند النزول على رجل واحدة',
    measurement: 'تكرارات صحيحة خلال 30 ثانية', instructions: 'قف على درجة سلّم (15-20 سم). انزل ببطء بالرجل الأخرى حتى تلمس الكعب الأرض دون وضع وزن، ثم ارجع للأعلى. سجل عدد التكرارات الصحيحة في 30 ثانية.',
    targetAreas: ['ركبة', 'ورك'], baseline: { min: 0, max: 20 },
  },
  {
    id: 'rehab_ybalance', nameAr: 'اختبار التوازن الديناميكي (Y-Balance)', nameEn: 'Y-Balance Test',
    category: 'stability', categoryAr: 'الاستقرار والتوازن',
    description: 'قياس التوازن الديناميكي في 3 اتجاهات',
    measurement: 'سم (مجموع المسافات الثلاث)', instructions: 'قف على الرجل المصابة. امتد بالقدم الأخرى: للأمام، ثم للخلف-داخل، ثم للخلف-خارج. سجل أبعد نقطة لمست فيها الأرض. اجمع المسافات الثلاث.',
    targetAreas: ['ركبة', 'كاحل', 'ورك'], baseline: { min: 0, max: 200 },
  },
  // ─── القوة الوظيفية (Strength) ───────────────────────────────────
  {
    id: 'rehab_grip', nameAr: 'قوة قبضة اليد', nameEn: 'Grip Strength',
    category: 'strength', categoryAr: 'القوة',
    description: 'قياس قوة قبضة اليد بجهاز Dynamometer',
    measurement: 'كجم', instructions: 'احمل الـ Dynamometer بالوضع الرابع (4th position). اضغط بأقصى قوة لمدة 3 ثواني. كرر 3 مرات وخذ المتوسط. ارتاح 30 ثانية بين المحاولات.',
    targetAreas: ['كتف', 'رسغ', 'مرفق'], baseline: { min: 0, max: 50 },
  },
  {
    id: 'rehab_wall_sit', nameAr: 'جلوس الحائط', nameEn: 'Wall Sit Test',
    category: 'strength', categoryAr: 'القوة',
    description: 'قياس قوة تحمل عضلات الفخذ',
    measurement: 'ثانية', instructions: 'اسند الظهر على الحائط، انزل حتى 90° في الركبة. الكعب على الأرض. سجل الزمن حتى ترفع عن الوضع. توقف إذا كان الألم > 3/10.',
    targetAreas: ['ركبة', 'ورك'], baseline: { min: 0, max: 90 },
  },
  {
    id: 'rehab_heel_raise', nameAr: 'رفع الكعب (Heel Raise)', nameEn: 'Single Heel Raise',
    category: 'strength', categoryAr: 'القوة',
    description: 'قياس قوة عضلات الساق وتحمل الكاحل',
    measurement: 'تكرارات على رجل واحدة', instructions: 'قف على الرجل المصابة. ارفع كعبك للأعلى ببطء (2 ثانية صعود، 2 ثانية نزول). كرر حتى الإجهاد أو الألم > 3/10.',
    targetAreas: ['كاحل', 'قدم'], baseline: { min: 0, max: 25 },
  },
  {
    id: 'rehab_shoulder_ext_rot', nameAr: 'دوران الكتف الخارجي', nameEn: 'Shoulder External Rotation Strength',
    category: 'strength', categoryAr: 'القوة',
    description: 'قياس قوة عضلات المنسوج الدوار (Rotator Cuff)',
    measurement: 'كجم', instructions: 'الجلوس أو الوقوف. الذراع بجانب الجسم، الكوع مثني 90°. أدر الساعد للخارج ضد مقاومة. استخدم Dynamometer أو قس الوزن الأقصى مع 10 تكرارات.',
    targetAreas: ['كتف'], baseline: { min: 0, max: 15 },
  },
  // ─── الوظيفة الحركية (Function) ──────────────────────────────────
  {
    id: 'rehab_tug', nameAr: 'اختبار القيام والمشي (TUG)', nameEn: 'Timed Up and Go Test',
    category: 'function', categoryAr: 'الوظيفة الحركية',
    description: 'قياس الأداء الوظيفي الحركي والخطر من السقوط',
    measurement: 'ثانية', instructions: 'ابدأ جالساً. عند الإشارة: انهض، امشِ 3 أمتار، الدور، العودة، الجلوس. سجل الزمن الكلي. < 12 ثانية = آمن، > 20 ثانية = خطر سقوط مرتفع.',
    targetAreas: ['ركبة', 'ورك', 'ظهر', 'كاحل'], inverted: true, baseline: { min: 8, max: 30 },
  },
  {
    id: 'rehab_plank_stab', nameAr: 'بلانك تثبيت (Core Stability)', nameEn: 'Plank Core Stability',
    category: 'function', categoryAr: 'الوظيفة الحركية',
    description: 'تقييم استقرار القلب (Core) وأسفل الظهر',
    measurement: 'ثانية', instructions: 'وضع البلانك على الساعدين. الجسم مستقيم تماماً. توقف عند الألم > 3/10 أو انهيار الشكل. سجل الزمن.',
    targetAreas: ['ظهر', 'فقرات', 'ديسك'], baseline: { min: 0, max: 120 },
  },
  {
    id: 'rehab_glute_bridge', nameAr: 'الجسر (Glute Bridge)', nameEn: 'Glute Bridge Hold',
    category: 'function', categoryAr: 'الوظيفة الحركية',
    description: 'تقييم تفعيل عضلة الألية وأسفل الظهر',
    measurement: 'ثانية', instructions: 'استلق على ظهرك، ركبتان مثنيتان. ارفع الورك حتى استقامة الجسم. ثبّت الوضع. سجل أطول مدة ممكنة.',
    targetAreas: ['ورك', 'ظهر'], baseline: { min: 0, max: 60 },
  },
];

export const REHAB_CATEGORY_NAMES: Record<string, string> = {
  rom: 'مدى الحركة (ROM)',
  pain: 'تقييم الألم',
  stability: 'الاستقرار والتوازن',
  strength: 'القوة الوظيفية',
  function: 'الوظيفة الحركية',
};

/**
 * Filter rehab tests by client's injury areas (Arabic).
 * Always includes pain & stability tests; then adds area-specific tests.
 */
export function selectRehabTests(injuryAreas: string[]): RehabTest[] {
  const areasLc = (injuryAreas ?? []).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (areasLc.length === 0) {
    return REHAB_TESTS.filter(t => t.category === 'pain' || t.category === 'stability' || t.category === 'function');
  }
  const always = REHAB_TESTS.filter(t => t.category === 'pain' || t.category === 'stability');
  const specific = REHAB_TESTS.filter(t =>
    t.targetAreas.some(area => areasLc.some(inj => inj.includes(area) || area.includes(inj.substring(0, 3))))
  );
  const combined = [...new Map([...always, ...specific].map(t => [t.id, t])).values()];
  return combined;
}

// ─────────────────────────────────────────────────────────────────────
// ADAPTIVE TEST SELECTOR — picks safe tests based on user profile.
// The AI never selects/invents tests; it only consumes the result.
// ─────────────────────────────────────────────────────────────────────

export interface AdaptiveContext {
  age: number;
  gender: Gender;
  level: Level;
  goal: Goal;
  /** Stress 0–10 */
  stress?: number;
  /** Sleep hours per night */
  sleepHours?: number;
  /** Pain 0–10 */
  pain?: number;
  /** Free-text injury / pain points list (Arabic) */
  injuries?: string[];
  /** True if any chronic disease (heart, BP, diabetes, etc.) */
  hasChronicCondition?: boolean;
  /** True if pregnant */
  isPregnant?: boolean;
  /** Training location — filters out gym-only tests for home users */
  location?: 'gym' | 'home' | 'both';
}

/** Compute risk level from profile data */
export function computeRiskLevel(ctx: AdaptiveContext): RiskLevel {
  const pain = ctx.pain ?? 0;
  const stress = ctx.stress ?? 0;
  const sleep = ctx.sleepHours ?? 7;
  const injuries = (ctx.injuries ?? []).filter(Boolean);

  // HIGH risk → only the safest tests (mostly flexibility / static balance)
  if (
    ctx.isPregnant ||
    ctx.hasChronicCondition ||
    ctx.age >= 65 ||
    pain >= 7 ||
    injuries.length >= 3 ||
    sleep < 4
  ) {
    return 'high';
  }

  // MEDIUM risk → no max-effort lifts, no high-impact running
  if (
    ctx.age >= 55 ||
    ctx.age < 16 ||
    pain >= 4 ||
    injuries.length >= 1 ||
    stress >= 8 ||
    sleep < 6 ||
    ctx.level === 'beginner'
  ) {
    return 'medium';
  }

  return 'low';
}

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Filter the test library down to the tests that are SAFE & APPROPRIATE for this user. */
export function selectAdaptiveTests(ctx: AdaptiveContext): CategorizedTest[] {
  const userRisk = computeRiskLevel(ctx);
  const userRiskRank = RISK_RANK[userRisk];
  const userLevelRank = LEVEL_RANK[ctx.level];
  const injuriesLc = (ctx.injuries ?? []).map(s => s.trim()).filter(Boolean);
  const isHomeOnly = ctx.location === 'home';

  return CATEGORIZED_TESTS.filter(test => {
    // 0) Location gate — exclude gym-only tests for home-training clients
    if (isHomeOnly && test.requiresGym) return false;

    const safety = test.safety;
    if (!safety) return true; // unrestricted test

    // 1) Age cap
    if (safety.maxAge !== undefined && ctx.age > safety.maxAge) return false;

    // 2) Risk gate — user risk must be ≤ test's allowed maxRisk
    if (userRiskRank > RISK_RANK[safety.maxRisk]) return false;

    // 3) Level gate
    if (safety.minLevel && userLevelRank < LEVEL_RANK[safety.minLevel]) return false;

    // 4) Injury contraindications (Arabic substring match)
    if (safety.contraindicatedFor && injuriesLc.length > 0) {
      const hit = safety.contraindicatedFor.some(kw =>
        injuriesLc.some(inj => inj.includes(kw))
      );
      if (hit) return false;
    }

    return true;
  });
}

/** Group selected tests by category for clean UI rendering */
export function groupTestsByCategory(tests: CategorizedTest[]): Record<TestCategory, CategorizedTest[]> {
  const groups: Record<TestCategory, CategorizedTest[]> = {
    strength: [], endurance: [], cardio: [], flexibility: [], balance: [],
  };
  for (const t of tests) groups[t.category].push(t);
  return groups;
}

/** Format the adaptive selection summary for an AI prompt (read-only context) */
export function formatAdaptiveSelectionForPrompt(
  ctx: AdaptiveContext,
  selected: CategorizedTest[],
): string {
  const risk = computeRiskLevel(ctx);
  const riskAr = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }[risk];
  const groups = groupTestsByCategory(selected);
  const lines: string[] = [
    '=========== ADAPTIVE TEST SELECTION (SYSTEM-CHOSEN — DO NOT OVERRIDE) ===========',
    `User risk profile: ${riskAr} (${risk})`,
    `Selected ${selected.length} tests across ${Object.values(groups).filter(g => g.length).length} categories.`,
  ];
  for (const cat of Object.keys(groups) as TestCategory[]) {
    const items = groups[cat];
    if (!items.length) continue;
    lines.push(`  • ${CATEGORY_NAMES[cat]} (${items.length}): ${items.map(t => t.nameAr).join('، ')}`);
  }
  lines.push('RULE: The AI may ONLY reference these test names. Do not invent or substitute tests.');
  lines.push('=================================================================================');
  return lines.join('\n');
}

/** Map category to Arabic name */
export const CATEGORY_NAMES: Record<TestCategory, string> = {
  strength:    'القوة',
  endurance:   'التحمل',
  cardio:      'الكارديو',
  flexibility: 'المرونة',
  balance:     'التوازن والتحكم',
};

/** Score a single categorized test (0–100), adjusted by age/gender */
export function scoreCategorizedTest(
  test: CategorizedTest,
  value: number,
  age: number,
  gender: Gender
): number {
  const { min, max } = test.baseline;
  if (isNaN(value) || max === min) return 0;
  let raw: number;
  if (test.inverted) {
    raw = ((max - value) / (max - min)) * 100;
  } else {
    raw = ((value - min) / (max - min)) * 100;
  }
  raw = Math.max(0, Math.min(100, raw));
  const ageMod = ageModifierFor(age);
  const genderMod = gender === 'female' ? 0.9 : 1.0;
  return Math.round(Math.min(100, raw / (ageMod * genderMod)));
}

export interface CategoryIndex {
  category: TestCategory;
  categoryAr: string;
  score: number | null;  // null if no tests in this category were scored
  testCount: number;
  grade?: EvaluationGrade;
}

export interface FitnessAssessmentResult {
  /** Category indices with individual scores */
  categories: CategoryIndex[];
  /** Overall fitness score (average of non-null categories, 0–100) */
  overallScore: number | null;
  overallGrade?: EvaluationGrade;
  /** Category with the lowest score — primary focus for programming */
  weakestCategory: TestCategory | null;
  weakestCategoryAr: string | null;
  /** Per-test raw scores (0–100) */
  testScores: Record<string, number>;
  /** Arabic-language program recommendation based on weakness */
  programRecommendation: string;
}

/**
 * STEP 6 — Compute all category indices and overall fitness score.
 * `rawResults` maps test IDs (e.g. 'cat_pushup') to raw measurements.
 */
export function computeFitnessAssessment(
  rawResults: Record<string, number>,
  age: number,
  gender: Gender,
  level: Level
): FitnessAssessmentResult {
  const testScores: Record<string, number> = {};
  const categoryAccumulators: Record<TestCategory, number[]> = {
    strength: [], endurance: [], cardio: [], flexibility: [], balance: [],
  };

  for (const test of CATEGORIZED_TESTS) {
    const raw = rawResults[test.id];
    if (raw !== undefined && raw !== null && !isNaN(raw)) {
      const score = scoreCategorizedTest(test, raw, age, gender);
      testScores[test.id] = score;
      categoryAccumulators[test.category].push(score);
    }
  }

  const categories: CategoryIndex[] = (Object.keys(categoryAccumulators) as TestCategory[]).map(cat => {
    const scores = categoryAccumulators[cat];
    const catScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    return {
      category: cat,
      categoryAr: CATEGORY_NAMES[cat],
      score: catScore,
      testCount: scores.length,
      grade: catScore !== null ? evaluateScore(catScore) : undefined,
    };
  });

  const scoredCategories = categories.filter(c => c.score !== null);
  const overallScore = scoredCategories.length > 0
    ? Math.round(scoredCategories.reduce((a, c) => a + (c.score ?? 0), 0) / scoredCategories.length)
    : null;

  const weakest = scoredCategories.length > 0
    ? scoredCategories.reduce((a, b) => (b.score ?? 100) < (a.score ?? 100) ? b : a)
    : null;

  const programRecommendation = weakest
    ? buildProgramRecommendation(weakest.category, level)
    : 'أكمل الاختبارات للحصول على توصية مخصصة';

  return {
    categories,
    overallScore,
    overallGrade: overallScore !== null ? evaluateScore(overallScore) : undefined,
    weakestCategory: weakest?.category ?? null,
    weakestCategoryAr: weakest?.categoryAr ?? null,
    testScores,
    programRecommendation,
  };
}

function buildProgramRecommendation(weakness: TestCategory, level: Level): string {
  const splitByLevel: Record<Level, string> = {
    beginner:     '3 أيام Full Body',
    intermediate: '4 أيام — Upper/Lower Split',
    advanced:     '5-6 أيام — Push/Pull/Legs Split',
  };
  const split = splitByLevel[level];
  const focus: Record<TestCategory, string> = {
    strength:    `ضعف القوة — ابدأ كل حصة بتمارين مقاومة مركّبة (Compound Lifts). زد الحمل 5% كل أسبوعين. الأولوية: Bench Press، Squat، Deadlift.`,
    endurance:   `ضعف التحمل — أضف Circuit Training (3-4 جولات × 10-15 تكرار، راحة 30-45 ثانية). زد مجموعة كل أسبوعين.`,
    cardio:      `ضعف الكارديو — أضف 2-3 جلسات Zone-2 Cardio أسبوعياً (20-30 دقيقة × 65% القلب الأقصى). قلّص كل شهر بـ 30 ثانية في كل كم.`,
    flexibility: `ضعف المرونة — 10 دقائق إطالة ثابتة يومياً (هيب فليكسور، هامسترينج، صدر). أضف يوم Mobility أسبوعياً.`,
    balance:     `ضعف التوازن — أضف تمارين التوازن والتثبيت (Single-Leg Deadlift، Bosu Ball Squat). ركّز على الـ Core أولاً.`,
  };
  return `${split} — التركيز الأول على: ${focus[weakness]}`;
}

/** Format the assessment for the AI prompt */
export function formatAssessmentForPrompt(assessment: FitnessAssessmentResult): string {
  const lines: string[] = [
    '=========== PHYSICAL ASSESSMENT (CATEGORIZED — DO NOT OVERRIDE) ===========',
  ];
  if (assessment.overallScore !== null) {
    lines.push(`Overall Fitness Score: ${assessment.overallScore}/100 (${assessment.overallGrade?.label ?? ''})`);
  }
  for (const cat of assessment.categories) {
    if (cat.score !== null) {
      lines.push(`  ${cat.categoryAr}: ${cat.score}/100 (${cat.grade?.label ?? ''})`);
    }
  }
  if (assessment.weakestCategoryAr) {
    lines.push(`WEAKNESS → ${assessment.weakestCategoryAr} (أولوية قصوى في البرنامج)`);
    lines.push(`PROGRAM RECOMMENDATION: ${assessment.programRecommendation}`);
  }
  lines.push('=======================================================================');
  return lines.join('\n');
}

/**
 * Format a result for injection into an LLM prompt as deterministic
 * "RAILS" the model must follow. Keeps prompt tokens small.
 */
export function formatEngineForPrompt(result: ScientificEngineResult): string {
  const { step1_readiness, step5_decision, step2_tests } = result;
  const weakNames = step5_decision.weakAreas
    .map((id) => step2_tests.find((t) => t.id === id)?.nameAr || id)
    .join('، ');

  return `=========== SCIENTIFIC ENGINE OUTPUT (DETERMINISTIC — DO NOT OVERRIDE) ===========
STEP 1 (Readiness): status=${step1_readiness.status}, intensityFactor=${step1_readiness.intensityFactor}.
${step1_readiness.alerts.length ? 'Readiness alerts: ' + step1_readiness.alerts.join(' | ') : ''}

STEP 5 (Decision):
- PRESCRIBED INTENSITY = ${step5_decision.intensityPercent}% of 1RM (use this for all primary compound lifts)
- TARGET RPE = ${step5_decision.targetRPE} | RIR = ${step5_decision.rirRange}
- SUGGESTED REP RANGE = ${step5_decision.repRange}
- GOAL PRIORITY = ${step5_decision.goalPriority}
- WORKOUT SPLIT = ${step5_decision.workoutSplit} (${step5_decision.trainingDaysPerWeek} days/week)
- WEAKNESS RULE: ${weakNames ? `Address these weak areas FIRST in the week: ${weakNames}.` : 'No weak areas detected.'}

ABSOLUTE RULES FOR THE LLM:
1. Every primary lift MUST cite the prescribed intensity (e.g. "3×8 @ ${step5_decision.intensityPercent}% 1RM, ${step5_decision.targetRPE}, ${step5_decision.rirRange}").
2. The first 1-2 exercises of every training day MUST target the weak areas above (when present).
3. If readiness status is "rest", convert ALL training days to active-recovery (mobility + zone-2 + light core).
4. Do NOT exceed the prescribed intensity even if the client is "advanced".
5. Follow the prescribed SPLIT: ${step5_decision.workoutSplit}.
6. If a client is beginner, ALL sessions MUST be Full Body. If intermediate: Upper/Lower. If advanced: Push/Pull/Legs.
7. Progressive overload: increase weight by +2.5% each week. Every 4–6 weeks, include a Deload week (reduce load 10%, volume 35%).
=================================================================================`;
}
