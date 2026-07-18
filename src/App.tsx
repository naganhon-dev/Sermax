/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { isFirebaseConfigured, auth, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  return <Dashboard user={user} onLogout={logout} />;
}

