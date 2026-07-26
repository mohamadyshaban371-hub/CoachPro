/**
 * PWA helpers — service worker registration, install prompt capture,
 * notification permission, and a tiny in-page reminder scheduler.
 *
 * Notes:
 * - The service worker file lives at `<BASE_URL>sw.js` so it is served from
 *   the artifact root. Vite copies `public/` files to that root.
 * - On iOS Safari, `beforeinstallprompt` never fires; the InstallPrompt
 *   component falls back to platform-specific instructions.
 */

export function registerPWA() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || '/' })
      .then((registration) => {
        registration.update();
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('pwa:update-available'));
        }
      })
      .catch((err) => console.warn('[PWA] Service worker registration failed:', err));
  });
}

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let cachedPrompt: InstallPromptEvent | null = null;
const listeners = new Set<(e: InstallPromptEvent | null) => void>();

export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedPrompt = e as InstallPromptEvent;
    listeners.forEach((cb) => cb(cachedPrompt));
  });
  window.addEventListener('appinstalled', () => {
    cachedPrompt = null;
    listeners.forEach((cb) => cb(null));
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return cachedPrompt;
}

export function onInstallPromptChange(cb: (e: InstallPromptEvent | null) => void): () => void {
  listeners.add(cb);
  cb(cachedPrompt);
  return () => {
    listeners.delete(cb);
  };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  return !!mql?.matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  return isiOS && !(/CriOS|FxiOS|EdgiOS/.test(ua));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function showLocalNotification(title: string, body: string, opts?: NotificationOptions) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL || '/'}favicon.svg`,
      lang: 'ar',
      dir: 'rtl',
      tag: 'coachpro-reminder',
      ...opts,
    } as NotificationOptions);
  } catch (err) {
    console.warn('[PWA] showLocalNotification failed:', err);
  }
}

/**
 * Lightweight foreground reminder loop. While the tab/PWA is open, checks
 * every 10 minutes whether the user needs a nudge for water / workout / meal.
 * Server-side push notifications are out of scope for this iteration.
 */
export interface ReminderCheckers {
  needsWater: () => boolean;
  needsWorkout: () => boolean;
  needsMeal: () => boolean;
}

const REMINDER_KEYS = {
  water: 'coachpro:reminder:water',
  workout: 'coachpro:reminder:workout',
  meal: 'coachpro:reminder:meal',
};

const COOLDOWN_MS = 2 * 60 * 60 * 1000;

export function startForegroundReminders(checkers: ReminderCheckers): () => void {
  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const now = Date.now();
    const send = (kind: 'water' | 'workout' | 'meal', title: string, body: string) => {
      const key = REMINDER_KEYS[kind];
      const last = parseInt(localStorage.getItem(key) || '0', 10);
      if (now - last < COOLDOWN_MS) return;
      showLocalNotification(title, body);
      localStorage.setItem(key, String(now));
    };
    if (checkers.needsWater())   send('water',   '💧 ذكرتك بالمياه',   'لسه ما سجلتش كفايتك من الماء النهاردة');
    if (checkers.needsWorkout()) send('workout', '💪 ذكرتك بالتمرين',  'حان وقت جلستك. خمس دقائق إحماء وابدأ');
    if (checkers.needsMeal())    send('meal',    '🍎 ذكرتك بالوجبة',   'لا تفوّت وجبتك الجاية، البروتين أساسي');
  };
  const id = window.setInterval(tick, 10 * 60 * 1000);
  tick();
  return () => window.clearInterval(id);
}
