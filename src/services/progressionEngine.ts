/**
 * Advanced Progression Engine
 * Automatically progresses programs using multiple strategies
 */
import { safeGenerateContent } from './aiMasterEngine';
import type { StructuredExercise, ExerciseSetDetail } from '../types';

export interface ProgressionRecommendation {
  action: 'add_weight' | 'add_reps' | 'add_sets' | 'add_day' | 'increase_frequency' | 'swap_exercise' | 'deload' | 'reduce_volume';
  amount?: number | string;
  reason: string;
  nextValue?: Partial<ExerciseSetDetail>;
  estimatedResult?: string;
}

export interface ProgressionMetrics {
  exerciseName: string;
  avgWeight: number;
  avgReps: number;
  avgVolume: number;
  avgRPE: number;
  progressionRate: number; // % increase over period
  sessionCount: number;
  lastSessionDate: string;
  estimatedPlateauDate?: string;
}

// Progressive Overload Strategies

export function progressiveOverload(current: ExerciseSetDetail, metrics: ProgressionMetrics): ProgressionRecommendation | null {
  const weight = typeof current.weight === 'string' ? parseFloat(current.weight) : current.weight || 0;
  const reps = typeof current.reps === 'string' ? parseFloat(current.reps) : parseFloat(current.reps || '0');
  const sets = typeof current.sets === 'string' ? parseFloat(current.sets) : parseFloat(current.sets || '3');

  if (weight === 0 || reps === 0) return null;

  const rpe = parseFloat(current.rpe || '7');
  const rir = parseFloat(current.rir || '2');

  // If RPE < 6, increase weight by 5%
  if (rpe < 6) {
    const newWeight = Math.round(weight * 1.05 * 100) / 100;
    return {
      action: 'add_weight',
      amount: newWeight - weight,
      reason: 'RPE too low - increase load',
      nextValue: { weight: newWeight },
      estimatedResult: `Estimated new RPE: ${(rpe + 1).toFixed(1)}`,
    };
  }

  // If RPE 6-7, increase reps
  if (rpe >= 6 && rpe <= 7 && rir >= 2) {
    const targetReps = `${reps}-${Math.floor(reps) + 2}`;
    return {
      action: 'add_reps',
      reason: 'Good form stability - progress reps',
      nextValue: { reps: targetReps, targetReps },
      estimatedResult: `New rep range: ${targetReps}. Reset weight once all reps achieved.`,
    };
  }

  // If RPE 8-9, add set
  if (rpe >= 8) {
    const newSets = Math.round(sets) + 1;
    return {
      action: 'add_sets',
      amount: 1,
      reason: 'High RPE with good form - add volume',
      nextValue: { sets: String(newSets) },
      estimatedResult: `${newSets} sets. Total volume increase ~${((newSets / sets - 1) * 100).toFixed(0)}%`,
    };
  }

  return null;
}

export function doubleProgression(current: ExerciseSetDetail, targetReps: string): ProgressionRecommendation | null {
  const weight = typeof current.weight === 'string' ? parseFloat(current.weight) : current.weight || 0;
  const reps = typeof current.reps === 'string' ? parseFloat(current.reps) : parseFloat(current.reps || '0');
  const targetUpper = parseFloat(targetReps.split('-')[1] || String(reps + 3));

  if (weight === 0 || reps === 0) return null;

  // Phase 1: Increase reps at same weight
  if (reps < targetUpper) {
    return {
      action: 'add_reps',
      reason: `Double progression: increase reps to ${targetUpper}`,
      nextValue: { reps: String(reps + 1) },
      estimatedResult: `Once you hit ${targetUpper} reps, increase weight by 5%.`,
    };
  }

  // Phase 2: Increase weight, reset reps
  if (reps >= targetUpper) {
    const newWeight = Math.round(weight * 1.05 * 100) / 100;
    const resetReps = Math.max(3, Math.floor(reps - 2));
    return {
      action: 'add_weight',
      amount: newWeight - weight,
      reason: `Double progression: weight increase after ${targetUpper} reps achieved`,
      nextValue: { weight: newWeight, reps: String(resetReps) },
      estimatedResult: `New cycle: ${resetReps} reps at ${newWeight}kg. Progress to ${targetUpper} reps again.`,
    };
  }

  return null;
}

export function rpeProgression(current: ExerciseSetDetail, targetRPE: number = 8): ProgressionRecommendation | null {
  const rpe = parseFloat(current.rpe || '7');
  const weight = typeof current.weight === 'string' ? parseFloat(current.weight) : current.weight || 0;

  if (rpe < targetRPE && weight > 0) {
    const increment = weight * 0.025; // 2.5% increments
    const newWeight = Math.round((weight + increment) * 100) / 100;
    return {
      action: 'add_weight',
      amount: newWeight - weight,
      reason: `RPE progression - target RPE ${targetRPE}`,
      nextValue: { weight: newWeight },
      estimatedResult: `Estimated new RPE: ${targetRPE}. Monitor form closely.`,
    };
  }

  return null;
}

