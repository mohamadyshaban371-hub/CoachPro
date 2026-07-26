import { useEffect, useState, useCallback } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { WorkoutTemplate } from '../types';

export function useCoachTemplates(coachUid?: string) {
  const uid = coachUid || auth?.currentUser?.uid;
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, 'users', uid, 'workoutTemplates');
    const q = query(col, orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setTemplates(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as WorkoutTemplate))));
    return () => unsub();
  }, [uid]);

  const saveTemplate = useCallback(async (template: WorkoutTemplate) => {
    if (!uid) return null;
    const id = template.id || `template-${Date.now()}`;
    await setDoc(doc(db, 'users', uid, 'workoutTemplates', id), { ...template, id, updatedAt: new Date().toISOString() });
    return id;
  }, [uid]);

  const removeTemplate = useCallback(async (templateId: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'workoutTemplates', templateId));
  }, [uid]);

  return { templates, saveTemplate, removeTemplate };
}

export default useCoachTemplates;
