import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { ClientWorkout, CompletedWorkout, ExerciseHistoryEntry, WorkoutExercise, WorkoutTemplate } from '../types';
import { buildClientWorkout, buildTemplateFromWorkout, calculateCompletionPercent, createCompletedWorkout, createExerciseHistoryEntry, createWorkoutExercise, DEFAULT_EXERCISE_LIBRARY } from '../lib/workoutBuilder';
import { aiReviewWorkout, saveWorkoutReview, savePR } from '../services/professionalExercises';

export function useWorkoutBuilder(clientUid?: string) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [clientWorkouts, setClientWorkouts] = useState<ClientWorkout[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientUid) return;

    const templatesRef = collection(db, 'users', clientUid, 'workoutTemplates');
    const templatesQuery = query(templatesRef, orderBy('updatedAt', 'desc'));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as WorkoutTemplate));
      setTemplates(items);
    });

    const workoutsRef = collection(db, 'users', clientUid, 'clientWorkouts');
    const workoutsQuery = query(workoutsRef, orderBy('updatedAt', 'desc'));
    const unsubscribeWorkouts = onSnapshot(workoutsQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ClientWorkout));
      setClientWorkouts(items);
    });

    const completedRef = collection(db, 'users', clientUid, 'completedWorkouts');
    const completedQuery = query(completedRef, orderBy('completedAt', 'desc'));
    const unsubscribeCompleted = onSnapshot(completedQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CompletedWorkout));
      setCompletedWorkouts(items);
    });

    const historyRef = collection(db, 'users', clientUid, 'exerciseHistory');
    const historyQuery = query(historyRef, orderBy('completedAt', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ExerciseHistoryEntry));
      setExerciseHistory(items);
    });

    setLoading(false);

    return () => {
      unsubscribeTemplates();
      unsubscribeWorkouts();
      unsubscribeCompleted();
      unsubscribeHistory();
    };
  }, [clientUid]);

  const createTemplate = useCallback(async (name: string, category: WorkoutTemplate['category'], exercises: WorkoutExercise[]) => {
    if (!clientUid) return null;
    const template = buildTemplateFromWorkout(name, exercises, category);
    const id = template.id || `template-${Date.now()}`;
    const payload = { ...template, id };
    await setDoc(doc(db, 'users', clientUid, 'workoutTemplates', id), payload);
    return payload;
  }, [clientUid]);

  const updateTemplate = useCallback(async (template: WorkoutTemplate) => {
    if (!clientUid || !template.id) return null;
    const payload = { ...template, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', clientUid, 'workoutTemplates', template.id), payload);
    return payload;
  }, [clientUid]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!clientUid) return;
    await deleteDoc(doc(db, 'users', clientUid, 'workoutTemplates', templateId));
  }, [clientUid]);

  const duplicateTemplate = useCallback(async (template: WorkoutTemplate) => {
    if (!clientUid) return null;
    const duplicated = { ...template, id: `${template.id}-copy`, name: `${template.name} Copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', clientUid, 'workoutTemplates', duplicated.id), duplicated);
    return duplicated;
  }, [clientUid]);

  const assignTemplate = useCallback(async (template: WorkoutTemplate, day: string) => {
    if (!clientUid) return null;
    const workout = buildClientWorkout(template.name, template.exercises, day, clientUid);
    const id = workout.id || `workout-${Date.now()}`;
    const payload = { ...workout, id };
    await setDoc(doc(db, 'users', clientUid, 'clientWorkouts', id), payload);
    return payload;
  }, [clientUid]);

  const saveWorkout = useCallback(async (workout: ClientWorkout) => {
    if (!clientUid) return null;
    const id = workout.id || `workout-${Date.now()}`;
    const payload = { ...workout, id, updatedAt: new Date().toISOString(), completionPercent: calculateCompletionPercent(workout.exercises) };
    await setDoc(doc(db, 'users', clientUid, 'clientWorkouts', id), payload);
    return payload;
  }, [clientUid]);

  const markExerciseComplete = useCallback(async (workout: ClientWorkout, exerciseId: string) => {
    if (!clientUid) return null;
    const nextExercises = workout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      return { ...exercise, completed: !exercise.completed, performedWeight: exercise.performedWeight || exercise.weight || '' };
    });
    const updatedWorkout = { ...workout, exercises: nextExercises, completionPercent: calculateCompletionPercent(nextExercises) };
    await saveWorkout(updatedWorkout);
    if (updatedWorkout.completionPercent === 100) {
      const completedWorkout = createCompletedWorkout(updatedWorkout);
      const completedId = completedWorkout.id || `completed-${Date.now()}`;
      await setDoc(doc(db, 'users', clientUid, 'completedWorkouts', completedId), { ...completedWorkout, id: completedId });

      // AI review of the completed workout and save to Firestore
      try {
        const summary = `Client ${clientUid} completed workout ${completedWorkout.title} with ${completedWorkout.exercises.length} exercises. CompletionPercent: ${completedWorkout.completionPercent}`;
        const review = await aiReviewWorkout(summary);
        if (review) await saveWorkoutReview(clientUid, completedId, review);
      } catch (e) { /* ignore AI failures */ }

      // Simple auto-progression suggestion based on average RPE
      try {
        const avgRPE = Math.round(completedWorkout.exercises.reduce((s, ex) => s + (Number(ex.rpe) || 0), 0) / Math.max(1, completedWorkout.exercises.length));
        const suggestion = avgRPE >= 8 ? 'Consider increasing load in next cycle' : avgRPE <= 6 ? 'Consider increasing intensity or reps' : 'Maintain current progression';
        await setDoc(doc(db, 'users', clientUid, 'progressionRecommendations', `${completedId}`), { workoutId: completedId, suggestion, avgRPE, createdAt: new Date().toISOString() });
      } catch (e) { /* ignore */ }
    }
    const completedExercise = nextExercises.find((exercise) => exercise.id === exerciseId);
    if (completedExercise) {
      await setDoc(doc(db, 'users', clientUid, 'exerciseHistory', `${Date.now()}-${completedExercise.id}`), createExerciseHistoryEntry(completedExercise, clientUid));
      // Persist PR if performedWeight is present
      try {
        const weightNum = Number(completedExercise.performedWeight || completedExercise.weight || 0);
        if (weightNum > 0) {
          await savePR(clientUid, { exerciseName: completedExercise.name, weight: weightNum, reps: Number(completedExercise.reps) || undefined, date: new Date().toISOString() });
        }
      } catch (e) { /* ignore */ }
    }
    return updatedWorkout;
  }, [clientUid, saveWorkout]);

  const duplicateExercise = useCallback((exercise: WorkoutExercise) => createWorkoutExercise(exercise), []);

  const createExercise = useCallback(() => createWorkoutExercise(DEFAULT_EXERCISE_LIBRARY[0]), []);

  return useMemo(() => ({
    loading,
    templates,
    clientWorkouts,
    completedWorkouts,
    exerciseHistory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    assignTemplate,
    saveWorkout,
    markExerciseComplete,
    duplicateExercise,
    createExercise,
  }), [clientWorkouts, completedWorkouts, createExercise, createTemplate, deleteTemplate, duplicateExercise, exerciseHistory, loading, markExerciseComplete, saveWorkout, templates, updateTemplate, assignTemplate, duplicateTemplate]);
}

export default useWorkoutBuilder;
