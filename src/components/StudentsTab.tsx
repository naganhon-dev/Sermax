import { useState, useMemo } from 'react';
import { useCollection, updateRecord, createRecord, deleteRecord } from '../lib/useCollection';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Plus, Trash2, X, Filter } from 'lucide-react';

export default function StudentsTab({ targetStudent }: { targetStudent?: any }) {
  const [subTab, setSubTab] = useState('registry'); // registry, graduates, blacklist

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
        {[
          { id: 'registry', label: 'Реестр' },
          { id: 'graduates', label: 'Выпускники' },
          { id: 'blacklist', label: 'ЧС для рассылки' },
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
        {subTab === 'registry' && <RegistryView targetStudent={targetStudent} collectionName="students" />}
        {subTab === 'graduates' && <RegistryView collectionName="graduates" />}
        {subTab === 'blacklist' && <RegistryView collectionName="blacklist" />}
      </div>
    </div>
  );
}

function RegistryView({ targetStudent, collectionName }: { targetStudent?: any, collectionName: string }) {
  const { data: students, loading } = useCollection(collectionName);
  const [program, setProgram] = useState('Все'); // Все, ГП, Эволюция
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(targetStudent || null);

  const filtered = useMemo(() => {
    return students.filter((s: any) => {
      // Program check
      if (program !== 'Все') {
         // Assuming "ГП" / "Эволюция" can be derived. 
         // Let's assume there is a "Программа" field or we check package
         const progMatch = s['Программа'] === program || (s['Пакет обучения'] || '').includes(program);
         if (!progMatch) return false;
      }
      
      if (statusFilter && s['Статус'] !== statusFilter) return false;
      if (packageFilter && s['Пакет обучения'] !== packageFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const f = String(s['ФИО']||'').toLowerCase();
        const e = String(s['Почта']||'').toLowerCase();
        const p = String(s['Телефон']||'').toLowerCase();
        if (!f.includes(q) && !e.includes(q) && !p.includes(q)) return false;
      }
      return true;
    });
  }, [students, program, search, statusFilter, packageFilter]);

  const statuses = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((s: any) => {
      const st = s['Статус'] || 'Не указан';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [filtered]);

  // virtualization and table...
  
  return (
    <div className="flex h-full">
       <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-gray-200 flex flex-col gap-4">
             <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-2">
                   <select value={program} onChange={e => setProgram(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                      <option value="Все">Все программы</option>
                      <option value="ГП">ГП</option>
                      <option value="Эволюция">Эволюция</option>
                   </select>
                   <div className="relative">
                     <Search className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                     <input placeholder="Поиск (ФИО, почта, тел)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-2 py-1 border border-gray-300 rounded text-sm w-64" />
                   </div>
                   <input placeholder="Статус" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-32" />
                   <input placeholder="Пакет" value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-32" />
                </div>
                <button onClick={() => setSelectedStudent({ _isNew: true })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Добавить
                </button>
             </div>
             <div className="flex gap-4 text-sm text-gray-600 overflow-x-auto pb-1">
                {Object.entries(statuses).map(([k, v]) => (
                  <div key={k} className="whitespace-nowrap"><span className="font-semibold text-gray-800">{k}:</span> {v}</div>
                ))}
             </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
             <table className="w-full text-left border-collapse text-sm">
               <thead>
                 <tr className="border-b-2 border-gray-200">
                   <th className="py-2 px-2">ФИО</th>
                   <th className="py-2 px-2">Почта</th>
                   <th className="py-2 px-2">Телефон</th>
                   <th className="py-2 px-2">Пакет</th>
                   <th className="py-2 px-2">Статус</th>
                   <th className="py-2 px-2">Старт</th>
                   <th className="py-2 px-2">Выпуск</th>
                   <th className="py-2 px-2">Комментарий</th>
                 </tr>
               </thead>
               <tbody>
                 {filtered.slice(0, 100).map((s: any) => (
                   <tr key={s.id} onClick={() => setSelectedStudent(s)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                     <td className="py-1 px-2 relative">
                        {s._color && <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: s._color}} />}
                        {s['ФИО']}
                     </td>
                     <td className="py-1 px-2 text-gray-500">{s['Почта']}</td>
                     <td className="py-1 px-2 text-gray-500">{s['Телефон']}</td>
                     <td className="py-1 px-2">{s['Пакет обучения']}</td>
                     <td className="py-1 px-2">
                        <StatusBadge status={s['Статус']} />
                     </td>
                     <td className="py-1 px-2">{s['Дата старта']}</td>
                     <td className="py-1 px-2">{s['Дата выпуска']}</td>
                     <td className="py-1 px-2 text-gray-500 truncate max-w-[150px]">{s['Комментарий']}</td>
                   </tr>
                 ))}
                 {filtered.length > 100 && <tr><td colSpan={8} className="py-2 text-center text-gray-400">Показаны первые 100 из {filtered.length}</td></tr>}
               </tbody>
             </table>
          </div>
       </div>

       {selectedStudent && (
         <StudentPanel student={selectedStudent} collectionName={collectionName} onClose={() => setSelectedStudent(null)} />
       )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  let color = 'bg-yellow-100 text-yellow-800';
  if (status.includes('Учится')) color = 'bg-green-100 text-green-800';
  if (status.includes('Заморозка')) color = 'bg-blue-100 text-blue-800';
  if (status.includes('Не приступал')) color = 'bg-gray-200 text-gray-800';
  if (status.includes('Выпустился') || status.includes('Выпущен')) color = 'bg-purple-100 text-purple-800';
  
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{status}</span>;
}

function StudentPanel({ student, collectionName, onClose }: { student: any, collectionName: string, onClose: () => void }) {
  const isNew = student._isNew;
  const [data, setData] = useState(isNew ? { id: crypto.randomUUID() } : { ...student });

  const save = () => {
    if (isNew) createRecord(collectionName, data);
    else updateRecord(collectionName, data.id, data);
    onClose();
  };

  const del = async () => {
    if (confirm("Удалить запись?")) {
      await deleteRecord(collectionName, data.id, data);
      onClose();
    }
  };

  // grouping logic can be implemented manually
  const allKeys = Object.keys(data).filter(k => !k.startsWith('_') && k !== 'id');

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">{isNew ? 'Новый студент' : 'Карточка студента'}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ФИО</label>
          <input className="w-full border border-gray-300 rounded px-2 py-1" value={data['ФИО'] || ''} onChange={e => setData({...data, 'ФИО': e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Почта</label>
          <input className="w-full border border-gray-300 rounded px-2 py-1" value={data['Почта'] || ''} onChange={e => setData({...data, 'Почта': e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          <input className="w-full border border-gray-300 rounded px-2 py-1" value={data['Телефон'] || ''} onChange={e => setData({...data, 'Телефон': e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Статус</label>
          <input className="w-full border border-gray-300 rounded px-2 py-1" value={data['Статус'] || ''} onChange={e => setData({...data, 'Статус': e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Пакет обучения</label>
          <input className="w-full border border-gray-300 rounded px-2 py-1" value={data['Пакет обучения'] || ''} onChange={e => setData({...data, 'Пакет обучения': e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Комментарий</label>
          <textarea className="w-full border border-gray-300 rounded px-2 py-1 h-20" value={data['Комментарий'] || ''} onChange={e => setData({...data, 'Комментарий': e.target.value})} />
        </div>
        {/* Other dynamic fields */}
        <div className="pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-sm mb-2 text-gray-700">Остальные поля</h4>
          {allKeys.filter(k => !['ФИО','Почта','Телефон','Статус','Пакет обучения','Комментарий'].includes(k)).map(k => (
            <div key={k} className="mb-2">
               <label className="block text-xs font-medium text-gray-400 mb-1">{k}</label>
               <input className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-gray-50" value={data[k] || ''} onChange={e => setData({...data, [k]: e.target.value})} />
            </div>
          ))}
        </div>
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

// Removed empty views
