import { useContext, useMemo } from 'react';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export function useAuth() {
  const [user, loading, error] = useAuthState(auth);

  return useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      uid: user?.uid,
    }),
    [user, loading, error]
  );
}
