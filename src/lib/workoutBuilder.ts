import type { ClientWorkout, CompletedWorkout, ExerciseHistoryEntry, WorkoutExercise, WorkoutTemplate } from '../types';

export const WORKOUT_TEMPLATE_CATEGORIES = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Lower',
  'Full Body',
  'Arnold',
  'Bro Split',
  'Custom',
] as const;

export const DEFAULT_EXERCISE_LIBRARY: WorkoutExercise[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    arabicName: 'دفع سحب على مقعد',
    englishName: 'Bench Press',
    muscleGroup: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders'],
    equipment: 'Bench, Barbell',
    difficulty: 'intermediate',
    instructions: 'Keep the shoulder blades pulled back and control the eccentric phase.',
    imageUrl: '',
    tags: ['push', 'upper', 'strength'],
    sets: '4',
    reps: '6-8',
    tempo: '2-1-1',
    rest: '90s',
    rpe: '7',
  },
  {
    id: 'row',
    name: 'Seated Cable Row',
    arabicName: 'صفّات كابل جلوس',
    englishName: 'Seated Cable Row',
    muscleGroup: 'Back',
    secondaryMuscles: ['Biceps', 'Lats'],
    equipment: 'Cable',
    difficulty: 'beginner',
    instructions: 'Pull the elbows back and avoid shrugging.',
    imageUrl: '',
    tags: ['pull', 'upper', 'hypertrophy'],
    sets: '3',
    reps: '10-12',
    tempo: '2-1-2',
    rest: '60s',
    rpe: '7',
  },
  {
    id: 'squat',
    name: 'Back Squat',
    arabicName: ' squat ظهر',
    englishName: 'Back Squat',
    muscleGroup: 'Legs',
    secondaryMuscles: ['Glutes', 'Core'],
    equipment: 'Barbell, Rack',
    difficulty: 'advanced',
    instructions: 'Brace the core and descend until the thighs are parallel.',
    imageUrl: '',
    tags: ['legs', 'strength'],
    sets: '4',
    reps: '5',
    tempo: '3-1-1',
    rest: '120s',
    rpe: '8',
  },
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    arabicName: 'رفع فوق الرأس',
    englishName: 'Overhead Press',
    muscleGroup: 'Shoulders',
    secondaryMuscles: ['Triceps', 'Upper Chest'],
    equipment: 'Dumbbells',
    difficulty: 'intermediate',
    instructions: 'Keep the ribs down and press through the heels.',
    imageUrl: '',
    tags: ['push', 'upper', 'strength'],
    sets: '3',
    reps: '8',
    tempo: '2-1-1',
    rest: '75s',
    rpe: '7',
  },
  {
    id: 'deadlift',
    name: 'Romanian Deadlift',
    arabicName: 'دريلينغ روماني',
    englishName: 'Romanian Deadlift',
    muscleGroup: 'Posterior Chain',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: 'Dumbbells',
    difficulty: 'intermediate',
    instructions: 'Hinge at the hips and keep the spine long.',
    imageUrl: '',
    tags: ['pull', 'legs', 'posterior-chain'],
    sets: '3',
    reps: '8-10',
    tempo: '3-1-1',
    rest: '90s',
    rpe: '8',
  },
  {
    id: 'lunges',
    name: 'Walking Lunges',
    arabicName: 'شحنات مشي',
    englishName: 'Walking Lunges',
    muscleGroup: 'Legs',
    secondaryMuscles: ['Glutes', 'Balance'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    instructions: 'Step long and keep the front knee tracking over the toes.',
    imageUrl: '',
    tags: ['legs', 'balance'],
    sets: '3',
    reps: '12 each',
    tempo: '2-1-2',
    rest: '45s',
    rpe: '6',
  },
  {
    id: 'pulldown',
    name: 'Lat Pulldown',
    arabicName: 'سحب LAT',
    englishName: 'Lat Pulldown',
    muscleGroup: 'Back',
    secondaryMuscles: ['Biceps', 'Rear Delts'],
    equipment: 'Machine',
    difficulty: 'beginner',
    instructions: 'Pull the bar to the upper chest and avoid swinging.',
    imageUrl: '',
    tags: ['pull', 'upper'],
    sets: '3',
    reps: '10',
    tempo: '2-1-1',
    rest: '60s',
    rpe: '7',
  },
  {
    id: 'pushups',
    name: 'Push-Ups',
    arabicName: 'تمارين دفع',
    englishName: 'Push-Ups',
    muscleGroup: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    instructions: 'Keep a straight line from head to heels.',
    imageUrl: '',
    tags: ['push', 'bodyweight'],
    sets: '3',
    reps: 'AMRAP',
    tempo: '2-1-2',
    rest: '45s',
    rpe: '6',
  },
];

