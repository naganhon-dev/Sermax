import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useTabs } from '../lib/store';
import ImportScreen from './ImportScreen';
import { LogOut } from 'lucide-react';
import TabView from './TabView';
import { useNetworkState } from 'react-use';

export default function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { tabs, loading } = useTabs();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const network = useNetworkState();

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

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
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTabId === tab.id 
                    ? 'bg-blue-600 ring-1 ring-blue-400 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
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
          <button onClick={onLogout} title="Выйти" className="text-slate-400 hover:text-white p-1 rounded">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      {activeTabId && (
        <TabView tabId={activeTabId} />
      )}

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
