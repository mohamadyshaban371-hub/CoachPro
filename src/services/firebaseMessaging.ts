import { deleteToken, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { auth, messagingPromise } from '../firebase';
import { requestNotificationPermission, showLocalNotification } from '../lib/pwa';
import { createNotification } from '../core/services/notifications.service';
import type { AppNotification } from '../types';

export interface FirebaseMessagingStatus {
  supported: boolean;
  permission: NotificationPermission;
  token?: string;
}

function getVapidKey(): string | undefined {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_FIREBASE_MESSAGING_VAPID_KEY || undefined;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('[FCM] Service worker not ready yet:', error);
    return null;
  }
}

async function registerToken(uid: string | undefined, messaging: Messaging, registration: ServiceWorkerRegistration) {
  if (!uid) return undefined;

  try {
    const token = await getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: registration,
    });

    if (!token) return undefined;

    const { db } = await import('../firebase');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
      token,
      platform: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      enabled: true,
    });

    return token;
  } catch (error) {
    console.warn('[FCM] Could not register token:', error);
    return undefined;
  }
}

export async function requestFirebaseMessagingPermission(uid?: string): Promise<FirebaseMessagingStatus> {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'denied' };
  }

  const supported = await isSupported();
  if (!supported) {
    return { supported: false, permission: 'denied' };
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { supported: true, permission };
  }

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) {
    return { supported: true, permission };
  }

  const messaging = await messagingPromise;
  if (!messaging) {
    return { supported: true, permission };
  }

  const token = await registerToken(uid, messaging, registration);
  return { supported: true, permission, token };
}

export async function enableForegroundFirebaseMessaging(uid?: string) {
  if (typeof window === 'undefined') return () => undefined;

  const supported = await isSupported();
  if (!supported) return () => undefined;

  const messaging = await messagingPromise;
  if (!messaging) return () => undefined;

  const unsubscribe = onMessage(messaging, async (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'CoachPro';
    const body = payload.notification?.body || payload.data?.body || 'You have a new update';
    const priority = (payload.data?.priority as AppNotification['priority']) || 'medium';

    showLocalNotification(title, body, { tag: payload.messageId });

    if (uid) {
      await createNotification(uid, {
        title,
        body,
        type: 'system',
        priority,
        metadata: {
          source: 'fcm',
          fcmMessageId: payload.messageId,
          ...(payload.data || {}),
        },
      });
    }
  });

  return unsubscribe;
}

export async function clearFCMToken(uid?: string) {
  if (!uid || typeof window === 'undefined') return;

  const messaging = await messagingPromise;
  if (!messaging) return;

  const token = await deleteToken(messaging).catch(() => undefined);
  if (token === undefined) return;

  const { db } = await import('../firebase');
  const { collection, getDocs, deleteDoc } = await import('firebase/firestore');
  const tokensRef = collection(db, 'users', uid, 'fcmTokens');
  const snapshot = await getDocs(tokensRef);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

export async function initializeFirebaseMessaging(uid?: string) {
  const status = await requestFirebaseMessagingPermission(uid);
  await enableForegroundFirebaseMessaging(uid);
  return status;
}
