/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { isFirebaseConfigured, auth, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TwoFactorScreen from './components/TwoFactorScreen';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [is2faVerified, setIs2faVerified] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const verifiedInSession = sessionStorage.getItem(`2fa_verified_${u.uid}`) === 'true';
        setIs2faVerified(verifiedInSession);
      } else {
        setIs2faVerified(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (user) {
      sessionStorage.removeItem(`2fa_verified_${user.uid}`);
    }
    setIs2faVerified(false);
    await logout();
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка конфигурации</h1>
          <p className="text-gray-700 mb-4">
            Firebase не настроен. Пожалуйста, откройте файл <code>src/firebase.ts</code> и вставьте ваши значения из консоли Firebase в объект <code>firebaseConfig</code>.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Загрузка...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (!is2faVerified) {
    return (
      <TwoFactorScreen 
        user={user} 
        onSuccess={() => setIs2faVerified(true)} 
        onLogout={handleLogout} 
      />
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

