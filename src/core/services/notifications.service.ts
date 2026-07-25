import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';

export interface NotificationPayload {
  title: string;
  body?: string;
  type?: string;
  isRead?: boolean;
  metadata?: Record<string, unknown>;
}

export function getUserNotificationsCollection(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

export async function createNotification(uid: string, payload: NotificationPayload) {
  if (!uid) return null;

  return addDoc(getUserNotificationsCollection(uid), {
    title: payload.title,
    body: payload.body ?? '',
    type: payload.type ?? 'info',
    isRead: payload.isRead ?? false,
    metadata: payload.metadata ?? {},
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationAsRead(uid: string, notificationId: string) {
  if (!uid || !notificationId) return;

  const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
  await updateDoc(notificationRef, { isRead: true });
}

export async function createAdminNotification(adminUid: string, payload: NotificationPayload) {
  return createNotification(adminUid, payload);
}
