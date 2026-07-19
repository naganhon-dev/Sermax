import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Search, Trash2, X, Eye, EyeOff } from 'lucide-react';

export default function WebinarsTab() {
  const [view, setView] = useState('upcoming'); // upcoming, all, calendar
  const { data: events } = useCollection('webinar_events');
  const { data: themes } = useCollection('webinar_themes');

  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showThemes, setShowThemes] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex space-x-4">
           {[
             { id: 'upcoming', label: 'Ближайшие' },
             { id: 'all', label: 'Все' },
             { id: 'calendar', label: 'Календарь' }
           ].map(t => (
             <button
               key={t.id}
               onClick={() => setView(t.id)}
               className={`px-3 py-1.5 font-medium text-sm rounded ${view === t.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
             >
               {t.label}
             </button>
           ))}
        </div>
        <button onClick={() => setSelectedEvent({ _isNew: true })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
           <Plus className="w-4 h-4" /> Добавить вебинар
        </button>
      </div>
      
      <div className="p-4 border-b border-gray-100 bg-amber-50/50">
         <h4 className="font-semibold text-sm mb-2 text-amber-900">Темы месяцев</h4>
         <div className="flex flex-wrap gap-2 text-sm">
           {themes.map(t => (
             <div key={t.id} className="bg-white border border-amber-200 px-2 py-1 rounded text-amber-800 flex items-center gap-2">
                <span className="font-medium">{t['Месяц']}</span>
                <span>{t['Тема']}</span>
             </div>
           ))}
           <button onClick={() => setShowThemes(true)} className="text-amber-600 text-xs underline">Редактировать темы</button>
         </div>
      </div>

      <div className="flex-1 overflow-hidden flex relative">
         <div className="flex-1 overflow-auto p-4">
           <WebinarsList view={view} events={events} onSelect={setSelectedEvent} />
         </div>
         {selectedEvent && <EventPanel event={selectedEvent} allRecords={events} onClose={() => setSelectedEvent(null)} />}
         {showThemes && <ThemesPanel themes={themes} onClose={() => setShowThemes(false)} />}
      </div>
    </div>
  );
}

function WebinarsList({ view, events, onSelect }: { view: string, events: any[], onSelect: (e: any) => void }) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    let list = [...events];
    if (view === 'upcoming') {
      const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('.'); // roughly... 
      // better to use actual date logic
      // Assume "дата" is DD.MM.YYYY
      const parseD = (d: string) => d ? d.split('.').reverse().join('-') : '';
      const t = new Date().toISOString().slice(0, 10);
      list = list.filter(e => parseD(e['Дата']) >= t);
      list.sort((a,b) => parseD(a['Дата']).localeCompare(parseD(b['Дата'])));
    } else {
      const parseD = (d: string) => d ? d.split('.').reverse().join('-') : '';
      list.sort((a,b) => parseD(b['Дата']).localeCompare(parseD(a['Дата']))); // desc
    }
    
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => (e['Тема']||'').toLowerCase().includes(q) || (e['Ведущий']||'').toLowerCase().includes(q));
    }
    return list;
  }, [events, view, search]);

  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {view === 'all' && (
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
          <input placeholder="Поиск по теме/ведущему..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-2 py-1 border border-gray-300 rounded text-sm w-full" />
        </div>
      )}
      
      <table className="w-full text-left border-collapse text-sm">
         <thead>
           <tr className="border-b-2 border-gray-200">
             <th className="py-2 px-2 w-24">Дата</th>
             <th className="py-2 px-2 w-16">Время</th>
             <th className="py-2 px-2">Тема</th>
             <th className="py-2 px-2">Группы клиентов</th>
             <th className="py-2 px-2">Ссылки</th>
             <th className="py-2 px-2 w-32">Пароль</th>
             <th className="py-2 px-2">Ведущий</th>
           </tr>
         </thead>
         <tbody>
           {filtered.map(e => (
             <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(e)}>
               <td className="py-2 px-2 font-medium">{e['Дата']}</td>
               <td className="py-2 px-2 text-gray-500">{e['Время']}</td>
               <td className="py-2 px-2 font-medium text-blue-900">{e['Тема']}</td>
               <td className="py-2 px-2">{e['Группы клиентов']}</td>
               <td className="py-2 px-2">
                 <div className="flex flex-col gap-1 text-xs">
                   {e['Ссылка для студентов'] && <a href={e['Ссылка для студентов']} target="_blank" className="text-blue-600 hover:underline" onClick={ev => ev.stopPropagation()}>Для студентов</a>}
                   {e['Ссылка на трансляцию'] && <a href={e['Ссылка на трансляцию']} target="_blank" className="text-blue-600 hover:underline" onClick={ev => ev.stopPropagation()}>Трансляция</a>}
                 </div>
               </td>
               <td className="py-2 px-2" onClick={ev => ev.stopPropagation()}>
                 {e['Пароль'] ? (
                   <div className="flex items-center gap-1">
                     <span className="font-mono text-gray-600">{showPwd[e.id] ? e['Пароль'] : '••••••••'}</span>
                     <button onClick={() => setShowPwd(p => ({...p, [e.id]: !p[e.id]}))} className="text-gray-400 hover:text-gray-700">
                        {showPwd[e.id] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                     </button>
                   </div>
                 ) : <span className="text-gray-300">—</span>}
               </td>
               <td className="py-2 px-2">{e['Ведущий']}</td>
             </tr>
           ))}
           {filtered.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">Нет вебинаров</td></tr>}
         </tbody>
      </table>
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

function EventPanel({ event, allRecords, onClose }: { event: any, allRecords: any[], onClose: () => void }) {
  const isNew = event._isNew;
  const [data, setData] = useState(isNew ? { id: crypto.randomUUID() } : { ...event });

  const save = () => {
    if (isNew) createRecord('webinar_events', data);
    else updateRecord('webinar_events', data.id, data);
    onClose();
  };

  const del = async () => {
    if (confirm("Удалить вебинар?")) {
      await deleteRecord('webinar_events', data.id, data);
      onClose();
    }
  };

  const uniqueHosts = Array.from(new Set(allRecords.map(r => r['Ведущий']).filter(Boolean)));

  const renderInput = (k: string) => {
    const val = data[k] || '';
    const setVal = (v: string) => setData({...data, [k]: v});
    const className = "w-full border border-gray-300 rounded px-2 py-1 text-sm";

    if (isDateField(k)) {
      return <input type="date" className={className} value={toDateInput(val)} onChange={e => setVal(fromDateInput(e.target.value))} />;
    }

    if (k === 'Ведущий') {
      const listId = `list-host`;
      return (
        <>
          <input list={listId} className={className} value={val} onChange={e => setVal(e.target.value)} />
          <datalist id={listId}>
            {uniqueHosts.map(o => <option key={o} value={o} />)}
          </datalist>
        </>
      );
    }

    if (k === 'Тема') {
      return <textarea className="w-full border border-gray-300 rounded px-2 py-1 h-16 text-sm" value={val} onChange={e => setVal(e.target.value)} />;
    }

    return <input className={className} value={val} onChange={e => setVal(e.target.value)} />;
  };

  const fields = ['Дата', 'Время', 'Тема', 'Группы клиентов', 'Ссылка для студентов', 'Ссылка на трансляцию', 'Пароль', 'Ведущий', 'Дата отправки письма'];

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col z-10 absolute right-0 top-0 bottom-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">{isNew ? 'Новый вебинар' : 'Вебинар'}</h3>
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
        {!isNew ? (
           <button onClick={del} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm flex items-center gap-1"><Trash2 className="w-4 h-4"/> Удалить</button>
        ) : <div/>}
        <button onClick={save} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Сохранить</button>
      </div>
    </div>
  );
}

function ThemesPanel({ themes, onClose }: { themes: any[], onClose: () => void }) {
  const addTheme = () => {
    const month = prompt("Введите месяц:");
    if (month) {
      createRecord('webinar_themes', { 'Месяц': month, 'Тема': '' });
    }
  };

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col z-10 absolute right-0 top-0 bottom-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">Темы месяцев</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {themes.map(t => (
          <div key={t.id} className="border border-gray-200 rounded p-3 relative group bg-gray-50">
            <button 
              onClick={() => { if(confirm("Удалить тему?")) deleteRecord('webinar_themes', t.id, t); }} 
              className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4"/>
            </button>
            <div className="mb-2">
              <label className="text-xs font-medium text-gray-500">Месяц</label>
              <input 
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white" 
                value={t['Месяц'] || ''} 
                onChange={e => updateRecord('webinar_themes', t.id, { 'Месяц': e.target.value })} 
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Тема</label>
              <textarea 
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white h-16" 
                value={t['Тема'] || ''} 
                onChange={e => updateRecord('webinar_themes', t.id, { 'Тема': e.target.value })} 
              />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
        <button onClick={addTheme} className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded text-sm font-medium hover:bg-amber-200 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>
    </div>
  );
}