export function volumeProgression(current: ExerciseSetDetail, progressionRate: number = 1.1): ProgressionRecommendation | null {
  const weight = typeof current.weight === 'string' ? parseFloat(current.weight) : current.weight || 0;
  const sets = typeof current.sets === 'string' ? parseFloat(current.sets) : parseFloat(current.sets || '3');
  const reps = typeof current.reps === 'string' ? parseFloat(current.reps) : parseFloat(current.reps || '8');

  const currentVolume = weight * sets * reps;
  const targetVolume = currentVolume * progressionRate;

  // Prefer increasing reps first
  const newReps = targetVolume / (weight * sets);
  if (newReps <= reps * 1.25) {
    // Reps increase is reasonable
    return {
      action: 'add_reps',
      reason: 'Volume progression (reps)',
      nextValue: { reps: Math.round(newReps).toString() },
      estimatedResult: `Volume increase from ${Math.round(currentVolume)} to ${Math.round(targetVolume)}kg`,
    };
  }

  // Otherwise increase weight
  const newWeight = Math.round((targetVolume / (sets * reps)) * 100) / 100;
  return {
    action: 'add_weight',
    amount: newWeight - weight,
    reason: 'Volume progression (weight)',
    nextValue: { weight: newWeight },
    estimatedResult: `Volume increase from ${Math.round(currentVolume)} to ${Math.round(targetVolume)}kg`,
  };
}

export function intensityProgression(current: ExerciseSetDetail, percentageIncrease: number = 5): ProgressionRecommendation | null {
  const weight = typeof current.weight === 'string' ? parseFloat(current.weight) : current.weight || 0;

  if (weight <= 0) return null;

  const newWeight = Math.round((weight * (1 + percentageIncrease / 100)) * 100) / 100;

  return {
    action: 'add_weight',
    amount: newWeight - weight,
    reason: `Intensity progression (+${percentageIncrease}%)`,
    nextValue: { weight: newWeight },
    estimatedResult: `Weight increase: ${weight}kg → ${newWeight}kg (${percentageIncrease}%)`,
  };
}

// Fatigue & Overtraining Detection

export interface FatigueAnalysis {
  isFatigued: boolean;
  overtraining: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  recommendations: string[];
  adjustmentStrategy: 'maintain' | 'reduce' | 'deload' | 'rest';
}

export function analyzeFatigue(metrics: {
  avgRPE: number;
  adherence: number;
  recentPRs: boolean;
  sleepHours?: number;
  stressLevel?: number;
  sessionFrequency: number;
}): FatigueAnalysis {
  const issues: string[] = [];
  let severity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';

  // Check for overtraining indicators
  if (metrics.avgRPE >= 8 && metrics.sessionFrequency >= 5) {
    issues.push('High RPE with high frequency');
    severity = 'moderate';
  }

  if ((metrics.sleepHours || 8) < 6) {
    issues.push('Insufficient sleep (<6 hours)');
    severity = severity === 'none' ? 'mild' : 'moderate';
  }

  if ((metrics.stressLevel || 5) >= 7) {
    issues.push('High stress level');
    severity = severity === 'none' ? 'mild' : 'moderate';
  }

  if (metrics.adherence < 60 && metrics.avgRPE >= 8) {
    issues.push('Poor adherence despite high intensity');
    severity = 'moderate';
  }

  if (!metrics.recentPRs && metrics.avgRPE >= 8 && metrics.sessionFrequency >= 4) {
    issues.push('No recent PRs despite high volume');
    severity = 'severe';
  }

  const isFatigued = severity !== 'none';
  const overtraining = severity === 'severe' || (issues.length >= 3 && metrics.avgRPE >= 8);

  const adjustmentStrategy: 'maintain' | 'reduce' | 'deload' | 'rest' =
    severity === 'severe' ? 'deload' : severity === 'moderate' ? 'reduce' : 'maintain';

  const recommendations: string[] = [];
  if (isFatigued) {
    recommendations.push(`Adjust intensity: ${adjustmentStrategy}`);
    if ((metrics.sleepHours || 8) < 7) {
      recommendations.push('Prioritize 7-9 hours of sleep');
    }
    if ((metrics.stressLevel || 5) >= 7) {
      recommendations.push('Reduce stress through recovery (massage, meditation, yoga)');
    }
  }

  return {
    isFatigued,
    overtraining,
    severity,
    recommendations,
    adjustmentStrategy,
  };
}

// AI Progression Generation

export async function generateAIProgression(
  exercise: StructuredExercise,
  metrics: ProgressionMetrics
): Promise<ProgressionRecommendation | null> {
  try {
    const system = `You are an elite strength coach. Given an exercise's current metrics and performance, generate the next progression recommendation. Return JSON: { action: "add_weight"|"add_reps"|"add_sets"|"swap_exercise"|"deload", amount?: number, reason: string, estimatedResult: string }`;

    const prompt = `Exercise: ${exercise.name}
Current: ${metrics.avgWeight}kg × ${metrics.avgReps} reps
Sessions: ${metrics.sessionCount}
Avg RPE: ${metrics.avgRPE}
Volume: ${metrics.avgVolume}kg
Progression: ${metrics.progressionRate.toFixed(1)}% over period
Last session: ${metrics.lastSessionDate}`;

    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);

    return {
      action: parsed.action || 'add_weight',
      amount: parsed.amount,
      reason: parsed.reason || '',
      estimatedResult: parsed.estimatedResult,
    };
  } catch (e) {
    return null;
  }
}

export async function generateDeloadWeek(currentBlock: any): Promise<{ adjustments: Partial<ExerciseSetDetail>[]; recommendations: string[] } | null> {
  try {
    const system = `You are a recovery specialist. Given current training parameters, generate a deload week with 50% volume, reduced intensity. Return JSON: { adjustments: [{ sets, reps, weight, intensity }], tips: string[] }`;

    const prompt = `Current block intensity: ${currentBlock.intensityRange?.to || 80}%, Volume: Normal, Sessions: ${currentBlock.weeks || 4} weeks`;

    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);

    return {
      adjustments: parsed.adjustments || [{ sets: '2', reps: '8', loadPercent: '50' }],
      recommendations: parsed.tips || ['Use this week for mobility work', 'Focus on form and technique', 'Get extra sleep and recovery'],
    };
  } catch (e) {
    return null;
  }
}
