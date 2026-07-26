import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { showLocalNotification } from '../../lib/pwa';
import type { AppNotification } from '../../types';

export interface NotificationPayload {
  title: string;
  body?: string;
  type?: AppNotification['type'];
  priority?: AppNotification['priority'];
  isRead?: boolean;
  archived?: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export function getUserNotificationsCollection(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

export async function createNotification(uid: string, payload: NotificationPayload) {
  if (!uid) return null;

  const created = await addDoc(getUserNotificationsCollection(uid), {
    title: payload.title,
    body: payload.body ?? '',
    message: payload.body ?? '',
    type: payload.type ?? 'system',
    priority: payload.priority ?? 'medium',
    isRead: payload.isRead ?? false,
    read: payload.isRead ?? false,
    archived: payload.archived ?? false,
    actionUrl: payload.actionUrl ?? '',
    metadata: payload.metadata ?? {},
    createdAt: serverTimestamp(),
  });

  if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    showLocalNotification(payload.title, payload.body ?? '', { tag: created.id });
  }

  return created;
}

export async function markNotificationAsRead(uid: string, notificationId: string) {
  if (!uid || !notificationId) return;

  const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
  await updateDoc(notificationRef, { isRead: true, read: true });
}

export async function markAllNotificationsAsRead(uid: string) {
  if (!uid) return;

  const notificationsRef = getUserNotificationsCollection(uid);
  const batch = writeBatch(db);
  const snapshot = await (await import('firebase/firestore')).getDocs(notificationsRef);
  snapshot.forEach((docSnap) => {
    batch.update(doc(db, 'users', uid, 'notifications', docSnap.id), { isRead: true, read: true });
  });
  await batch.commit();
}

export async function archiveNotification(uid: string, notificationId: string) {
  if (!uid || !notificationId) return;

  const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
  await updateDoc(notificationRef, { archived: true });
}

export async function deleteNotification(uid: string, notificationId: string) {
  if (!uid || !notificationId) return;

  const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
  await deleteDoc(notificationRef);
}

export async function createAdminNotification(adminUid: string, payload: NotificationPayload) {
  return createNotification(adminUid, payload);
}

export async function enqueueSmartNotification(uid: string, payload: NotificationPayload) {
  return createNotification(uid, payload);
}

export async function generateMembershipNotifications(profile: { uid?: string; expiryDate?: string; name?: string; packages?: Record<string, unknown> }) {
  if (!profile.uid) return [];
  const today = new Date();
  const expiry = profile.expiryDate ? new Date(profile.expiryDate) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return [];

  const diffDays = Math.floor((expiry.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  const items: NotificationPayload[] = [];

  if (diffDays === 0) {
    items.push({ title: 'اشتراكك ينتهي اليوم', body: `مرحبا ${profile.name || 'العزيز'} — ينتهي اشتراكك اليوم.`, type: 'membership', priority: 'urgent' });
  } else if (diffDays === 3) {
    items.push({ title: 'تنبيه: اشتراكك ينتهي خلال 3 أيام', body: 'تذكير مبكر لإدارة التجديد قبل انتهاء العضوية.', type: 'membership', priority: 'high' });
  } else if (diffDays === 7) {
    items.push({ title: 'تنبيه: اشتراكك ينتهي خلال 7 أيام', body: 'أدرج تجديد الاشتراك قبل انتهاء المهلة.', type: 'membership', priority: 'high' });
  }

  if (items.length) {
    await Promise.all(items.map((item) => createNotification(profile.uid!, item)));
  }

  return items;
}

export async function generateProgressNotifications(profile: { uid?: string; name?: string; measurementHistory?: Array<{ date?: string }> }) {
  if (!profile.uid) return [];
  const items: NotificationPayload[] = [];
  const history = profile.measurementHistory || [];
  const latest = history[history.length - 1]?.date;
  const lastDate = latest ? new Date(latest) : null;
  const today = new Date();

  if (!latest) {
    items.push({ title: 'تذكير بقياس أسبوعي', body: 'أضف قياساتك هذا الأسبوع للحفاظ على متابعة دقيقة.', type: 'progress', priority: 'medium' });
  } else if (lastDate && Math.floor((today.getTime() - lastDate.getTime()) / 86400000) >= 14) {
    items.push({ title: 'لم يتم تحديث القياسات منذ 14 يوم', body: 'أضف قياساتك الجديدة لتبقى خطة التدريب محدثة.', type: 'progress', priority: 'high' });
  }

  if (items.length) {
    await Promise.all(items.map((item) => createNotification(profile.uid!, item)));
  }

  return items;
}

export async function generateAIInsightNotifications(profile: { uid?: string; name?: string }, insight: { title: string; body: string; type?: AppNotification['type']; priority?: AppNotification['priority'] }) {
  if (!profile.uid) return null;
  return createNotification(profile.uid, {
    title: insight.title,
    body: insight.body,
    type: insight.type ?? 'ai',
    priority: insight.priority ?? 'medium',
    metadata: { source: 'ai' },
  });
}
