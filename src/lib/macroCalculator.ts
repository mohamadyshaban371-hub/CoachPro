/**
 * macroCalculator.ts — Deterministic Mifflin-St Jeor + activity multiplier
 * + macro split. The aiMasterEngine.generateNutritionPlan calls this BEFORE
 * the LLM and forwards the numbers as hard rails, so the calorie / macro
 * targets are identical every run regardless of model drift.
 *
 * Formulas (April-2026 spec):
 *   BMR (male)   = 10*W + 6.25*H - 5*A + 5
 *   BMR (female) = 10*W + 6.25*H - 5*A - 161
 *   TDEE         = BMR × activity multiplier
 *   Activity multipliers:
 *     sedentary 1.2  | light 1.375 | moderate 1.55 | high 1.725
 *   Calorie targets (by goal):
 *     loss   = TDEE × 0.80   (≈ -500 kcal, max 20% deficit)
 *     shape  = TDEE × 0.90
 *     fitness= TDEE × 1.00
 *     bulk   = TDEE × 1.10   (≈ +250–500 kcal surplus)
 *     rehab  = TDEE × 1.00
 *   Protein g/kg by goal:
 *     loss/shape = 1.6 – 2.2  (use 2.0)
 *     bulk       = 1.8 – 2.5  (use 2.2)
 *     fitness    = 1.6
 *     rehab      = 1.6
 *   Fat = 25% of calories (clamped to 20–30%)
 *   Carbs = remainder
 */

export type Gender = 'male' | 'female';
export type Goal = 'shape' | 'loss' | 'bulk' | 'fitness' | 'rehab';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const GOAL_CAL_FACTOR: Record<Goal, number> = {
  loss: 0.8,
  shape: 0.9,
  fitness: 1.0,
  rehab: 1.0,
  bulk: 1.1,
};

const GOAL_PROTEIN_GKG: Record<Goal, number> = {
  loss: 2.0,
  shape: 2.0,
  fitness: 1.6,
  rehab: 1.6,
  bulk: 2.2,
};

export interface MacroInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  goal: Goal;
  activityLevel: ActivityLevel;
  /** Optional: number of training sessions per week. Used to nudge the
   *  activity multiplier upward when the user reports light activity but
   *  trains 5+ times a week. */
  workoutFrequencyPerWeek?: number;
  /** Optional: recent weight history to detect trend and auto-adjust calories */
  weightHistory?: Array<{ date: string; weight: number }>;
  /** Optional: daily stress level (1–10) to reduce calories on high-stress days */
  stressLevel?: number;
  /**
   * Population category — drives fat% selection.
   *   standard  → 25%  (default)
   *   athlete   → 20–22% (higher protein needs, leaner fat target)
   *   pregnant  → 30%  (essential fatty-acids for foetal development)
   *   nursing   → 30%  (DHA/AA transfer via milk)
   *   sick      → 28%  (rehab / chronic illness — anti-inflammatory bias)
   */
  population?: 'standard' | 'athlete' | 'pregnant' | 'nursing' | 'sick';
}

export interface MacroOutput {
  bmr: number;
  tdee: number;
  /** Final calorie target after applying the goal factor */
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterLiters: number;
  /** Step-by-step rationale for the coach to audit */
  rationale: string[];
  /** Auto-adjustment applied based on weight trend (+/- kcal) */
  calorieAdjustment?: number;
  /** Weight trend description */
  weightTrend?: string;
}

export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/** Pick an activity multiplier, with a small auto-bump if the user trains
 *  frequently but reported a low daily activity level. */
export function resolveActivityMultiplier(
  level: ActivityLevel,
  workoutFrequencyPerWeek = 0,
): number {
  let mult = ACTIVITY_MULT[level];
  if (level === 'sedentary' && workoutFrequencyPerWeek >= 4) mult = ACTIVITY_MULT.light;
  if (level === 'light' && workoutFrequencyPerWeek >= 5) mult = ACTIVITY_MULT.moderate;
  return mult;
}

/**
 * Compute weight trend from history (last 2 weeks).
 * Returns { trend, adjustment } where adjustment is +/- kcal to apply.
 */
