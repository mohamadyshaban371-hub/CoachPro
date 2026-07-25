import {
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup as firebaseSignInWithPopup,
  type AuthProvider,
  type UserCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';

export function getAuthInstance() {
  return auth;
}

export function getGoogleAuthProvider() {
  return googleProvider;
}

export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<UserCredential> {
  return firebaseSignInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGooglePopup(
  provider: AuthProvider = googleProvider,
): Promise<UserCredential> {
  return firebaseSignInWithPopup(auth, provider);
}
