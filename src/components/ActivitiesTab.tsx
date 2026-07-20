import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, Filter } from 'lucide-react';
import { useSort } from '../lib/useSort';
import { usePagination } from '../lib/usePagination';
import Pagination from './Pagination';
import { auth } from '../firebase';
import { useResizableColumns } from '../lib/useResizableColumns';

export default function ActivitiesTab() {
  const [subTab, setSubTab] = useState('journal'); // journal, mentors, products
  const { data: activities } = useCollection('activities');

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
        {[
          { id: 'journal', label: 'Журнал' },
          { id: 'mentors', label: 'По менторам (сводная)' },
          { id: 'products', label: 'По продуктам (сводная)' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${subTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden relative">
        {subTab === 'journal' && <JournalView activities={activities} />}
        {subTab === 'mentors' && <MentorsSummary activities={activities} />}
        {subTab === 'products' && <ProductsSummary activities={activities} />}
      </div>
    </div>
  );
}

function JournalView({ activities }: { activities: any[] }) {
  const [period, setPeriod] = useState('');
  const [mentor, setMentor] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const { handleSort, renderSortIcon, sortData } = useSort();

  const userEmail = auth?.currentUser?.email || 'guest';
  const defaultWidths = {
    period: 100,
    date: 120,
    type: 200,
    mentor: 180,
    program: 220,
    qty: 100,
  };
  const { widths, handleResizeStart, resetWidths } = useResizableColumns(
    'activities_width',
    defaultWidths,
    userEmail
  );

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (period && a['Период'] !== period) return false;
      if (mentor && a['Ментор'] !== mentor) return false;
      return true;
    });
  }, [activities, period, mentor]);

  const normalizedFiltered = useMemo(() => {
    return filtered.map(a => ({
      ...a,
      'Кол-во': a['Кол-во'] || a['Кол-во активностей'] || ''
    }));
  }, [filtered]);

  const sortedData = useMemo(() => sortData(normalizedFiltered), [normalizedFiltered, sortData]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination<any>(sortedData, [period, mentor], 'pageSize_activities');

  const periods = Array.from(new Set(activities.map(a => a['Период']).filter(Boolean))).sort().reverse();
  const mentors = Array.from(new Set(activities.map(a => a['Ментор']).filter(Boolean))).sort();

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
         <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
            <div className="flex gap-4">
              <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                 <option value="">Все периоды</option>
                 {periods.map((p: any) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={mentor} onChange={e => setMentor(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                 <option value="">Все менторы</option>
                 {mentors.map((m: any) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
               <button onClick={resetWidths} className="text-gray-500 hover:text-gray-700 text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors" title="Сбросить ширину колонок">
                 Сбросить ширину
               </button>
               <button onClick={() => setSelectedActivity({ _isNew: true })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Добавить
               </button>
            </div>
         </div>
         <div className="flex-1 overflow-auto p-4 relative">
           <table className="text-left border-collapse text-sm" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
             <thead>
               <tr className="border-b-2 border-gray-200">
                 <th style={{ width: widths.period, minWidth: widths.period, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Период')} className="w-full h-full pr-4">{renderSortIcon('Период')}Период</div>
                   <div onMouseDown={e => handleResizeStart(e, 'period')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
                 <th style={{ width: widths.date, minWidth: widths.date, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Дата проведения')} className="w-full h-full pr-4">{renderSortIcon('Дата проведения')}Дата</div>
                   <div onMouseDown={e => handleResizeStart(e, 'date')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
                 <th style={{ width: widths.type, minWidth: widths.type, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Тип активности')} className="w-full h-full pr-4">{renderSortIcon('Тип активности')}Тип активности</div>
                   <div onMouseDown={e => handleResizeStart(e, 'type')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
                 <th style={{ width: widths.mentor, minWidth: widths.mentor, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Ментор')} className="w-full h-full pr-4">{renderSortIcon('Ментор')}Ментор</div>
                   <div onMouseDown={e => handleResizeStart(e, 'mentor')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
                 <th style={{ width: widths.program, minWidth: widths.program, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Программа')} className="w-full h-full pr-4">{renderSortIcon('Программа')}Программа/Поток</div>
                   <div onMouseDown={e => handleResizeStart(e, 'program')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
                 <th style={{ width: widths.qty, minWidth: widths.qty, position: 'sticky', top: 0 }} className="py-2 px-2 text-right cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                   <div onClick={() => handleSort('Кол-во')} className="w-full h-full pl-4">{renderSortIcon('Кол-во')}Кол-во</div>
                   <div onMouseDown={e => handleResizeStart(e, 'qty')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                 </th>
               </tr>
             </thead>
             <tbody>
               {paginatedData.map(a => {
                 const programText = `${a['Программа'] || ''} ${a['Поток'] || ''}`.trim();
                 return (
                   <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedActivity(a)}>
                     <td className="py-1.5 px-2 text-gray-500 truncate" style={{ width: widths.period, maxWidth: widths.period, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a['Период']}>{a['Период']}</td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.date, maxWidth: widths.date, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a['Дата проведения']}>{a['Дата проведения']}</td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.type, maxWidth: widths.type, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a['Тип активности']}>{a['Тип активности']}</td>
                     <td className="py-1.5 px-2 font-medium truncate" style={{ width: widths.mentor, maxWidth: widths.mentor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a['Ментор']}>{a['Ментор']}</td>
                     <td className="py-1.5 px-2 text-gray-600 truncate" style={{ width: widths.program, maxWidth: widths.program, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={programText}>{programText}</td>
                     <td className="py-1.5 px-2 text-right truncate" style={{ width: widths.qty, maxWidth: widths.qty, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(a['Кол-во'] || a['Кол-во активностей'] || '')}>{a['Кол-во'] || a['Кол-во активностей']}</td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
         <Pagination
           currentPage={currentPage}
           setCurrentPage={setCurrentPage}
           pageSize={pageSize}
           setPageSize={setPageSize}
           totalPages={totalPages}
           startIndex={startIndex}
           endIndex={endIndex}
           totalItems={totalItems}
           grandTotal={activities.length}
         />
      </div>
      {selectedActivity && <ActivityPanel activity={selectedActivity} allRecords={activities} onClose={() => setSelectedActivity(null)} />}
    </div>
  );
}

function MentorsSummary({ activities }: { activities: any[] }) {
  const [period, setPeriod] = useState('');
  const periods = Array.from(new Set(activities.map(a => a['Период']).filter(Boolean))).sort().reverse();
  
  const { types, matrix } = useMemo(() => {
    const data = period ? activities.filter(a => a['Период'] === period) : activities;
    const typeSet = new Set<string>();
    const mat: Record<string, Record<string, number>> = {};
    
    data.forEach(a => {
      const m = a['Ментор'];
      const t = a['Тип активности'];
      const count = Number(a['Кол-во'] || a['Кол-во активностей']) || 1;
      if (!m || !t) return;
      typeSet.add(t);
      if (!mat[m]) mat[m] = {};
      mat[m][t] = (mat[m][t] || 0) + count;
    });

    return { types: Array.from(typeSet).sort(), matrix: mat };
  }, [activities, period]);

  const mentors = Object.keys(matrix).sort();

  return (
    <div className="flex flex-col h-full p-4">
      <div className="mb-4">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
           <option value="">Все периоды</option>
           {periods.map((p: any) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-auto border border-gray-200 rounded">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 sticky top-0 shadow-sm">
            <tr>
              <th className="py-2 px-3 border-r border-gray-200 w-48">Ментор</th>
              {types.map(t => <th key={t} className="py-2 px-3 text-center border-r border-gray-200 whitespace-nowrap">{t}</th>)}
              <th className="py-2 px-3 text-center bg-gray-100 font-bold">Итог</th>
            </tr>
          </thead>
          <tbody>
             {mentors.map(m => {
               const rowTotal = types.reduce((sum, t) => sum + (matrix[m][t] || 0), 0);
               return (
                 <tr key={m} className="border-b border-gray-200 hover:bg-gray-50">
                   <td className="py-2 px-3 border-r border-gray-200 font-medium">{m}</td>
                   {types.map(t => (
                     <td key={t} className={`py-2 px-3 text-center border-r border-gray-200 ${matrix[m][t] ? '' : 'text-gray-300'}`}>
                       {matrix[m][t] || '—'}
                     </td>
                   ))}
                   <td className="py-2 px-3 text-center bg-gray-50 font-bold">{rowTotal}</td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsSummary({ activities }: { activities: any[] }) {
  const [period, setPeriod] = useState('');
  const periods = Array.from(new Set(activities.map(a => a['Период']).filter(Boolean))).sort().reverse();
  
  const { types, matrix } = useMemo(() => {
    const data = period ? activities.filter(a => a['Период'] === period) : activities;
    const typeSet = new Set<string>();
    const mat: Record<string, Record<string, number>> = {};
    
    data.forEach(a => {
      const prog = a['Программа'] || '';
      const potok = a['Поток'] || '';
      const prod = prog || potok ? `${prog} ${potok}`.trim() : 'Не указан';
      const t = a['Тип активности'];
      const count = Number(a['Кол-во'] || a['Кол-во активностей']) || 1;
      if (!t) return;
      typeSet.add(t);
      if (!mat[prod]) mat[prod] = {};
      mat[prod][t] = (mat[prod][t] || 0) + count;
    });

    return { types: Array.from(typeSet).sort(), matrix: mat };
  }, [activities, period]);

  const products = Object.keys(matrix).sort();

  return (
    <div className="flex flex-col h-full p-4">
      <div className="mb-4">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
           <option value="">Все периоды</option>
           {periods.map((p: any) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-auto border border-gray-200 rounded">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 sticky top-0 shadow-sm">
            <tr>
              <th className="py-2 px-3 border-r border-gray-200 w-48">Программа / Поток</th>
              {types.map(t => <th key={t} className="py-2 px-3 text-center border-r border-gray-200 whitespace-nowrap">{t}</th>)}
              <th className="py-2 px-3 text-center bg-gray-100 font-bold">Итог</th>
            </tr>
          </thead>
          <tbody>
             {products.map(prod => {
               const rowTotal = types.reduce((sum, t) => sum + (matrix[prod][t] || 0), 0);
               return (
                 <tr key={prod} className="border-b border-gray-200 hover:bg-gray-50">
                   <td className="py-2 px-3 border-r border-gray-200 font-medium">{prod}</td>
                   {types.map(t => (
                     <td key={t} className={`py-2 px-3 text-center border-r border-gray-200 ${matrix[prod][t] ? '' : 'text-gray-300'}`}>
                       {matrix[prod][t] || '—'}
                     </td>
                   ))}
                   <td className="py-2 px-3 text-center bg-gray-50 font-bold">{rowTotal}</td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const toDateInput = (d: string) => {
  if (!d) return '';
  if (d.includes('.')) return d.split('.').reverse().join('-');
  return d;
};
const fromDateInput = (d: string) => {
  if (!d) return '';
  if (d.includes('-')) return d.split('-').reverse().join('.');
  return d;
};
const isDateField = (k: string) => {
  const lower = k.toLowerCase();
  return lower.includes('дата') || lower.includes('старт') || lower.includes('выпуск') || lower === 'др';
};

function ActivityPanel({ activity, allRecords, onClose }: { activity: any, allRecords: any[], onClose: () => void }) {
  const isNew = activity._isNew;
  const [data, setData] = useState(isNew ? { id: crypto.randomUUID() } : { ...activity });

  const save = () => {
    if (isNew) createRecord('activities', data);
    else updateRecord('activities', data.id, data);
    onClose();
  };
  const del = async () => {
    if (confirm("Удалить активность?")) {
      await deleteRecord('activities', data.id, data);
      onClose();
    }
  };

  const uniqueTypes = Array.from(new Set(allRecords.map(r => r['Тип активности']).filter(Boolean)));
  const uniquePrograms = Array.from(new Set(allRecords.map(r => r['Программа']).filter(Boolean)));
  const uniquePotoks = Array.from(new Set(allRecords.map(r => r['Поток']).filter(Boolean)));
  const uniqueMentors = Array.from(new Set(allRecords.map(r => r['Ментор']).filter(Boolean)));

  const renderInput = (k: string) => {
    const val = data[k] || '';
    const setVal = (v: string) => setData({...data, [k]: v});
    const className = "w-full border border-gray-300 rounded px-2 py-1 text-sm";

    if (isDateField(k)) {
      return <input type="date" className={className} value={toDateInput(val)} onChange={e => setVal(fromDateInput(e.target.value))} />;
    }

    if (['Тип активности', 'Программа', 'Поток', 'Ментор'].includes(k)) {
      let options: string[] = [];
      if (k === 'Тип активности') options = uniqueTypes;
      if (k === 'Программа') options = uniquePrograms;
      if (k === 'Поток') options = uniquePotoks;
      if (k === 'Ментор') options = uniqueMentors;

      const listId = `list-${k.replace(/\s+/g, '-')}`;
      return (
        <>
          <input list={listId} className={className} value={val} onChange={e => setVal(e.target.value)} />
          <datalist id={listId}>
            {options.map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      );
    }

    return <input className={className} value={val} onChange={e => setVal(e.target.value)} />;
  };

  const fields = ['Период', 'Дата проведения', 'Тип активности', 'Ментор', 'Программа', 'Поток', 'Кол-во', 'Продолжительность факт', 'Продолжительность план', 'Кол-во участников', 'source'];

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col z-10 absolute right-0 top-0 bottom-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">{isNew ? 'Новая активность' : 'Активность'}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {fields.map(k => (
          <div key={k}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{k}</label>
            {renderInput(k)}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between">
        {!isNew ? <button onClick={del} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm flex items-center gap-1"><Trash2 className="w-4 h-4"/> Удалить</button> : <div/>}
        <button onClick={save} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Сохранить</button>
      </div>
    </div>
  );
}
