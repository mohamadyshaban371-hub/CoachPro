/**
 * Hook for Progression Management
 * Tracks exercise performance and generates progression recommendations
 */
import { useCallback, useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { progressiveOverload, doubleProgression, volumeProgression, analyzeFatigue, generateAIProgression } from '../services/progressionEngine';
import type { ProgressionRecommendation, ProgressionMetrics, FatigueAnalysis } from '../services/progressionEngine';
import type { StructuredExercise, ExerciseSetDetail } from '../types';

export function useProgression(clientUid?: string) {
  const [recommendations, setRecommendations] = useState<ProgressionRecommendation[]>([]);
  const [metrics, setMetrics] = useState<ProgressionMetrics[]>([]);
  const [fatigueAnalysis, setFatigueAnalysis] = useState<FatigueAnalysis | null>(null);

  // Load exercise history and calculate metrics
  useEffect(() => {
    if (!clientUid) return;

    const historyRef = collection(db, 'users', clientUid, 'exerciseHistory');
    const q = query(historyRef, orderBy('completedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const exercises = new Map<string, any[]>();

      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (!exercises.has(data.exerciseName)) {
          exercises.set(data.exerciseName, []);
        }
        exercises.get(data.exerciseName)!.push(data);
      });

      const newMetrics: ProgressionMetrics[] = [];

      exercises.forEach((history, exerciseName) => {
        const recentSessions = history.slice(0, 10); // Last 10 sessions
        const avgWeight = recentSessions.reduce((sum: number, s: any) => sum + (parseFloat(s.performedWeight || 0) || 0), 0) / recentSessions.length;
        const avgReps = recentSessions.reduce((sum: number, s: any) => sum + (parseFloat(s.reps || 0) || 0), 0) / recentSessions.length;
        const avgVolume = recentSessions.reduce(
          (sum: number, s: any) => sum + (parseFloat(s.performedWeight || 0) || 0) * (parseFloat(s.reps || 0) || 0),
          0
        ) / recentSessions.length;
        const avgRPE = recentSessions.reduce((sum: number, s: any) => sum + (parseFloat(s.rpe || 7) || 7), 0) / recentSessions.length;

        const oldestSessionWeight = history[history.length - 1]?.performedWeight || avgWeight;
        const progressionRate = oldestSessionWeight > 0 ? ((avgWeight - parseFloat(oldestSessionWeight)) / parseFloat(oldestSessionWeight)) * 100 : 0;

        newMetrics.push({
          exerciseName,
          avgWeight,
          avgReps,
          avgVolume,
          avgRPE,
          progressionRate,
          sessionCount: history.length,
          lastSessionDate: recentSessions[0]?.completedAt || new Date().toISOString(),
        });
      });

      setMetrics(newMetrics);
    });

    return () => unsubscribe();
  }, [clientUid]);

  const generateRecommendations = useCallback(
    async (exercise: StructuredExercise, currentSet: ExerciseSetDetail | undefined) => {
      if (!currentSet) return [];

      const exMetrics = metrics.find((m) => m.exerciseName === exercise.name);
      if (!exMetrics) return [];

      const recs: ProgressionRecommendation[] = [];

      // Generate recommendations from different strategies
      const progressive = progressiveOverload(currentSet, exMetrics);
      if (progressive) recs.push(progressive);

      const doubleProgg = doubleProgression(currentSet, currentSet.targetReps || '8-12');
      if (doubleProgg) recs.push(doubleProgg);

      const volumeProgg = volumeProgression(currentSet, 1.1);
      if (volumeProgg) recs.push(volumeProgg);

      // AI recommendation
      try {
        const aiProgg = await generateAIProgression(exercise, exMetrics);
        if (aiProgg) recs.push(aiProgg);
      } catch (e) {
        /* ignore */
      }

      setRecommendations(recs);
      return recs;
    },
    [metrics]
  );

  const analyzeFatigueLevel = useCallback(
    async (avgRPE: number, adherence: number, recentPRs: boolean, sleepHours?: number, stressLevel?: number, sessionFrequency?: number) => {
      const analysis = analyzeFatigue({
        avgRPE,
        adherence,
        recentPRs,
        sleepHours,
        stressLevel,
        sessionFrequency: sessionFrequency || 4,
      });
      setFatigueAnalysis(analysis);
      return analysis;
    },
    []
  );

  const saveRecommendation = useCallback(
    async (exerciseName: string, recommendation: ProgressionRecommendation) => {
      if (!clientUid) return null;
      try {
        const docRef = doc(db, 'users', clientUid, 'progressionRecommendations', `${exerciseName}-${Date.now()}`);
        await setDoc(docRef, {
          exerciseName,
          ...recommendation,
          createdAt: new Date().toISOString(),
        });
        return true;
      } catch (e) {
        return false;
      }
    },
    [clientUid]
  );

  return {
    recommendations,
    metrics,
    fatigueAnalysis,
    generateRecommendations,
    analyzeFatigueLevel,
    saveRecommendation,
  };
}

export default useProgression;
