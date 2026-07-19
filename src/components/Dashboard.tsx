import { useState } from 'react';
import { User } from 'firebase/auth';
import ImportScreen from './ImportScreen';
import HomeTab from './HomeTab';
import StudentsTab from './StudentsTab';
import WebinarsTab from './WebinarsTab';
import ActivitiesTab from './ActivitiesTab';
import CallsTab from './CallsTab';
import ScoresTab from './ScoresTab';
import AmgTab from './AmgTab';
import ArchiveTab from './ArchiveTab';
import { exportAllData } from '../lib/export';

const ALLOWED_EMAILS = [
  'naganhon@gmail.com'
];

export default function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  if (user.email && !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 flex-col gap-4">
        <h1 className="text-xl font-semibold text-red-600">Нет доступа</h1>
        <p className="text-gray-600 text-sm">Обратитесь к администратору.</p>
        <button onClick={onLogout} className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700">Выйти</button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);

  const TABS = [
    { id: 'home', label: 'Главная' },
    { id: 'students', label: 'Студенты' },
    { id: 'calls', label: 'Созвоны' },
    { id: 'scores', label: 'Оценки' },
    { id: 'webinars', label: 'Вебинары' },
    { id: 'activities', label: 'Активности' },
    { id: 'amg', label: 'АМГ' },
    { id: 'archive', label: 'Архив' },
  ];

  const userInitials = user.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  const [targetStudent, setTargetStudent] = useState<any>(null);

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-6">
          <div className="font-bold text-lg tracking-tight">Дашборд</div>
          <nav className="flex space-x-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setShowSettings(false); setTargetStudent(null); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === t.id && !showSettings
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={exportAllData}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span>Экспорт</span>
          </button>

          <div className="flex items-center space-x-2 text-right">
            <span className="text-xs font-medium block">{user.email}</span>
            <div className="w-8 h-8 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center text-xs">
              {userInitials}
            </div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} title="Настройки (Импорт)" className="text-slate-400 hover:text-white p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={onLogout} title="Выйти" className="text-slate-400 hover:text-white p-1 rounded">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {showSettings ? (
          <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
            <h1 className="text-2xl font-bold mb-4">Настройки и Импорт</h1>
            <ImportScreen onDone={() => {
              window.location.reload();
            }} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
             {activeTab === 'home' && (
               <HomeTab onStudentClick={(s) => {
                 setTargetStudent(s);
                 setActiveTab('students');
               }} />
             )}
             {activeTab === 'students' && <StudentsTab targetStudent={targetStudent} />}
             {activeTab === 'calls' && <CallsTab />}
             {activeTab === 'scores' && <ScoresTab />}
             {activeTab === 'webinars' && <WebinarsTab />}
             {activeTab === 'activities' && <ActivitiesTab />}
             {activeTab === 'amg' && <AmgTab />}
             {activeTab === 'archive' && <ArchiveTab />}
          </div>
        )}
      </main>
    </div>
  );
}
