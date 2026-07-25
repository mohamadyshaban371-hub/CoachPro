import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

export interface ClientActivity {
  type: ActivityType;
  title: string;
  userId: string;
  userName: string;
  metadata?: Record<string, any>;
  createdAt?: any;
  isRead?: boolean;
}

/**
 * Append a single activity entry to /users/{uid}/clientActivity.
 * Admins read this whole subcollection in real time to power
 * the "Big Brother" view + recent-activity feed + alerts.
 *
 * Failures are swallowed (logged) so a slow Firestore write never
 * blocks the user-facing UI action that triggered it.
 */
export async function logClientActivity(
  userId: string,
  userName: string,
  type: ActivityType,
  title: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    if (!userId) return;
    const activityRef = collection(db, 'users', userId, 'clientActivity');
    await addDoc(activityRef, {
      type,
      title,
      userId,
      userName,
      metadata,
      createdAt: serverTimestamp(),
      isRead: false,
    });
  } catch (err) {
    console.warn('[activityLog] Failed to write activity:', (err as Error)?.message);
  }
}
