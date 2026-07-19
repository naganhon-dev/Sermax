const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const stateRepl = `
  const [activeTabId, setActiveTabId] = useState<string | null>('home');
  const [targetSheetId, setTargetSheetId] = useState<string | null>(null);
  const [targetRowIdx, setTargetRowIdx] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
`;
content = content.replace(/const \[activeTabId, setActiveTabId\] = useState<string \| null>\('home'\);\n  const \[targetSheetId, setTargetSheetId\] = useState<string \| null>\(null\);\n  const \[targetRowIdx, setTargetRowIdx\] = useState<number \| null>\(null\);/, stateRepl);

const headerRepl = `
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
`;
content = content.replace(/<div className="flex items-center space-x-2 text-right">[\s\S]*?className="text-slate-400 hover:text-white p-1 rounded">/, headerRepl);

const bodyRepl = `
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
`;
content = content.replace(/\{\/\* Main Content \*\/\}\n\s*\{activeTabId === 'home' \? \(/, bodyRepl);

fs.writeFileSync('src/components/Dashboard.tsx', content);
