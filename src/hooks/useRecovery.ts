/**
 * Hook for Recovery and Fatigue Management
 * Tracks daily readiness, fatigue, and recovery scores
 */
import { useCallback, useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateReadinessScore, analyzeRecovery, recommendRecoveryPlan, aiGeneratePersonalizedRecoveryPlan, calculateDOMS } from '../services/fatigueRecovery';
import type { FatigueRecord } from '../types';

export function useRecovery(clientUid?: string) {
  const [records, setRecords] = useState<FatigueRecord[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [recovery, setRecovery] = useState<any>(null);
  const [domsScore, setDomsScore] = useState<number>(0);

  // Load fatigue records
  useEffect(() => {
    if (!clientUid) return;

    const recordsRef = collection(db, 'users', clientUid, 'fatigueRecords');
    const q = query(recordsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => doc.data() as FatigueRecord);
      setRecords(data);

      // Calculate readiness from most recent record
      if (data.length > 0) {
        const readinessScore = calculateReadinessScore(data[0]);
        setReadiness(readinessScore);

        // Analyze recovery from recent trend
        const recoveryAnalysis = analyzeRecovery(data.slice(0, 7));
        setRecovery(recoveryAnalysis);

        // Calculate DOMS from workout history
        const recentWorkouts = data.slice(0, 7).map((r) => ({
          date: r.date,
          intensity: r.fatigueScore,
          volume: r.fatigueScore * 10,
        }));
        const doms = calculateDOMS(recentWorkouts);
        setDomsScore(doms.score);
      }
    });

    return () => unsubscribe();
  }, [clientUid]);

  const logFatigue = useCallback(
    async (data: Partial<FatigueRecord>) => {
      if (!clientUid) return false;

      try {
        const recordId = `${new Date().toISOString().split('T')[0]}`;
        const docRef = doc(db, 'users', clientUid, 'fatigueRecords', recordId);

        const record: FatigueRecord = {
          clientUid,
          date: new Date().toISOString().split('T')[0],
          fatigueScore: data.fatigueScore || 5,
          recoveryScore: data.recoveryScore || 5,
          readinessScore: data.readinessScore || 5,
          sleepHours: data.sleepHours || 7,
          sleepQuality: data.sleepQuality || 5,
          stressLevel: data.stressLevel || 5,
          soreness: data.soreness || 0,
          notes: data.notes,
          createdAt: new Date().toISOString(),
        };

        await setDoc(docRef, record);
        return true;
      } catch (e) {
        console.error('Failed to log fatigue:', e);
        return false;
      }
    },
    [clientUid]
  );

  const getTodaysReadiness = useCallback(() => {
    if (!readiness) return null;
    return {
      score: readiness.score,
      category: readiness.category,
      recommendations: readiness.recommendations,
      canTrain: readiness.score >= 5,
      intensityAdjustment: readiness.trainingIntensityAdjustment,
    };
  }, [readiness]);

  const getRecoveryPlan = useCallback(() => {
    if (!readiness) return [];
    return recommendRecoveryPlan(readiness);
  }, [readiness]);

  const generatePersonalizedRecovery = useCallback(
    async (availableTime: number, preferences: string[]) => {
      if (!readiness) return null;

      return aiGeneratePersonalizedRecoveryPlan({
        sleepHours: readiness.factors.sleep,
        stressLevel: readiness.factors.stress,
        soreness: readiness.factors.soreness,
        availableTime,
        preferences,
      });
    },
    [readiness]
  );

  return {
    records,
    readiness,
    recovery,
    domsScore,
    logFatigue,
    getTodaysReadiness,
    getRecoveryPlan,
    generatePersonalizedRecovery,
  };
}

export default useRecovery;
