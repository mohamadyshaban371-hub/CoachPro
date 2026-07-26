import { useCallback, useMemo, useState } from 'react';
import type { ProfessionalWorkout, StructuredExercise, ExerciseSetDetail, ProgressionAdvice, PRRecord } from '../types';
import professionalWorkoutLib, { AVAILABLE_PRO_EXERCISES } from '../lib/professionalWorkout';
import { saveProfessionalWorkout } from '../services/professionalExercises';
import { auth } from '../firebase';

export function useProfessionalWorkout(initial?: ProfessionalWorkout) {
  const [workout, setWorkout] = useState<ProfessionalWorkout>(initial || professionalWorkoutLib.createEmptyProfessionalWorkout());
  const [prs, setPrs] = useState<PRRecord[]>([]);
  const coachUid = auth?.currentUser?.uid;

  const addExercise = useCallback((exerciseId: string, scheme?: ExerciseSetDetail) => {
    const ex = AVAILABLE_PRO_EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    setWorkout((w) => professionalWorkoutLib.addExerciseToProfessionalWorkout(w, ex, scheme));
  }, []);

  const updateExerciseDetail = useCallback((exerciseId: string, index: number, next: ExerciseSetDetail) => {
    setWorkout((w) => {
      const nextExercises = w.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const details = [...(ex.details || [])];
        details[index] = { ...details[index], ...next };
        return { ...ex, details };
      });
      return { ...w, exercises: nextExercises, updatedAt: new Date().toISOString() };
    });
  }, []);

  const updateExerciseSets = useCallback((exerciseId: string, sets: ExerciseSetDetail[]) => {
    setWorkout((w) => {
      const nextExercises = w.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return { ...ex, details: sets };
      });
      return { ...w, exercises: nextExercises, updatedAt: new Date().toISOString() };
    });
  }, []);

  const persistWorkout = useCallback(async () => {
    if (!coachUid) return null;
    try {
      return await saveProfessionalWorkout(coachUid, workout);
    } catch (e) {
      console.error('Failed to persist workout:', e);
      return null;
    }
  }, [workout, coachUid]);

  const recommendProgression = useCallback((exerciseId: string, recentPerformance?: any): ProgressionAdvice[] => {
    const ex = workout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return [];
    return professionalWorkoutLib.analyzeProgression(ex as StructuredExercise, recentPerformance);
  }, [workout]);

  const addPR = useCallback((pr: PRRecord) => setPrs((p) => professionalWorkoutLib.recordPR(p, pr)), []);

  const estimatedTonnage = useMemo(() => professionalWorkoutLib.estimateTonnage(workout), [workout]);

  return {
    workout,
    setWorkout,
    addExercise,
    updateExerciseDetail,
    updateExerciseSets,
    persistWorkout,
    recommendProgression,
    addPR,
    prs,
    estimatedTonnage,
    AVAILABLE_PRO_EXERCISES,
  };
}

export default useProfessionalWorkout;
