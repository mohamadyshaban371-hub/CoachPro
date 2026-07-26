import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { collection as collRef, doc as docRef, getDoc as getDocRef, onSnapshot as onSnapshotRef, orderBy as orderByRef, query as queryRef, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProfessionalExercise, UserProfile } from '../types';
import DEFAULT_PROFESSIONAL_EXERCISES from '../lib/professionalExercises';
import { safeGenerateContent } from './aiMasterEngine';

export function listenProfessionalExercises(onUpdate: (items: ProfessionalExercise[]) => void) {
  try {
    const col = collection(db, 'professionalExercises');
    const q = query(col, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.size) {
        // fallback to bundled defaults when the collection is empty
        onUpdate(DEFAULT_PROFESSIONAL_EXERCISES);
        return;
      }
      const items = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ProfessionalExercise));
      onUpdate(items);
    });
    return unsubscribe;
  } catch (e) {
    // on error, return defaults and a no-op unsubscribe
    onUpdate(DEFAULT_PROFESSIONAL_EXERCISES);
    return () => {};
  }
}

export async function getProfessionalExerciseById(id: string): Promise<ProfessionalExercise | null> {
  try {
    const docRef = doc(db, 'professionalExercises', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as ProfessionalExercise;
  } catch (e) {
    return null;
  }
}

/** Ask the AI to recommend replacement exercises and explain reasoning. */
export async function aiRecommendReplacements(ex: ProfessionalExercise, clientProfile?: UserProfile): Promise<{ replacements: string[]; explanation: string } | null> {
  try {
    const system = `You are a professional strength & conditioning coach. Given an exercise and (optionally) a client profile, recommend 3 suitable replacement or alternative exercises and explain briefly why each is appropriate. Return JSON: { replacements: string[], explanation: string }`;
    const prompt = `Exercise: ${ex.name}\nPrimary muscle(s): ${ex.muscleGroup}\nEquipment: ${ex.equipment}\nDifficulty: ${ex.difficulty}\nClient: ${clientProfile?.name || 'N/A'}`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text as string);
    return { replacements: parsed.replacements || [], explanation: parsed.explanation || '' };
  } catch (e) {
    return null;
  }
}

export async function aiReviewWorkout(workoutSummary: string): Promise<{ issues?: string[]; suggestions?: string[] } | null> {
  try {
    const system = `You are an expert performance coach. Review the following workout summary and return JSON with keys: issues (array of strings), suggestions (array of strings). Be concise.`;
    const res = await safeGenerateContent('gemini-1.5-flash', workoutSummary, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text as string);
    return { issues: parsed.issues || [], suggestions: parsed.suggestions || [] };
  } catch (e) {
    return null;
  }
}

export async function saveWorkoutReview(clientUid: string, workoutId: string, review: { issues?: string[]; suggestions?: string[] }) {
  if (!clientUid || !workoutId) return null;
  try {
    const ref = doc(db, 'users', clientUid, 'workoutReviews', `${workoutId}`);
    await setDoc(ref, { ...review, workoutId, createdAt: new Date().toISOString() });
    return ref.id;
  } catch (e) {
    return null;
  }
}

export async function saveProfessionalTemplate(coachUid: string, template: any) {
  if (!coachUid) return null;
  try {
    const id = template.id || `template-${Date.now()}`;
    const ref = doc(db, 'users', coachUid, 'workoutTemplates', id);
    await setDoc(ref, { ...template, id, updatedAt: new Date().toISOString() });
    return id;
  } catch (e) {
    return null;
  }
}

export async function savePR(clientUid: string, pr: { exerciseName: string; weight: number; reps?: number; date?: string }) {
  if (!clientUid) return null;
  try {
    const ref = await addDoc(collection(db, 'users', clientUid, 'prs'), { ...pr, createdAt: new Date().toISOString() });
    return ref.id;
  } catch (e) {
    return null;
  }
}

export async function saveProfessionalWorkout(coachUid: string, workout: any) {
  if (!coachUid) return null;
  try {
    const id = workout.id || `prow-${Date.now()}`;
    const ref = doc(db, 'users', coachUid, 'professionalWorkouts', id);
    await setDoc(ref, { ...workout, id, updatedAt: new Date().toISOString() });
    return id;
  } catch (e) {
    return null;
  }
}

export async function assignProfessionalWorkoutToClients(coachUid: string, workout: any, clientUids: string[]) {
  if (!coachUid || !clientUids?.length) return null;
  try {
    const promises = clientUids.map(async (clientUid) => {
      const id = workout.id || `workout-${Date.now()}-${clientUid}`;
      const payload = { ...workout, id, clientUid, createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'users', clientUid, 'clientWorkouts', id), payload);
      return id;
    });
    return Promise.all(promises);
  } catch (e) {
    return null;
  }
}

export async function saveProfessionalWorkoutReview(coachUid: string, workoutId: string, review: { issues?: string[]; suggestions?: string[] } ) {
  if (!coachUid || !workoutId) return null;
  try {
    const ref = doc(db, 'users', coachUid, 'professionalWorkoutReviews', workoutId);
    await setDoc(ref, { ...review, workoutId, createdAt: new Date().toISOString() });
    return ref.id;
  } catch (e) {
    return null;
  }
}

export async function aiGenerateProgressionRecommendation(exerciseName: string, lastReps: string, lastWeight: number, avgRPE: number, volume: number): Promise<{ action: string; detail: string } | null> {
  try {
    const system = `You are an elite strength coach. Given exercise stats, recommend the next progression step. Return JSON: { action: string (e.g., "add_1_rep", "add_2.5kg", "add_set"), detail: string }`;
    const prompt = `Exercise: ${exerciseName}\nLast reps: ${lastReps}\nLast weight: ${lastWeight}kg\nAvg RPE: ${avgRPE}\nVolume: ${volume}kg. What's the next progression step?`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text as string);
    return { action: parsed.action || '', detail: parsed.detail || '' };
  } catch (e) {
    return null;
  }
}

export async function aiGenerateDeloadRecommendation(avgRPE: number, weeksTraining: number, recentVolume: number): Promise<{ shouldDeload: boolean; reason: string } | null> {
  try {
    const system = `You are a recovery specialist. Given training metrics, recommend if a deload week is needed. Return JSON: { shouldDeload: boolean, reason: string }`;
    const prompt = `Avg RPE last week: ${avgRPE}\nWeeks training: ${weeksTraining}\nRecent volume: ${recentVolume}kg. Should we deload?`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text as string);
    return { shouldDeload: parsed.shouldDeload || false, reason: parsed.reason || '' };
  } catch (e) {
    return null;
  }
}

export async function aiGenerateRecoveryWarning(avgRPE: number, totalWorkoutTime: number, restTime: string): Promise<{ warning: string; suggestion: string } | null> {
  try {
    const system = `You are a recovery coach. Given workout metrics, identify recovery concerns. Return JSON: { warning: string, suggestion: string }`;
    const prompt = `Avg RPE: ${avgRPE}\nWorkout duration: ${totalWorkoutTime}min\nRest: ${restTime}. Any recovery concerns?`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text as string);
    return { warning: parsed.warning || '', suggestion: parsed.suggestion || '' };
  } catch (e) {
    return null;
  }
}
