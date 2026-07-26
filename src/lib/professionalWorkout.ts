import type { ProfessionalWorkout, ProfessionalExercise, StructuredExercise, ExerciseSetDetail, PeriodizationBlock, ProgressionAdvice, PRRecord } from '../types';
import { createWorkoutExercise } from './workoutBuilder';
import DEFAULT_PROFESSIONAL_EXERCISES from './professionalExercises';

export function createEmptyProfessionalWorkout(title = 'New Professional Workout') : ProfessionalWorkout {
  return {
    id: `prow-${Date.now()}`,
    title,
    split: 'Full Body',
    exercises: [],
    periodization: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function addExerciseToProfessionalWorkout(workout: ProfessionalWorkout, ex: ProfessionalExercise, scheme?: ExerciseSetDetail): ProfessionalWorkout {
  const structured: StructuredExercise = {
    ...createWorkoutExercise(ex as any),
    details: scheme ? [{ ...scheme }] : [{ sets: '3', reps: '8-12' }],
  };
  return { ...workout, exercises: [...workout.exercises, structured], updatedAt: new Date().toISOString() };
}

export function buildDefaultWarmup(exercise: ProfessionalExercise) : ExerciseSetDetail[] {
  // Simple heuristic: mobility + activation + warmup sets
  return [
    { notes: 'Mobility and dynamic warmup (5-8 min)', scheme: 'normal' },
    { notes: 'Activation sets — light, focus on movement pattern', scheme: 'normal' },
    { sets: '2', reps: '5', loadPercent: '40%', notes: 'Warmup sets progressively increasing', scheme: 'normal' },
  ];
}

export function buildDefaultCooldown(): string[] {
  return [
    'Light static stretching 6-8 minutes focusing on primary movers',
    'Box breathing 3 sets 4-4-4',
    'Foam rolling if available',
  ];
}

export function analyzeProgression(exercise: StructuredExercise, recentPerformance: any): ProgressionAdvice[] {
  const adv: ProgressionAdvice[] = [];
  try {
    const last = recentPerformance?.last || {};
    const rpe = Number(last.rpe || exercise.details?.[0]?.rpe || 0);
    const completion = Number(recentPerformance?.completionPercent || 100);
    if (rpe >= 9 && completion >= 95) {
      const raw = exercise.details?.[0]?.loadPercent || '';
      const pct = typeof raw === 'string' ? raw.replace('%','') : String(raw);
      adv.push({ action: 'increase_weight', reason: 'High RPE with completed sets', suggestedValues: { loadPercent: `${pct || '5'}%` } });
    }
    if (completion < 70) {
      adv.push({ action: 'decrease_weight', reason: 'Low completion percent; reduce load to maintain technique' });
    }
  } catch (e) { /* ignore */ }
  return adv;
}

export function estimateTonnage(workout: ProfessionalWorkout) : number {
  let total = 0;
  for (const ex of workout.exercises) {
    const sets = Number(ex.details?.[0]?.sets || 0);
    const reps = Number(String(ex.details?.[0]?.reps || '').split('-')[0] || 0);
    const weight = Number((ex.performedWeight || ex.weight || 0) as any) || 0;
    total += sets * reps * weight;
  }
  return total;
}

export function createPeriodizationBlock(name: string, type: PeriodizationBlock['type'], weeks: number, intensityFrom = 60, intensityTo = 80, volumeMultiplier = 1, progressionStrategy = 'linear'): PeriodizationBlock {
  return { id: `${type}-${Date.now()}`, name, type, weeks, intensityRange: { from: intensityFrom, to: intensityTo }, volumeMultiplier, progressionStrategy };
}

export function recordPR(prs: PRRecord[], newPr: PRRecord) : PRRecord[] {
  return [...prs, { ...newPr, id: newPr.id || `pr-${Date.now()}` }];
}

// Expose available default professional exercises
export const AVAILABLE_PRO_EXERCISES = DEFAULT_PROFESSIONAL_EXERCISES;

export default {
  createEmptyProfessionalWorkout,
  addExerciseToProfessionalWorkout,
  buildDefaultWarmup,
  buildDefaultCooldown,
  analyzeProgression,
  estimateTonnage,
  createPeriodizationBlock,
  recordPR,
};
