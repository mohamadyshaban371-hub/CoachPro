import { useMemo, useState } from 'react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateBodyMetrics, calculateProgressDiffs } from '../lib/progress';
import { MeasurementHistory, UserProfile } from '../types';

export function useProgress(profile: UserProfile | null) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const history = useMemo(() => profile?.measurementHistory ?? [], [profile?.measurementHistory]);
  const latestEntry = history[history.length - 1];
  const previousEntry = history[history.length - 2];

  const latestMetrics = useMemo(() => {
    if (!latestEntry) return null;
    return calculateBodyMetrics(latestEntry, profile?.onboardingData);
  }, [latestEntry, profile?.onboardingData]);

  const comparison = useMemo(() => {
    if (!latestEntry || !previousEntry) return null;
    return calculateProgressDiffs(latestEntry, previousEntry);
  }, [latestEntry, previousEntry]);

  const saveEntry = async (entry: MeasurementHistory) => {
    if (!profile?.uid) {
      throw new Error('Missing user profile');
    }

    setIsSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        measurementHistory: arrayUnion(entry),
        lastMeasurementSubmittedAt: new Date().toISOString(),
        brainSummary: null,
      });
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ التقدم');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    history,
    latestEntry,
    previousEntry,
    latestMetrics,
    comparison,
    isSaving,
    error,
    saveEntry,
  };
}

export default useProgress;
