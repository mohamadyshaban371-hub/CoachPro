/**
 * Hook for AI Workout Generation
 * Generates personalized training programs based on client profile
 */
import { useCallback, useState } from 'react';
import { generateProgramFromProfile, aiSelectExerciseReplacements } from '../services/aiWorkoutGenerator';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ClientTrainingProfile, AIGeneratedProgram } from '../types';

export function useAIWorkoutGenerator(clientUid?: string) {
  const [program, setProgram] = useState<AIGeneratedProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateProgram = useCallback(
    async (profile: ClientTrainingProfile) => {
      setLoading(true);
      setError(null);
      try {
        const result = await generateProgramFromProfile(profile);
        setProgram(result);
        if (result && clientUid) {
          const docRef = doc(db, 'users', clientUid, 'trainingPrograms', result.id || `prog-${Date.now()}`);
          await setDoc(docRef, { ...result, updatedAt: new Date().toISOString() });
        }
        return result;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [clientUid]
  );

  const saveProgram = useCallback(
    async (prog: AIGeneratedProgram) => {
      if (!clientUid || !prog.id) return null;
      try {
        const docRef = doc(db, 'users', clientUid, 'trainingPrograms', prog.id);
        await setDoc(docRef, { ...prog, updatedAt: new Date().toISOString() });
        setProgram(prog);
        return prog.id;
      } catch (e: any) {
        setError(e.message);
        return null;
      }
    },
    [clientUid]
  );

  const loadProgram = useCallback(
    (programId: string) => {
      if (!clientUid) return () => {};
      const docRef = doc(db, 'users', clientUid, 'trainingPrograms', programId);
      return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          setProgram(snap.data() as AIGeneratedProgram);
        }
      });
    },
    [clientUid]
  );

  return { program, generateProgram, saveProgram, loadProgram, loading, error };
}

export default useAIWorkoutGenerator;
