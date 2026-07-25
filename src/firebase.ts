import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CoachPro production hostnames where this app is served
 * ─────────────────────────────────────────────────────────────────────────────
 *  Add new deployment domains here. They are NOT used to override
 *  `authDomain` (see the big note below) — they are kept here so we can
 *  detect "are we in production?" without hard-coding it everywhere.
 */
export const PRODUCTION_DOMAINS = [
  'coach-pro-restore--lotfyshaban12.replit.app',
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IMPORTANT — How Google sign-in actually works with Firebase Auth
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  `authDomain` is the URL where Firebase hosts the OAuth handler
 *  (`/__/auth/handler`). When a user clicks "Sign in with Google", Firebase
 *  opens a popup pointing at `https://<authDomain>/__/auth/handler` and that
 *  page is what completes the OAuth exchange with Google.
 *
 *  That handler ONLY exists on:
 *      - the firebaseapp.com / web.app domain Firebase auto-provisions, OR
 *      - a custom domain you've explicitly added to Firebase Hosting.
 *
 *  It does NOT exist on `coach-pro-restore--lotfyshaban12.replit.app`.
 *  So setting authDomain to that Replit URL would BREAK Google login
 *  for everyone (popup would 404 on /__/auth/handler).
 *
 *  The CORRECT way to enable login on a new domain is two console steps —
 *  no code change needed:
 *
 *  1. Firebase Console → Authentication → Settings → Authorized domains
 *     → Add domain → `coach-pro-restore--lotfyshaban12.replit.app`
 *
 *  2. Google Cloud Console → APIs & Services → Credentials
 *     → open the OAuth 2.0 Web Client used by this Firebase project
 *     → under "Authorized JavaScript origins" add:
 *         https://coach-pro-restore--lotfyshaban12.replit.app
 *     → under "Authorized redirect URIs" add:
 *         https://gen-lang-client-0810267619.firebaseapp.com/__/auth/handler
 *       (this is usually already there — leave it)
 *
 *  Once those two entries are saved, EXISTING clients log in normally —
 *  no user data changes, the same Firebase project, same Firestore database
 *  (`ai-studio-dd4e7562-111f-4f38-9530-c7cda2527a71`), same admin email.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const runtimeConfig: FirebaseOptions = {
  ...firebaseConfig,
  // Pin authDomain to the Firebase-served handler. DO NOT change this to the
  // Replit production hostname — see the explainer above.
  authDomain: (firebaseConfig as any).authDomain || 'gen-lang-client-0810267619.firebaseapp.com',
};

const app = initializeApp(runtimeConfig);

export const auth = getAuth(app);

/**
 * Persist the Auth session in IndexedDB so refreshes / re-opens are instant
 * and existing clients stay logged in across visits. This is the default on
 * web but we set it explicitly so it survives strict-isolation browsers
 * (e.g. Safari private mode falls back to in-memory automatically).
 */
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn('[Firebase] Could not set local persistence:', e);
});

/**
 * Pre-configured Google provider for the Login screen. Forces an account
 * picker so existing clients with multiple Google accounts always see the
 * chooser instead of being silently signed in to the wrong one.
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Firestore — uses the named database the project has always used.
 * (Persistent IndexedDB cache is intentionally NOT enabled here: Firebase
 * JS SDK 12 throws an internal assertion when persistent cache is combined
 * with a named non-default database.)
 */
const dbId = (firebaseConfig as any).firestoreDatabaseId;
let db: ReturnType<typeof getFirestore>;
try {
  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch (e) {
  console.warn('[Firestore] init failed with DB id, falling back to default:', e);
  db = getFirestore(app);
}
export { db };

export const storage = getStorage(app);

export default app;
