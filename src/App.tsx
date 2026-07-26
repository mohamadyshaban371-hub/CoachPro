import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { UserProfile, ClientMembership } from './types';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeFirebaseMessaging } from './services/firebaseMessaging';
import { startNotificationScheduler } from './services/notificationScheduler';

// Heavy authenticated views are code-split so the public Login screen ships
// the smallest possible JS bundle and renders instantly. AdminDashboard alone
// pulls in recharts, react-markdown, BodyMap, ChampionsFeed, etc. — none of
// which the visitor needs until after sign-in.
const AdminDashboard  = lazy(() => import('./components/AdminDashboard'));
const ClientDashboard = lazy(() => import('./components/ClientDashboard'));
const Onboarding      = lazy(() => import('./components/Onboarding'));

type Route = '/login' | '/admin' | '/dashboard' | '/onboarding';

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

/**
 * Decides which screen the current (user, profile) pair belongs on.
 * Centralised so the URL-hash sync and the JSX render path always agree.
 */
function resolveRoute(user: User | null, profile: UserProfile | null): Route {
  if (!user) return '/login';
  if (profile?.role === 'admin') return '/admin';
  if (profile && !profile.onboardingComplete) return '/onboarding';
  if (profile) return '/dashboard';
  // User is authenticated but profile hasn't loaded yet — treat as login
  // shell (the spinner handles the actual visual state).
  return '/login';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref to hold the active Firestore profile listener's unsubscribe fn.
  // Because onAuthStateChanged ignores callback return values, we manage
  // cleanup ourselves via this ref so we don't leak listeners on re-auth.
  const activeProfileUnsub = useRef<(() => void) | null>(null);
  const schedulerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Bootstrap admin if needed (esp. after DB clear)
        if (firebaseUser.email?.toLowerCase() === "lotfyshaban2211@gmail.com") {
          try {
            const apiBase = (import.meta as any).env?.BASE_URL || '/';
            await fetch(`${apiBase}api/admin/bootstrap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: firebaseUser.uid, email: firebaseUser.email })
            });
          } catch (e) {
            console.error("Bootstrap error:", e);
          }
        }

        // Real-time profile listener so admin activations land instantly.
        const userRef = doc(db, 'users', firebaseUser.uid);
        const unsubProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const nextProfile = docSnap.data() as UserProfile;
            setProfile(nextProfile);

            try {
              const membershipsQuery = query(
                collection(db, 'clientMemberships'),
                where('clientId', '==', nextProfile.uid),
                orderBy('createdAt', 'desc')
              );
              const membershipSnap = await getDocs(membershipsQuery);
              const latestMembership = membershipSnap.docs[0]?.data() as ClientMembership | undefined;
              schedulerCleanupRef.current?.();
              schedulerCleanupRef.current = startNotificationScheduler(nextProfile, latestMembership ?? null);
              void initializeFirebaseMessaging(nextProfile.uid);
            } catch (error) {
              console.warn('[App] Scheduler bootstrap failed:', error);
              schedulerCleanupRef.current?.();
              schedulerCleanupRef.current = startNotificationScheduler(nextProfile, null);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.warn("Profile listener status:", error.message);
          setLoading(false);
          if (error.code === 'permission-denied') {
            auth.signOut();
          }
        });
        // Store unsubProfile so we can clean it up. Note: onAuthStateChanged
        // ignores the callback's return value, so cleanup must be handled externally.
        activeProfileUnsub.current = unsubProfile;
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      activeProfileUnsub.current?.();
      schedulerCleanupRef.current?.();
      schedulerCleanupRef.current = null;
    };
  }, []);

  // Keep the URL hash in sync with the resolved route. This gives the user
  // (and bookmarking) sensible URLs — `#/admin`, `#/dashboard`, `#/onboarding`
  // — without pulling in a router library or breaking the artifact's base
  // path proxy. The hash is purely cosmetic; rendering is driven by `route`.
  const route = resolveRoute(user, profile);
  useEffect(() => {
    if (loading) return;
    const target = `#${route}`;
    if (window.location.hash !== target) {
      try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target}`); }
      catch { window.location.hash = target; }
    }
  }, [route, loading]);

  if (loading) return <AppLoader />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoader />}>
        {route === '/login'      ? <Login /> :
         route === '/admin'      ? <AdminDashboard /> :
         route === '/onboarding' ? <Onboarding profile={profile!} /> :
         route === '/dashboard'  ? <ClientDashboard profile={profile!} /> :
         <Login />}
      </Suspense>
    </ErrorBoundary>
  );
}
