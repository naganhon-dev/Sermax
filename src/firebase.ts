import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

export const firebaseConfig = firebaseConfigJson;

export const isFirebaseConfigured = !!firebaseConfig && firebaseConfig.apiKey !== "";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isFirebaseConfigured ? getAuth(app!) : null as any;
export const db = isFirebaseConfigured 
  ? ((firebaseConfig as any).firestoreDatabaseId 
      ? getFirestore(app!, (firebaseConfig as any).firestoreDatabaseId) 
      : getFirestore(app!))
  : null as any;

export const loginWithGoogle = async () => {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = () => {
  if (auth) return signOut(auth);
};
