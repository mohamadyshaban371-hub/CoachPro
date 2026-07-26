const STORAGE_KEYS = {
  profile: 'coachpro:offline:profile',
  workouts: 'coachpro:offline:workouts',
  meals: 'coachpro:offline:meals',
  measurements: 'coachpro:offline:measurements',
  notifications: 'coachpro:offline:notifications',
  queue: 'coachpro:offline:queue',
} as const;

export type OfflineStoreKey = keyof typeof STORAGE_KEYS;

export interface OfflineActionEntry {
  id: string;
  action: 'save-measurement' | 'save-notification';
  payload: Record<string, unknown>;
  createdAt: string;
}

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function saveOfflineSnapshot<T>(kind: OfflineStoreKey, value: T) {
  writeStorage(STORAGE_KEYS[kind], value);
}

export function loadOfflineSnapshot<T>(kind: OfflineStoreKey): T | null {
  return readStorage<T>(STORAGE_KEYS[kind]);
}

export function enqueueOfflineAction(entry: OfflineActionEntry) {
  if (typeof window === 'undefined') return;
  const existing = readStorage<OfflineActionEntry[]>(STORAGE_KEYS.queue) || [];
  const next = [...existing, entry];
  writeStorage(STORAGE_KEYS.queue, next);
}

export function getOfflineQueue(): OfflineActionEntry[] {
  return readStorage<OfflineActionEntry[]>(STORAGE_KEYS.queue) || [];
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEYS.queue);
}

export async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length || typeof window === 'undefined') return [];

  const results: Array<{ ok: boolean; action: OfflineActionEntry['action'] }> = [];
  for (const entry of queue) {
    try {
      if (entry.action === 'save-measurement') {
        const { db } = await import('../firebase');
        const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
        const uid = entry.payload.uid as string | undefined;
        const measurement = entry.payload.measurement as Record<string, unknown> | undefined;
        if (uid && measurement) {
          await updateDoc(doc(db, 'users', uid), {
            measurementHistory: arrayUnion(measurement),
            lastMeasurementSubmittedAt: entry.payload.timestamp as string | undefined,
          });
        }
      }

      if (entry.action === 'save-notification') {
        const { createNotification } = await import('../core/services/notifications.service');
        const uid = entry.payload.uid as string | undefined;
        const title = entry.payload.title as string | undefined;
        const body = entry.payload.body as string | undefined;
        const type = entry.payload.type as string | undefined;
        const priority = entry.payload.priority as string | undefined;
        if (uid && title) {
          await createNotification(uid, {
            title,
            body,
            type: (type as any) || 'system',
            priority: (priority as any) || 'medium',
          });
        }
      }

      results.push({ ok: true, action: entry.action });
    } catch (error) {
      results.push({ ok: false, action: entry.action });
      console.warn('[Offline] sync failed:', entry.action, error);
    }
  }

  if (results.every((result) => result.ok)) {
    clearOfflineQueue();
  }

  return results;
}

export function startOfflineSync() {
  if (typeof window === 'undefined') return () => undefined;
  const syncHandler = () => {
    if (navigator.onLine) {
      void syncOfflineQueue();
    }
  };
  window.addEventListener('online', syncHandler);
  window.addEventListener('load', syncHandler);
  return () => {
    window.removeEventListener('online', syncHandler);
    window.removeEventListener('load', syncHandler);
  };
}