function computeWeightTrendAdjustment(
  goal: Goal,
  history: Array<{ date: string; weight: number }>,
): { adjustment: number; trend: string } {
  if (!history || history.length < 2) return { adjustment: 0, trend: 'غير كافٍ' };

  // Sort by date ascending, take last 4 entries
  const sorted = [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-4);

  if (sorted.length < 2) return { adjustment: 0, trend: 'غير كافٍ' };

  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const daysDiff = Math.max(
    1,
    (new Date(newest.date).getTime() - new Date(oldest.date).getTime()) / 86_400_000,
  );
  const weeklyChange = ((newest.weight - oldest.weight) / daysDiff) * 7;
  const changePercent = (weeklyChange / oldest.weight) * 100;

  // Stalled (< 0.3 kg/week change) when goal is loss or bulk
  if (goal === 'loss' || goal === 'shape') {
    if (Math.abs(weeklyChange) < 0.3) {
      return { adjustment: -200, trend: `الوزن ثابت (${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(2)} كجم/أسبوع) — تخفيض 200 kcal` };
    }
    if (changePercent > 1) {
      return { adjustment: +200, trend: `الوزن ينزل بسرعة (${weeklyChange.toFixed(2)} كجم/أسبوع) — رفع 200 kcal لحماية العضل` };
    }
    if (weeklyChange < -1) {
      return { adjustment: +150, trend: `الوزن ينزل أسرع من المطلوب — رفع 150 kcal` };
    }
    return { adjustment: 0, trend: `معدل مناسب (${weeklyChange.toFixed(2)} كجم/أسبوع)` };
  }

  if (goal === 'bulk') {
    if (changePercent > 1) {
      return { adjustment: -250, trend: `وزن يرتفع بسرعة (${weeklyChange.toFixed(2)} كجم/أسبوع) — تقليل 250 kcal للحد من الدهون` };
    }
    if (Math.abs(weeklyChange) < 0.2) {
      return { adjustment: +200, trend: `الوزن ثابت — رفع 200 kcal لتحقيق الـ Bulk` };
    }
    return { adjustment: 0, trend: `معدل مناسب (${weeklyChange.toFixed(2)} كجم/أسبوع)` };
  }

  return { adjustment: 0, trend: `ثابت (${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(2)} كجم/أسبوع)` };
}

export function calculateMacros(input: MacroInput): MacroOutput {
  const { weightKg, heightCm, age, gender, goal, activityLevel, workoutFrequencyPerWeek, weightHistory, stressLevel } = input;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const mult = resolveActivityMultiplier(activityLevel, workoutFrequencyPerWeek);
  const tdee = Math.round(bmr * mult);
  const baseCalories = Math.round(tdee * GOAL_CAL_FACTOR[goal]);

  // Auto-adjust calories based on weight trend
  const { adjustment, trend } = computeWeightTrendAdjustment(goal, weightHistory || []);

  // Stress penalty: high stress (>7) reduces calories by 100 (less activity)
  const stressPenalty = (stressLevel && stressLevel > 7) ? -100 : 0;

  const calories = Math.max(1200, baseCalories + adjustment + stressPenalty);

  // Population-specific protein override (special populations take precedence over goal defaults)
  const popProteinGkg: Partial<Record<NonNullable<MacroInput['population']>, number>> = {
    pregnant: 1.1,
    nursing:  1.3,
    sick:     1.2,
  };
  const proteinGkg = popProteinGkg[input.population ?? 'standard'] ?? GOAL_PROTEIN_GKG[goal];
  const proteinG = Math.round(weightKg * proteinGkg);

  // Dynamic fat% by population + goal
  const fatPct = (() => {
    const pop = input.population || 'standard';
    if (pop === 'pregnant' || pop === 'nursing') return 0.30;
    if (pop === 'sick')    return 0.28;
    if (pop === 'athlete') return goal === 'loss' ? 0.22 : 0.20;
    if (goal === 'bulk')   return 0.22;
    return 0.25;  // standard + loss/shape/fitness/rehab
  })();
  const fatG = Math.round((calories * fatPct) / 9);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsKcal = Math.max(0, calories - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  // Hydration: 35 ml/kg, clamped 2–4 L
  const waterLiters = Math.max(2, Math.min(4, Math.round((weightKg * 35) / 100) / 10));

  const rationale = [
    `BMR (Mifflin-St Jeor) = ${bmr} kcal`,
    `Activity multiplier = ×${mult.toFixed(3)} (${activityLevel}${workoutFrequencyPerWeek ? `, ${workoutFrequencyPerWeek}×/wk` : ''})`,
    `TDEE = ${tdee} kcal`,
    `Goal factor = ×${GOAL_CAL_FACTOR[goal].toFixed(2)} (${goal}) → ${baseCalories} kcal`,
    `Weight trend adjustment = ${adjustment >= 0 ? '+' : ''}${adjustment} kcal (${trend})`,
    ...(stressPenalty !== 0 ? [`Stress penalty = ${stressPenalty} kcal (ضغط نفسي مرتفع)`] : []),
    `Final target = ${calories} kcal`,
    `Protein = ${proteinGkg} g/kg × ${weightKg} kg = ${proteinG} g${input.population && input.population !== 'standard' ? ` (${input.population} population)` : ''}`,
    `Fat = ${(fatPct * 100).toFixed(0)}% of calories ÷ 9 = ${fatG} g${input.population && input.population !== 'standard' ? ` (${input.population})` : ''}`,
    `Carbs = remainder = ${carbsG} g`,
    `Water target = ${waterLiters} L (35 ml/kg)`,
  ];

  return {
    bmr,
    tdee,
    calories,
    proteinG,
    fatG,
    carbsG,
    waterLiters,
    rationale,
    calorieAdjustment: adjustment + stressPenalty,
    weightTrend: trend,
  };
}
