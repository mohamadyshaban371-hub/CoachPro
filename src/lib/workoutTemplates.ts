/**
 * Built-in Workout Templates Library
 * Pre-configured professional training programs
 */
import DEFAULT_PROFESSIONAL_EXERCISES from './professionalExercises';
import type { WorkoutTemplate, WorkoutExercise } from '../types';

function createTemplate(name: string, category: string, exercises: WorkoutExercise[]): WorkoutTemplate {
  return {
    id: `template-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    category: category as any,
    description: `Professional ${name} training template`,
    exercises,
    createdAt: new Date().toISOString(),
  };
}

// Utility to get exercises by muscle group
function getExercisesByMuscle(muscles: string[], count: number = 3): WorkoutExercise[] {
  const filtered = DEFAULT_PROFESSIONAL_EXERCISES.filter(ex =>
    muscles.some(m => (ex.muscleGroup || '').toLowerCase().includes(m.toLowerCase()))
  );

  return filtered.slice(0, count).map(ex => ({
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    difficulty: ex.difficulty,
    sets: '3',
    reps: '8-10',
    tempo: '2-0-2-0',
    rest: '60s',
    rpe: '7',
  }));
}

export const BUILT_IN_TEMPLATES: WorkoutTemplate[] = [
  // Push Pull Legs Split
  createTemplate('PPL - Push', 'Push', [
    ...getExercisesByMuscle(['chest', 'shoulder'], 3),
    ...getExercisesByMuscle(['triceps'], 2),
  ]),
  createTemplate('PPL - Pull', 'Pull', [
    ...getExercisesByMuscle(['back', 'lats'], 3),
    ...getExercisesByMuscle(['biceps'], 2),
  ]),
  createTemplate('PPL - Legs', 'Legs', [
    ...getExercisesByMuscle(['quads', 'legs'], 2),
    ...getExercisesByMuscle(['hamstring', 'glutes'], 2),
    ...getExercisesByMuscle(['calves'], 1),
  ]),

  // Upper Lower Split
  createTemplate('Upper Lower - Upper Power', 'Upper', [
    ...getExercisesByMuscle(['chest', 'back'], 2),
    ...getExercisesByMuscle(['shoulder'], 1),
    ...getExercisesByMuscle(['arms'], 2),
  ]),
  createTemplate('Upper Lower - Lower Power', 'Lower', [
    ...getExercisesByMuscle(['quads'], 2),
    ...getExercisesByMuscle(['hamstring'], 1),
    ...getExercisesByMuscle(['glutes'], 1),
    ...getExercisesByMuscle(['calves'], 1),
  ]),
  createTemplate('Upper Lower - Upper Hypertrophy', 'Upper', [
    ...getExercisesByMuscle(['chest'], 2),
    ...getExercisesByMuscle(['back'], 2),
    ...getExercisesByMuscle(['shoulder', 'arms'], 2),
  ]),
  createTemplate('Upper Lower - Lower Hypertrophy', 'Lower', [
    ...getExercisesByMuscle(['quads'], 2),
    ...getExercisesByMuscle(['hamstring', 'glutes'], 2),
    ...getExercisesByMuscle(['calves'], 1),
  ]),

  // Arnold Split
  createTemplate('Arnold Split - Chest/Back', 'Custom', [
    ...getExercisesByMuscle(['chest'], 2),
    ...getExercisesByMuscle(['back'], 2),
    ...getExercisesByMuscle(['shoulder'], 1),
  ]),
  createTemplate('Arnold Split - Shoulder/Arms', 'Custom', [
    ...getExercisesByMuscle(['shoulder'], 2),
    ...getExercisesByMuscle(['biceps', 'triceps'], 3),
  ]),
  createTemplate('Arnold Split - Legs', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes'], 3),
    ...getExercisesByMuscle(['calves'], 1),
  ]),

  // Bro Split
  createTemplate('Bro Split - Chest', 'Push', [
    ...getExercisesByMuscle(['chest'], 4),
    ...getExercisesByMuscle(['triceps'], 1),
  ]),
  createTemplate('Bro Split - Back', 'Pull', [
    ...getExercisesByMuscle(['back'], 4),
    ...getExercisesByMuscle(['biceps'], 1),
  ]),
  createTemplate('Bro Split - Shoulders', 'Custom', [
    ...getExercisesByMuscle(['shoulder'], 5),
  ]),
  createTemplate('Bro Split - Arms', 'Custom', [
    ...getExercisesByMuscle(['biceps', 'triceps'], 5),
  ]),
  createTemplate('Bro Split - Legs', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes'], 4),
  ]),

  // Full Body Splits
  createTemplate('Full Body A', 'Full Body', [
    ...getExercisesByMuscle(['chest', 'back', 'quads'], 3),
    ...getExercisesByMuscle(['shoulder'], 1),
    ...getExercisesByMuscle(['core'], 1),
  ]),
  createTemplate('Full Body B', 'Full Body', [
    ...getExercisesByMuscle(['back', 'chest', 'hamstring'], 3),
    ...getExercisesByMuscle(['shoulder'], 1),
    ...getExercisesByMuscle(['abs'], 1),
  ]),

  // Powerlifting Focused
  createTemplate('Starting Strength', 'Custom', [
    { id: 'squat', name: 'Back Squat', sets: '3', reps: '5', tempo: '3-1-2-1', rest: '3m', rpe: '8' } as any,
    { id: 'bench', name: 'Bench Press', sets: '3', reps: '5', tempo: '2-1-2-1', rest: '3m', rpe: '8' } as any,
    { id: 'row', name: 'Barbell Row', sets: '3', reps: '5', tempo: '2-1-2-1', rest: '3m', rpe: '8' } as any,
  ]),

  createTemplate('StrongLifts 5x5', 'Custom', [
    { id: 'squat', name: 'Back Squat', sets: '5', reps: '5', tempo: '3-1-2-1', rest: '2m', rpe: '8' } as any,
    { id: 'bench', name: 'Bench Press', sets: '5', reps: '5', tempo: '2-1-2-1', rest: '2m', rpe: '8' } as any,
    { id: 'row', name: 'Barbell Row', sets: '5', reps: '5', tempo: '2-1-2-1', rest: '2m', rpe: '8' } as any,
  ]),

  createTemplate('5/3/1 - Main Lift', 'Custom', [
    { id: 'main', name: 'Main Lift (Squat/Bench/Deadlift/OHP)', sets: '3-5', reps: '3-5-1', tempo: '2-1-2-0', rest: '3-5m', rpe: '8-9' } as any,
    ...getExercisesByMuscle(['core', 'accessories'], 3),
  ]),

  // Bodybuilding/Hypertrophy
  createTemplate('PHAT - Power Upper', 'Upper', [
    ...getExercisesByMuscle(['chest', 'back'], 2),
    ...getExercisesByMuscle(['shoulder'], 1),
    ...getExercisesByMuscle(['arms'], 1),
  ]),
  createTemplate('PHAT - Hypertrophy Upper', 'Upper', [
    ...getExercisesByMuscle(['chest', 'back', 'shoulder'], 3),
    ...getExercisesByMuscle(['arms'], 2),
  ]),
  createTemplate('PHAT - Power Lower', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes'], 3),
  ]),
  createTemplate('PHAT - Hypertrophy Lower', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes', 'calves'], 4),
  ]),

  createTemplate('PHUL - Power Upper', 'Upper', [
    ...getExercisesByMuscle(['chest', 'back', 'shoulder'], 2),
    ...getExercisesByMuscle(['arms'], 2),
  ]),
  createTemplate('PHUL - Hypertrophy Upper', 'Upper', [
    ...getExercisesByMuscle(['chest', 'back', 'shoulder'], 3),
    ...getExercisesByMuscle(['arms'], 2),
  ]),
  createTemplate('PHUL - Power Lower', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring'], 2),
    ...getExercisesByMuscle(['glutes', 'calves'], 2),
  ]),
  createTemplate('PHUL - Hypertrophy Lower', 'Legs', [
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes', 'calves'], 4),
  ]),

  // CrossFit/Functional
  createTemplate('CrossFit-Style WOD', 'Custom', [
    { id: 'movement1', name: 'Compound Movement', sets: '5', reps: '3-5', tempo: '2-0-2-0', rest: '2m', rpe: '8' } as any,
    { id: 'metabolic', name: 'Metabolic Conditioning', sets: '3-5', reps: '10-15', tempo: '1-0-1-0', rest: '60s', rpe: '8-9' } as any,
    ...getExercisesByMuscle(['core'], 1),
  ]),

  createTemplate('Functional Training', 'Functional', [
    ...getExercisesByMuscle(['compound', 'functional'], 3),
    ...getExercisesByMuscle(['core'], 2),
  ]),

  // Athlete/Sport Specific
  createTemplate('Athletic Power - Upper', 'Custom', [
    { id: 'explosive', name: 'Explosive Movement (Cleans, Jerks, Snatches)', sets: '5', reps: '3', tempo: '1-0-1-0', rest: '2-3m', rpe: '8-9' } as any,
    ...getExercisesByMuscle(['chest', 'back', 'shoulder'], 2),
  ]),
  createTemplate('Athletic Power - Lower', 'Legs', [
    { id: 'jump', name: 'Plyometric Movement (Jumps, Bounds)', sets: '5', reps: '3-5', tempo: '1-0-2-0', rest: '2-3m', rpe: '8-9' } as any,
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes'], 2),
  ]),

  // Rehab/Recovery Focused
  createTemplate('Rehab - Lower Body', 'Custom', [
    { id: 'mobility', name: 'Mobility Work', sets: '2', reps: '15-20', tempo: '2-0-2-0', rest: '45s', rpe: '4-5' } as any,
    ...getExercisesByMuscle(['quads', 'hamstring', 'glutes', 'core'], 4),
  ]),
  createTemplate('Rehab - Upper Body', 'Custom', [
    { id: 'mobility', name: 'Shoulder Mobility', sets: '2', reps: '15-20', tempo: '2-0-2-0', rest: '45s', rpe: '4-5' } as any,
    ...getExercisesByMuscle(['shoulder', 'back', 'chest'], 4),
  ]),

  // Women's Training
  createTemplate('Women\'s Training - Lower Focus', 'Legs', [
    ...getExercisesByMuscle(['glutes', 'quads', 'hamstring'], 3),
    ...getExercisesByMuscle(['core'], 1),
  ]),
  createTemplate('Women\'s Training - Full Body', 'Full Body', [
    ...getExercisesByMuscle(['glutes', 'chest', 'back', 'core'], 4),
  ]),

  // Senior/Longevity Training
  createTemplate('Senior Training - Strength', 'Custom', [
    { id: 'compound', name: 'Compound Movement', sets: '2-3', reps: '8-10', tempo: '2-1-2-1', rest: '90s', rpe: '6-7' } as any,
    ...getExercisesByMuscle(['core', 'mobility'], 2),
  ]),
  createTemplate('Senior Training - Balance', 'Custom', [
    ...getExercisesByMuscle(['core', 'legs'], 3),
    { id: 'balance', name: 'Balance Work', sets: '2', reps: '10-15', tempo: 'dynamic', rest: '30s', rpe: '5' } as any,
  ]),

  // Fat Loss
  createTemplate('Fat Loss - Strength', 'Custom', [
    ...getExercisesByMuscle(['compound'], 3),
    { id: 'conditioning', name: 'Light Conditioning', sets: '2', reps: '15-20', tempo: '2-0-1-0', rest: '45s', rpe: '6' } as any,
  ]),
  createTemplate('Fat Loss - Cardio Hybrid', 'Custom', [
    ...getExercisesByMuscle(['compound'], 2),
    { id: 'hiit', name: 'HIIT Circuit', sets: '3', reps: '30-40s work / 20s rest', tempo: 'explosive', rest: '60s', rpe: '8-9' } as any,
  ]),
];

export function getTemplateByName(name: string): WorkoutTemplate | undefined {
  return BUILT_IN_TEMPLATES.find(t => t.name.toLowerCase() === name.toLowerCase());
}

export function getTemplatesByCategory(category: string): WorkoutTemplate[] {
  return BUILT_IN_TEMPLATES.filter(t => t.category === category);
}

export function getTemplatesByGoal(goal: 'strength' | 'hypertrophy' | 'power' | 'endurance' | 'fat-loss'): WorkoutTemplate[] {
  const categoryMap: { [key: string]: string[] } = {
    strength: ['Custom', 'Push', 'Pull'],
    hypertrophy: ['Upper', 'Lower', 'Legs', 'Push', 'Pull'],
    power: ['Custom'],
    endurance: ['Full Body'],
    'fat-loss': ['Custom'],
  };

  const categories = categoryMap[goal] || [];
  return BUILT_IN_TEMPLATES.filter(t => categories.includes(t.category));
}