export function createEmptyExercise(): WorkoutExercise {
  return {
    id: crypto.randomUUID?.() || `exercise-${Date.now()}`,
    name: 'New Exercise',
    arabicName: 'تمرين جديد',
    englishName: 'New Exercise',
    muscleGroup: 'General',
    secondaryMuscles: [],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    instructions: 'Add a movement cue and coaching note here.',
    tags: [],
    sets: '3',
    reps: '10',
    tempo: '2-1-2',
    rest: '60s',
    rpe: '7',
    notes: '',
  };
}

export function createWorkoutExercise(source?: WorkoutExercise): WorkoutExercise {
  const base = source ? { ...source } : createEmptyExercise();
  return {
    ...base,
    id: base.id || (crypto.randomUUID?.() || `exercise-${Date.now()}`),
    name: base.name || 'New Exercise',
    arabicName: base.arabicName || base.name || 'تمرين جديد',
    englishName: base.englishName || base.name || 'New Exercise',
    sets: base.sets || '3',
    reps: base.reps || '10',
    tempo: base.tempo || '2-1-2',
    rest: base.rest || '60s',
    rpe: base.rpe || '7',
    notes: base.notes || '',
  };
}

export function buildTemplateFromWorkout(title: string, exercises: WorkoutExercise[], category: string): WorkoutTemplate {
  return {
    id: crypto.randomUUID?.() || `template-${Date.now()}`,
    name: title,
    category: (category as WorkoutTemplate['category']) || 'Custom',
    description: '',
    exercises: exercises.map(createWorkoutExercise),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildClientWorkout(title: string, exercises: WorkoutExercise[], day: string, clientUid: string): ClientWorkout {
  return {
    id: crypto.randomUUID?.() || `workout-${Date.now()}`,
    title,
    clientUid,
    exercises: exercises.map(createWorkoutExercise),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: false,
    completionPercent: 0,
    day,
  };
}

export function calculateCompletionPercent(exercises: WorkoutExercise[]): number {
  if (!exercises.length) return 0;
  const completedCount = exercises.filter((exercise) => exercise.completed).length;
  return Math.round((completedCount / exercises.length) * 100);
}

export function createCompletedWorkout(workout: ClientWorkout): CompletedWorkout {
  return {
    id: crypto.randomUUID?.() || `completed-${Date.now()}`,
    workoutId: workout.id || '',
    title: workout.title,
    clientUid: workout.clientUid,
    completedAt: new Date().toISOString(),
    exercises: workout.exercises.map(createWorkoutExercise),
    completionPercent: workout.completionPercent || 100,
  };
}

export function createExerciseHistoryEntry(exercise: WorkoutExercise, clientUid: string): ExerciseHistoryEntry {
  return {
    id: crypto.randomUUID?.() || `history-${Date.now()}`,
    clientUid,
    exerciseName: exercise.name,
    performedWeight: exercise.performedWeight || '',
    completedAt: new Date().toISOString(),
    sets: exercise.sets || '',
    reps: exercise.reps || '',
    notes: exercise.notes || '',
  };
}

export function calculateWorkoutAnalytics(clientWorkouts: ClientWorkout[], completedWorkouts: CompletedWorkout[], exerciseHistory: ExerciseHistoryEntry[]) {
  const totalWorkouts = clientWorkouts.length;
  const completedCount = completedWorkouts.length;
  const completionRate = totalWorkouts > 0 ? Math.round((completedCount / totalWorkouts) * 100) : 0;
  const averageVolume = clientWorkouts.reduce((sum, workout) => {
    return sum + workout.exercises.reduce((inner, exercise) => {
      const weight = Number(exercise.performedWeight || exercise.weight || 0);
      const sets = Number(exercise.sets || 0);
      const reps = Number(exercise.reps?.split('-')[0] || exercise.reps || 0);
      return inner + (Number.isFinite(weight) && Number.isFinite(sets) && Number.isFinite(reps) ? weight * sets * reps : 0);
    }, 0);
  }, 0);

  const exerciseFrequency = exerciseHistory.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.exerciseName] = (acc[entry.exerciseName] || 0) + 1;
    return acc;
  }, {});

  const mostUsedExercises = Object.entries(exerciseFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const weeklyFrequency = completedWorkouts.reduce<Record<string, number>>((acc, entry) => {
    const date = new Date(entry.completedAt || Date.now());
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    mostUsedExercises,
    completionRate,
    workoutAdherence: completedCount > 0 ? Math.min(100, Math.round((completedCount / Math.max(1, totalWorkouts)) * 100)) : 0,
    averageVolume: Math.round(averageVolume),
    weeklyFrequency: Object.entries(weeklyFrequency).length,
  };
}
