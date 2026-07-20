import { useState, useMemo } from 'react';
import { useCollection, updateRecord, createRecord, deleteRecord } from '../lib/useCollection';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Plus, Trash2, X, Filter } from 'lucide-react';
import { useSort } from '../lib/useSort';
import { usePagination } from '../lib/usePagination';
import Pagination from './Pagination';

export default function StudentsTab({ targetStudent }: { targetStudent?: any }) {
  const [subTab, setSubTab] = useState('registry'); // registry, graduates, blacklist

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
        {[
          { id: 'registry', label: 'Реестр' },
          { id: 'graduates', label: 'Выпускники' },
          { id: 'blacklist', label: 'Ручная рассылка' },
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

  const { handleSort, renderSortIcon, sortData } = useSort();

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

  const sortedData = useMemo(() => sortData(filtered), [filtered, sortData]);

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
  } = usePagination(sortedData, [program, search, statusFilter, packageFilter], `pageSize_${collectionName}`);

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
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('ФИО')}>ФИО{renderSortIcon('ФИО')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Почта')}>Почта{renderSortIcon('Почта')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Телефон')}>Телефон{renderSortIcon('Телефон')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Пакет обучения')}>Пакет{renderSortIcon('Пакет обучения')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Статус')}>Статус{renderSortIcon('Статус')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Дата старта')}>Старт{renderSortIcon('Дата старта')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Дата выпуска')}>Выпуск{renderSortIcon('Дата выпуска')}</th>
                   <th className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('Комментарий')}>Комментарий{renderSortIcon('Комментарий')}</th>
                 </tr>
               </thead>
               <tbody>
                 {paginatedData.map((s: any) => (
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
             grandTotal={students.length}
           />
        </div>

       {selectedStudent && (
         <StudentPanel student={selectedStudent} collectionName={collectionName} allRecords={students} onClose={() => setSelectedStudent(null)} />
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

function StudentPanel({ student, collectionName, allRecords, onClose }: { student: any, collectionName: string, allRecords: any[], onClose: () => void }) {
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

  const uniqueStatuses = Array.from(new Set([
    "Учится", "Не приступал", "Заморозка", "Блокировка", "Выпустился", "Возврат", "Бронь",
    ...allRecords.map(r => r['Статус']).filter(Boolean)
  ]));
  const uniquePackages = Array.from(new Set(allRecords.map(r => r['Пакет обучения']).filter(Boolean)));
  const uniqueMentors = Array.from(new Set(allRecords.map(r => r['Ментор']).filter(Boolean)));
  const uniqueGroups = Array.from(new Set(allRecords.map(r => r['Группа']).filter(Boolean)));
  const uniqueMarkets = Array.from(new Set(allRecords.map(r => r['Рынок']).filter(Boolean)));

  const renderInput = (k: string, isMain = false) => {
    const val = data[k] || '';
    const setVal = (v: string) => setData({...data, [k]: v});
    const className = isMain ? "w-full border border-gray-300 rounded px-2 py-1" : "w-full border border-gray-200 rounded px-2 py-1 text-sm bg-gray-50";

    if (isDateField(k)) {
      return <input type="date" className={className} value={toDateInput(val)} onChange={e => setVal(fromDateInput(e.target.value))} />;
    }

    if (k === 'Статус' || k === 'Пакет обучения' || k === 'Ментор' || k === 'Группа' || k === 'Рынок') {
      let options: string[] = [];
      if (k === 'Статус') options = uniqueStatuses;
      if (k === 'Пакет обучения') options = uniquePackages;
      if (k === 'Ментор') options = uniqueMentors;
      if (k === 'Группа') options = uniqueGroups;
      if (k === 'Рынок') options = uniqueMarkets;
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

    if (k === 'Комментарий') {
      return <textarea className="w-full border border-gray-300 rounded px-2 py-1 h-20" value={val} onChange={e => setVal(e.target.value)} />;
    }

    return <input className={className} value={val} onChange={e => setVal(e.target.value)} />;
  };

  // grouping logic can be implemented manually
  const allKeys = Object.keys(data).filter(k => !k.startsWith('_') && k !== 'id');

  const questionnaireKeys = ["Анкета 2/3", "Отправки", "Звонки", "Результаты"];

  const getYesNoVal = (k: string) => {
    const val = data[k] !== undefined ? data[k] : data[k.toLowerCase()];
    if (val === undefined || val === null) return "";
    const s = String(val).trim().toLowerCase();
    if (s === 'да' || s === 'yes' || val === true) return "Да";
    if (s === 'нет' || s === 'no' || val === false) return "Нет";
    return "";
  };

  const setYesNoVal = (k: string, v: string) => {
    const updated = { ...data };
    if (k.toLowerCase() in updated) {
      delete updated[k.toLowerCase()];
    }
    updated[k] = v;
    setData(updated);
  };

  const excludedKeys = [
    'ФИО', 'Почта', 'Телефон', 'Статус', 'Пакет обучения', 'Комментарий', 'Рынок',
    'Анкета 2/3', 'Отправки', 'Звонки', 'Результаты',
    'анкета 2/3', 'отправки', 'звонки', 'результаты',
    'Анкета 2', 'Анкета 3', 'анкета 2', 'анкета 3'
  ];

  const dynamicKeys = allKeys.filter(k => !excludedKeys.includes(k));

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">{isNew ? 'Новый студент' : 'Карточка студента'}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ФИО</label>
          {renderInput('ФИО', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Почта</label>
          {renderInput('Почта', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          {renderInput('Телефон', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Статус</label>
          {renderInput('Статус', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Пакет обучения</label>
          {renderInput('Пакет обучения', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Рынок</label>
          {renderInput('Рынок', true)}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Комментарий</label>
          {renderInput('Комментарий', true)}
        </div>

        {/* Анкеты Section */}
        <div className="pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-sm mb-2 text-gray-700">Анкеты</h4>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex flex-col gap-2">
            {questionnaireKeys.map(k => {
              const currentVal = getYesNoVal(k);
              return (
                <div key={k} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
                  <span className="text-sm font-medium text-gray-600">{k}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setYesNoVal(k, currentVal === "Да" ? "" : "Да")}
                      className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${currentVal === "Да" ? 'bg-green-600 border-green-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={() => setYesNoVal(k, currentVal === "Нет" ? "" : "Нет")}
                      className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${currentVal === "Нет" ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      Нет
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Other dynamic fields */}
        {dynamicKeys.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-semibold text-sm mb-2 text-gray-700">Остальные поля</h4>
            {dynamicKeys.map(k => (
              <div key={k} className="mb-2">
                 <label className="block text-xs font-medium text-gray-400 mb-1">{k}</label>
                 {renderInput(k, false)}
              </div>
            ))}
          </div>
        )}
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
