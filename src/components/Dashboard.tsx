import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useTabs } from '../lib/store';
import ImportScreen from './ImportScreen';
import { LogOut, Home } from 'lucide-react';
import TabView from './TabView';
import HomeTab from './HomeTab';
import { useNetworkState } from 'react-use';

export default function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { tabs, loading } = useTabs();
  
  const [activeTabId, setActiveTabId] = useState<string | null>('home');
  const [targetSheetId, setTargetSheetId] = useState<string | null>(null);
  const [targetRowIdx, setTargetRowIdx] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const network = useNetworkState();

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId('home');
    }
  }, [tabs, activeTabId]);

  const handleGoToLocation = (tabId: string, sheetId: string, rowIdx?: number) => {
    setActiveTabId(tabId);
    setTargetSheetId(sheetId);
    setTargetRowIdx(rowIdx ?? null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-[#1e293b]">Загрузка структуры...</div>;
  }

  if (tabs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-[#1e293b] font-sans">
        <header className="flex items-center justify-between px-6 py-3 bg-[#0f172a] text-white shadow-md">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold italic">G</div>
            <span className="font-semibold tracking-tight">DASHBOARD <span className="text-blue-400 font-mono text-xs opacity-75">v2.4</span></span>
          </div>
          <button onClick={onLogout} className="text-slate-400 hover:text-white flex items-center text-xs font-medium">
            <LogOut className="w-4 h-4 mr-2" /> Выйти
          </button>
        </header>
        <ImportScreen onDone={() => {}} />
      </div>
    );
  }

  const userInitials = (user.email || 'U').substring(0, 2).toUpperCase();
  const allTabs = [{ id: 'home', name: 'Главная' }, ...tabs];

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8f9fa] text-[#1e293b] font-sans overflow-hidden">
      {/* Header: Main Navigation & Auth */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0f172a] text-white shadow-md shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold italic">G</div>
            <span className="font-semibold tracking-tight">DASHBOARD <span className="text-blue-400 font-mono text-xs opacity-75">v2.4</span></span>
          </div>
          <nav className="flex space-x-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {allTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setTargetSheetId(null);
                  setTargetRowIdx(null);
                }}
                className={`flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTabId === tab.id 
                    ? 'bg-blue-600 ring-1 ring-blue-400 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.id === 'home' && <Home className="w-3.5 h-3.5 mr-1" />}
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4 shrink-0 pl-4">
          
          <div className="flex items-center space-x-2 text-right">
            <span className="text-xs font-medium block">{user.email}</span>
            <div className="w-8 h-8 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center text-xs">
              {userInitials}
            </div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} title="Настройки" className="text-slate-400 hover:text-white p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={onLogout} title="Выйти" className="text-slate-400 hover:text-white p-1 rounded">

            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      
      {/* Main Content */}
      {showSettings ? (
         <div className="flex-1 overflow-auto bg-[#f8f9fa] p-6">
            <h1 className="text-2xl font-bold mb-4">Настройки</h1>
            <button onClick={() => setShowSettings(false)} className="mb-4 text-blue-500 hover:underline">Вернуться</button>
            <ImportScreen onDone={() => {
              window.location.reload();
            }} />
         </div>
      ) : activeTabId === 'home' ? (

        <HomeTab setActiveTabAndSheet={handleGoToLocation} />
      ) : activeTabId ? (
        <TabView 
          key={activeTabId} 
          tabId={activeTabId} 
          targetSheetId={targetSheetId || undefined} 
          targetRowIdx={targetRowIdx || undefined} 
        />
      ) : null}

      {/* Footer Bar */}
      <footer className="h-8 bg-[#0f172a] text-slate-400 px-4 flex items-center justify-between text-[10px] font-mono tracking-widest shrink-0">
        <div className="flex items-center space-x-4 uppercase">
          <div className="flex items-center">
            <div className={`w-1.5 h-1.5 rounded-full mr-2 ${network.online ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`}></div>
            CLOUD FIRESTORE: {network.online ? 'ПОДКЛЮЧЕНО' : 'ОТКЛЮЧЕНО'}
          </div>
          <div className="border-l border-slate-700 h-4"></div>
          <div>HYPERFORMULA: OK [GPL-V3]</div>
        </div>
        <div className="flex items-center">
          <span>{network.online ? 'ИЗМЕНЕНИЯ СОХРАНЕНЫ' : 'НЕТ СОЕДИНЕНИЯ'}</span>
          <span className="ml-3 opacity-50">{new Date().toLocaleTimeString('ru-RU')}</span>
        </div>
      </footer>
    </div>
  );
}
