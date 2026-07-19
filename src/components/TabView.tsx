import { useState, useEffect } from 'react';
import { useTabEngine } from '../lib/hfStore';
import { Eye, EyeOff, MoreVertical } from 'lucide-react';
import Grid from './Grid';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNetworkState } from 'react-use';
import { exportAllData } from '../lib/exportUtils';

export default function TabView({ tabId, targetSheetId, targetRowIdx }: { tabId: string, targetSheetId?: string, targetRowIdx?: number }) {
  const { sheets, loading, isCalculating, error, hf, hfVersion, sheetMatrices, updateCell, batchUpdate, undo, redo, addRow } = useTabEngine(tabId);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(targetSheetId || null);
  const [showHidden, setShowHidden] = useState(false);
  const network = useNetworkState();

  useEffect(() => {
    if (sheets.length > 0 && (!activeSheetId || !sheets.find(s => s.id === activeSheetId))) {
      if (targetSheetId && sheets.find(s => s.id === targetSheetId)) {
        setActiveSheetId(targetSheetId);
      } else {
        const firstVisible = sheets.find(s => !s.hidden) || sheets[0];
        if (firstVisible) setActiveSheetId(firstVisible.id);
      }
    }
  }, [sheets, activeSheetId, targetSheetId]);

  // Handle prop changes for deep linking
  useEffect(() => {
    if (targetSheetId && sheets.find(s => s.id === targetSheetId)) {
      setActiveSheetId(targetSheetId);
    }
  }, [targetSheetId, sheets]);

  const toggleSheetHidden = async (sheetId: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, `tabs/${tabId}/sheets`, sheetId), { hidden: !currentHidden });
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Загрузка данных вкладки...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500">Ошибка: {error}</div>;
  }

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Offline Banner */}
      {!network.online && (
        <div className="bg-red-500 text-white px-4 py-1 text-sm text-center font-medium shrink-0">
          Нет соединения. Изменения не сохранены.
        </div>
      )}

      {/* Sub-Nav: Sheets & Controls */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center space-x-4 overflow-hidden">
          <div className="flex border border-slate-200 rounded p-0.5 bg-slate-50 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {sheets.filter(s => showHidden || !s.hidden).map(sheet => (
              <div 
                key={sheet.id}
                className={`group flex items-center px-4 py-1 text-xs rounded cursor-pointer select-none whitespace-nowrap ${
                  activeSheetId === sheet.id 
                    ? 'font-semibold bg-white shadow-sm border border-slate-200' 
                    : `font-medium hover:text-slate-700 ${sheet.hidden ? 'text-slate-400 italic opacity-60' : 'text-slate-500'}`
                }`}
                onClick={() => setActiveSheetId(sheet.id)}
              >
                <span className="mr-1">{sheet.name}</span>
                {sheet.hidden && <span className="text-[10px] ml-1">(скрыт)</span>}
                <button 
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 ml-1 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSheetHidden(sheet.id, sheet.hidden);
                  }}
                  title={sheet.hidden ? "Показать" : "Скрыть"}
                >
                  <MoreVertical className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button 
             onClick={() => setShowHidden(!showHidden)}
             className="p-1.5 text-slate-400 hover:text-slate-600 shrink-0"
             title={showHidden ? "Скрыть неактивные" : "Показать скрытые"}
          >
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex space-x-2 shrink-0 pl-4 items-center">
          {isCalculating && (
            <div className="text-[10px] text-blue-500 font-medium px-2 py-1 bg-blue-50 rounded flex items-center">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mr-1.5"></div>
              ФОРМУЛЫ СЧИТАЮТСЯ...
            </div>
          )}
          <button 
            onClick={() => activeSheet && addRow(activeSheet.id, activeSheet.name)}
            className="flex items-center px-3 py-1 bg-green-600 text-white text-xs font-bold rounded shadow-sm hover:bg-green-700 transition-colors"
          >
            <span className="mr-1 text-sm">+</span> СТРОКА
          </button>
          <button 
            onClick={exportAllData}
            className="flex items-center px-3 py-1 border border-slate-300 text-slate-600 text-xs font-bold rounded bg-white shadow-sm hover:bg-slate-50 transition-colors"
          >
            ЭКСПОРТ JSON
          </button>
        </div>
      </div>

      {/* Warning banner for specific tabs */}
      {(tabId === 'students_gp' || tabId === 'students_evo') && activeSheet?.name === 'Аналитика общая' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center shrink-0">
          <span className="text-yellow-600 mr-2 text-lg">⚠</span>
          <span className="text-yellow-800 text-[11px] font-medium uppercase tracking-wider">
            Данные из внешней таблицы "Платина 3.5" заморожены на дату переноса (17.07.2026)
          </span>
        </div>
      )}

      {/* The Grid Component */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {activeSheet && (
          <Grid 
             key={activeSheet.id} // force re-mount on sheet change
             sheet={activeSheet} 
             hf={hf} 
             hfVersion={hfVersion} 
             sheetMatrix={sheetMatrices[activeSheet.id] || []}
             onCellEdit={(row, col, value) => updateCell(activeSheet.id, activeSheet.name, row, col, value)}
          onCellsEdit={(updates) => batchUpdate(activeSheet.id, activeSheet.name, updates)}
          undo={undo}
          redo={redo}
             targetRowIdx={targetRowIdx}
          />
        )}
      </div>
    </div>
  );
}
