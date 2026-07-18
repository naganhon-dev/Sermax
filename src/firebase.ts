import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Вставьте значения из консоли Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyBbsTT0pEz0QakLtfJRBxR6R-rPdPwYN3g",
  authDomain: "work-dashboardsermax.firebaseapp.com",
  projectId: "work-dashboardsermax",
  storageBucket: "work-dashboardsermax.firebasestorage.app",
  messagingSenderId: "308601780307",
  appId: "1:308601780307:web:e894db040c02e3dca52ea6"
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isFirebaseConfigured ? getAuth(app!) : null as any;
export const db = isFirebaseConfigured ? getFirestore(app!) : null as any;

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
