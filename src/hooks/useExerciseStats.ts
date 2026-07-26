/**
 * Hook for Exercise Statistics and PR Tracking
 * Manages exercise history and calculates performance metrics
 */
import { useCallback, useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ExerciseStats, PRRecord } from '../types';

export function useExerciseStats(clientUid?: string) {
  const [stats, setStats] = useState<ExerciseStats[]>([]);
  const [prs, setPrs] = useState<PRRecord[]>([]);

  // Load exercise history and calculate stats
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

      const newStats: ExerciseStats[] = [];

      exercises.forEach((history, exerciseName) => {
        const recentSessions = history.slice(0, 20); // Last 20 sessions

        // Best weight
        const bestWeight = Math.max(...recentSessions.map((s: any) => parseFloat(s.performedWeight || 0) || 0));

        // Best reps at highest weight
        const sessionsWithBestWeight = recentSessions.filter((s: any) => parseFloat(s.performedWeight) === bestWeight);
        const bestReps = Math.max(...sessionsWithBestWeight.map((s: any) => parseFloat(s.reps || 0) || 0));

        // Total volume
        const bestVolume = recentSessions.reduce(
          (max: number, s: any) => {
            const vol = (parseFloat(s.performedWeight || 0) || 0) * (parseFloat(s.reps || 0) || 0);
            return Math.max(max, vol);
          },
          0
        );

        // Average weight × reps (tonnage indicator)
        const avgWeight = recentSessions.reduce((sum: number, s: any) => sum + (parseFloat(s.performedWeight || 0) || 0), 0) / recentSessions.length;
        const avgReps = recentSessions.reduce((sum: number, s: any) => sum + (parseFloat(s.reps || 0) || 0), 0) / recentSessions.length;
        const bestTonnage = (bestWeight + avgWeight) / 2 * avgReps * 5; // Approximate

        // Estimated 1RM using Brzycki formula
        const estimated1RM = bestWeight && bestReps > 0 ? (bestWeight * 36) / (37 - bestReps) : bestWeight;

        newStats.push({
          exerciseName,
          clientUid,
          bestWeight: bestWeight || undefined,
          bestReps: bestReps || undefined,
          bestVolume,
          bestTonnage,
          bestEstimated1RM: estimated1RM || undefined,
          recentSessions: recentSessions.slice(0, 5).map((s: any) => ({
            date: s.completedAt,
            weight: parseFloat(s.performedWeight || 0) || 0,
            reps: parseFloat(s.reps || 0) || 0,
            volume: (parseFloat(s.performedWeight || 0) || 0) * (parseFloat(s.reps || 0) || 0),
          })),
          lastPerformed: recentSessions[0]?.completedAt,
        });
      });

      setStats(newStats);
    });

    return () => unsubscribe();
  }, [clientUid]);

  // Load PRs
  useEffect(() => {
    if (!clientUid) return;

    const prsRef = collection(db, 'users', clientUid, 'prs');
    const q = query(prsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) } as PRRecord));
      setPrs(data);
    });

    return () => unsubscribe();
  }, [clientUid]);

  const getExerciseStats = useCallback(
    (exerciseName: string): ExerciseStats | undefined => {
      return stats.find((s) => s.exerciseName === exerciseName);
    },
    [stats]
  );

  const getExercisePRs = useCallback(
    (exerciseName: string): PRRecord[] => {
      return prs.filter((pr) => pr.exerciseName === exerciseName);
    },
    [prs]
  );

  const savePR = useCallback(
    async (pr: PRRecord) => {
      if (!clientUid || !pr.exerciseName) return false;

      try {
        const docId = `${pr.exerciseName}-${pr.weight}-${pr.reps || 'max'}-${Date.now()}`;
        const docRef = doc(db, 'users', clientUid, 'prs', docId);

        await setDoc(docRef, {
          ...pr,
          clientUid,
          date: new Date().toISOString(),
        });

        return true;
      } catch (e) {
        console.error('Failed to save PR:', e);
        return false;
      }
    },
    [clientUid]
  );

  const getProgressChart = useCallback(
    (exerciseName: string) => {
      const exerciseStats = getExerciseStats(exerciseName);
      if (!exerciseStats || !exerciseStats.recentSessions) return [];

      return exerciseStats.recentSessions
        .slice()
        .reverse()
        .map((session) => ({
          date: new Date(session.date).toLocaleDateString(),
          weight: session.weight,
          volume: session.volume,
          reps: session.reps,
        }));
    },
    [getExerciseStats]
  );

  const getPersonalRecords = useCallback(() => {
    const records: any[] = [];

    stats.forEach((stat) => {
      records.push({
        exercise: stat.exerciseName,
        bestWeight: stat.bestWeight,
        bestReps: stat.bestReps,
        estimated1RM: stat.bestEstimated1RM,
        lastPerformed: stat.lastPerformed,
        totalSessions: stat.recentSessions?.length || 0,
      });
    });

    return records.sort((a, b) => (b.estimated1RM || 0) - (a.estimated1RM || 0));
  }, [stats]);

  return {
    stats,
    prs,
    getExerciseStats,
    getExercisePRs,
    savePR,
    getProgressChart,
    getPersonalRecords,
  };
}

export default useExerciseStats;
