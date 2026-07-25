import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';

export type ActivityType =
  | 'water'
  | 'mood'
  | 'energy'
  | 'workout_completed'
  | 'meal_completed'
  | 'plan_requested'
  | 'modification_requested'
  | 'measurement_logged'
  | 'voice_note_uploaded'
  | 'photo_uploaded'
  | 'chat_sent';

export interface UserActivityPayload {
  userId: string;
  userName: string;
  type: ActivityType;
  title: string;
  metadata?: Record<string, unknown>;
}

export function getUserDocumentRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function getUserDocument(uid: string) {
  const snap = await getDoc(getUserDocumentRef(uid));
  return snap.exists() ? (snap.data() as DocumentData) : null;
}

export async function setUserDocument(
  uid: string,
  data: Record<string, unknown>,
  options?: { merge?: boolean },
) {
  return setDoc(getUserDocumentRef(uid), data, options?.merge ? { merge: true } : {});
}

export async function updateUserDocument(uid: string, data: Record<string, unknown>) {
  return updateDoc(getUserDocumentRef(uid), data);
}

export async function createUserActivityEntry(payload: UserActivityPayload) {
  if (!payload.userId) return;

  const activityRef = collection(db, 'users', payload.userId, 'clientActivity');
  await addDoc(activityRef, {
    type: payload.type,
    title: payload.title,
    userId: payload.userId,
    userName: payload.userName,
    metadata: payload.metadata ?? {},
    createdAt: serverTimestamp(),
    isRead: false,
  });
}
