import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, Filter } from 'lucide-react';

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

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (period && a['Период'] !== period) return false;
      if (mentor && a['Ментор'] !== mentor) return false;
      return true;
    });
  }, [activities, period, mentor]);

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
            <button onClick={() => setSelectedActivity({ _isNew: true })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
               <Plus className="w-4 h-4" /> Добавить
            </button>
         </div>
         <div className="flex-1 overflow-auto p-4">
           <table className="w-full text-left border-collapse text-sm">
             <thead>
               <tr className="border-b-2 border-gray-200">
                 <th className="py-2 px-2">Период</th>
                 <th className="py-2 px-2">Дата</th>
                 <th className="py-2 px-2">Тип активности</th>
                 <th className="py-2 px-2">Ментор</th>
                 <th className="py-2 px-2">Программа/Поток</th>
                 <th className="py-2 px-2 text-right">Кол-во</th>
               </tr>
             </thead>
             <tbody>
               {filtered.slice(0,100).map(a => (
                 <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedActivity(a)}>
                   <td className="py-1.5 px-2 text-gray-500">{a['Период']}</td>
                   <td className="py-1.5 px-2">{a['Дата проведения']}</td>
                   <td className="py-1.5 px-2">{a['Тип активности']}</td>
                   <td className="py-1.5 px-2 font-medium">{a['Ментор']}</td>
                   <td className="py-1.5 px-2 text-gray-600">{a['Программа']} {a['Поток']}</td>
                   <td className="py-1.5 px-2 text-right">{a['Кол-во'] || a['Кол-во активностей']}</td>
                 </tr>
               ))}
               {filtered.length > 100 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">Показаны 100 из {filtered.length}</td></tr>}
             </tbody>
           </table>
         </div>
      </div>
      {selectedActivity && <ActivityPanel activity={selectedActivity} onClose={() => setSelectedActivity(null)} />}
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

function ActivityPanel({ activity, onClose }: { activity: any, onClose: () => void }) {
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
            <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={data[k] || ''} onChange={e => setData({...data, [k]: e.target.value})} />
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
