// CoachPro service worker — minimal viable PWA shell.
// We deliberately avoid aggressive caching so admin/client data always reflects
// live Firestore. The SW exists primarily so the manifest is treated as a
// real PWA and "Add to Home Screen" prompts become available.

const CACHE = 'coachpro-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through. Real offline support would go here in a later iteration.
  return;
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (wins.length > 0) return wins[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
