import type { ProfessionalWorkout, PRRecord } from '../types';

export function computeWeeklyVolume(workouts: ProfessionalWorkout[]) {
  // simple sum of estimated tonnage per workout
  const total = workouts.reduce((s, w) => s + (w.exercises.reduce((t, ex) => {
    const sets = Number(ex.details?.[0]?.sets || 0);
    const reps = Number(String(ex.details?.[0]?.reps || '').split('-')[0] || 0);
    const weight = Number((ex.performedWeight || ex.weight || 0) as any) || 0;
    return t + sets * reps * weight;
  }, 0)), 0);
  return total;
}

export function summarizePRs(prs: PRRecord[]) {
  const byExercise: Record<string, PRRecord[]> = {};
  for (const p of prs) {
    byExercise[p.exerciseName] = [...(byExercise[p.exerciseName] || []), p];
  }
  const summary = Object.entries(byExercise).map(([name, records]) => ({ exercise: name, max: Math.max(...records.map(r => r.weight)), latest: records.sort((a,b)=> (new Date(b.date||0).getTime()) - (new Date(a.date||0).getTime()))[0] }));
  return summary;
}

export default { computeWeeklyVolume, summarizePRs };
