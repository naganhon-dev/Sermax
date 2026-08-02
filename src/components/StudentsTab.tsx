import { useState, useMemo, useEffect } from 'react';
import { useCollection, updateRecord, createRecord, deleteRecord } from '../lib/useCollection';
import { Search, Plus, Trash2, X, Filter } from 'lucide-react';
import { useSort } from '../lib/useSort';
import { usePagination } from '../lib/usePagination';
import Pagination from './Pagination';
import { auth } from '../firebase';
import { useResizableColumns } from '../lib/useResizableColumns';
import { canonStatus, STANDARD_STATUSES, ACTIVE_MENTORS, canonMentor } from '../lib/status';

const isDateField = (k: string) => {
  if (!k) return false;
  const lower = k.toLowerCase();
  return lower.includes('дата') || lower.includes('старт') || lower.includes('выпуск') || lower.includes('покупк') || lower === 'др' || lower.includes('date');
};

export function normalizeToIsoDate(val: any): string {
  if (!val) return '';
  try {
    const str = String(val).trim();
    if (!str) return '';

    // If YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // If ISO timestamp like YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      return str.split('T')[0];
    }

    // If DD.MM.YYYY or D.M.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(str)) {
      const parts = str.split('.');
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].substring(0, 4);
        const d = parseInt(day, 10);
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return `${year}-${month}-${day}`;
        }
      }
    }

    // Fallback: Date constructor
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      if (yyyy >= 1900 && yyyy <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  } catch (e) {
    console.warn("Error normalizing date:", e);
  }
  return '';
}

export function sanitizeStudentDates(record: any): any {
  if (!record || typeof record !== 'object') return record;
  const copy = { ...record };
  for (const k of Object.keys(copy)) {
    if (isDateField(k) && copy[k]) {
      copy[k] = normalizeToIsoDate(copy[k]);
    }
  }
  return copy;
}

function parseToComparableDate(val: any): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(str)) {
    const parts = str.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('-');
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

interface DynamicFilterRow {
  id: string;
  field: string;
  value: string;
  dateFrom: string;
  dateTo: string;
}

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

  useEffect(() => {
    if (targetStudent) {
      setSelectedStudent(targetStudent);
    }
  }, [targetStudent]);

  // Advanced Filter Panel state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilterRow[]>([]);

  const { handleSort, renderSortIcon, sortData } = useSort();

  // Extract all available fields dynamically across students
  const availableStudentFields = useMemo(() => {
    const priority = [
      'Статус', 'Пакет обучения', 'Программа', 'Рынок', 'Ментор', 
      'Группа', 'Старт Эво 2.0', 'Старт Наставничество', 'Дата выпуска', 
      'Дата старта', 'ФИО', 'Почта', 'Телефон', 'Анкета 2/3', 'Отправки', 'Звонки', 'Результаты'
    ];
    const set = new Set<string>(priority);
    students.forEach((s: any) => {
      Object.keys(s).forEach(k => {
        if (k !== 'id' && k !== '_isNew' && k !== 'flow_changes' && !k.startsWith('_')) {
          set.add(k);
        }
      });
    });
    const all = Array.from(set);
    return all.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'ru');
    });
  }, [students]);

  // Extract distinct values for a given field
  const getDistinctValues = (fieldName: string) => {
    if (!fieldName) return [];
    const set = new Set<string>();

    if (fieldName === 'Статус') {
      STANDARD_STATUSES.forEach(st => set.add(st));
    }

    students.forEach((s: any) => {
      let val = s[fieldName];
      if (fieldName === 'Статус') {
        val = canonStatus(val);
      }
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        if (str !== '') set.add(str);
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  };

  const addFilterRow = () => {
    const defaultField = availableStudentFields[0] || 'Статус';
    setDynamicFilters(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        field: defaultField,
        value: '',
        dateFrom: '',
        dateTo: ''
      }
    ]);
  };

  const updateFilterRow = (id: string, updates: Partial<DynamicFilterRow>) => {
    setDynamicFilters(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const removeFilterRow = (id: string) => {
    setDynamicFilters(prev => prev.filter(row => row.id !== id));
  };

  const clearAllFilters = () => {
    setProgram('Все');
    setSearch('');
    setStatusFilter('');
    setPackageFilter('');
    setDynamicFilters([]);
  };

  // Resize columns setup
  const userEmail = auth?.currentUser?.email || 'guest';
  const defaultWidths = {
    fio: 200,
    email: 180,
    phone: 150,
    packet: 120,
    status: 120,
    start: 100,
    graduate: 100,
    comment: 250,
  };
  const { widths, handleResizeStart, resetWidths } = useResizableColumns(
    `students_width_${collectionName}`,
    defaultWidths,
    userEmail
  );

  const filtered = useMemo(() => {
    return students.filter((s: any) => {
      // Exclude leads from the main Student Registry
      if (s.is_lead || s.isLead || s.is_lead_contact) return false;

      // Program check
      if (program !== 'Все') {
         const progMatch = s['Программа'] === program || (s['Пакет обучения'] || '').includes(program);
         if (!progMatch) return false;
      }
      
      if (statusFilter && canonStatus(s['Статус']) !== statusFilter) return false;
      if (packageFilter && String(s['Пакет обучения'] || '').toLowerCase() !== packageFilter.toLowerCase()) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const f = String(s['ФИО']||'').toLowerCase();
        const e = String(s['Почта']||'').toLowerCase();
        const p = String(s['Телефон']||'').toLowerCase();
        if (!f.includes(q) && !e.includes(q) && !p.includes(q)) return false;
      }

      // Dynamic Filters (Logical AND)
      for (const df of dynamicFilters) {
        if (!df.field) continue;

        if (isDateField(df.field)) {
          if (!df.dateFrom && !df.dateTo) continue;

          const rawVal = s[df.field];
          const sDate = parseToComparableDate(rawVal);
          if (!sDate) return false;

          if (df.dateFrom) {
            const dFrom = new Date(df.dateFrom);
            dFrom.setHours(0, 0, 0, 0);
            if (sDate < dFrom) return false;
          }

          if (df.dateTo) {
            const dTo = new Date(df.dateTo);
            dTo.setHours(23, 59, 59, 999);
            if (sDate > dTo) return false;
          }
        } else {
          if (!df.value) continue;

          const rawVal = s[df.field];
          const studentValStr = df.field === 'Статус' ? canonStatus(rawVal) : String(rawVal ?? '').trim();

          if (studentValStr !== df.value && studentValStr.toLowerCase() !== df.value.toLowerCase()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [students, program, search, statusFilter, packageFilter, dynamicFilters]);

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
  } = usePagination(sortedData, [program, search, statusFilter, packageFilter, dynamicFilters], `pageSize_${collectionName}`);

  const statuses = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((s: any) => {
      const st = canonStatus(s['Статус']) || 'Не указан';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [filtered]);

  const activeDynamicFiltersCount = dynamicFilters.filter(df => 
    isDateField(df.field) ? (df.dateFrom || df.dateTo) : df.value
  ).length;

  const hasAnyActiveFilter = program !== 'Все' || !!search.trim() || !!statusFilter || !!packageFilter || activeDynamicFiltersCount > 0;

  return (
    <div className="flex h-full">
       <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-gray-200 flex flex-col gap-3">
             <div className="flex gap-4 items-center justify-between flex-wrap">
                <div className="flex gap-2 items-center flex-wrap">
                   <select value={program} onChange={e => setProgram(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                      <option value="Все">Все программы</option>
                      <option value="ГП">ГП</option>
                      <option value="Эволюция">Эволюция</option>
                   </select>
                   <div className="relative">
                     <Search className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                     <input placeholder="Поиск (ФИО, почта, тел)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-2 py-1 border border-gray-300 rounded text-sm w-64 bg-white" />
                   </div>
                   <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                      <option value="">Все статусы</option>
                      {STANDARD_STATUSES.map(st => (
                         <option key={st} value={st}>{st}</option>
                      ))}
                   </select>
                   <input placeholder="Пакет" value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-32 bg-white" />

                   {/* Кнопка "Фильтры" */}
                   <button
                     type="button"
                     onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                     className={`px-3 py-1 border rounded text-sm flex items-center gap-1.5 transition-colors ${
                       isFilterPanelOpen || activeDynamicFiltersCount > 0
                         ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                         : 'border-gray-300 text-gray-700 hover:bg-gray-50 bg-white'
                     }`}
                   >
                     <Filter className="w-4 h-4" />
                     <span>Фильтры</span>
                     {activeDynamicFiltersCount > 0 && (
                       <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                         {activeDynamicFiltersCount}
                       </span>
                     )}
                   </button>
                </div>

                <div className="flex gap-3 items-center">
                   <div className="text-xs text-gray-600 font-medium whitespace-nowrap bg-gray-100 px-2.5 py-1.5 rounded border border-gray-200">
                     Найдено: <span className="text-gray-900 font-bold">{filtered.length}</span> из {students.length}
                   </div>
                   <button onClick={resetWidths} className="text-gray-500 hover:text-gray-700 text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors bg-white" title="Сбросить ширину колонок">
                     Сбросить ширину
                   </button>
                   <button onClick={() => setSelectedStudent({ _isNew: true })} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700 font-medium shadow-sm">
                     <Plus className="w-4 h-4" /> Добавить
                   </button>
                </div>
             </div>

             {/* Панель фильтров */}
             {isFilterPanelOpen && (
               <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col gap-3 transition-all animate-in fade-in duration-150 shadow-inner">
                 <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                   <div className="flex items-center gap-2">
                     <Filter className="w-4 h-4 text-blue-600" />
                     <span className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                       Панель расширенных фильтров (условия логического И)
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={addFilterRow}
                       className="text-xs bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded font-medium flex items-center gap-1 shadow-sm transition-colors"
                     >
                       <Plus className="w-3.5 h-3.5" /> Добавить условие
                     </button>
                     <button
                       type="button"
                       onClick={() => setIsFilterPanelOpen(false)}
                       className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                     >
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                 </div>

                 {dynamicFilters.length === 0 ? (
                   <div className="text-xs text-slate-500 italic py-2 flex items-center gap-2">
                     <span>Условия не добавлены. Нажмите "+ Добавить условие", чтобы отфильтровать студентов по любому полю карточки.</span>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-2">
                     {dynamicFilters.map((df, idx) => {
                       const isDate = isDateField(df.field);
                       const distinctVals = getDistinctValues(df.field);

                       return (
                         <div key={df.id} className="flex flex-wrap items-center gap-2.5 bg-white p-2.5 rounded border border-slate-200 shadow-sm text-xs">
                           <span className="text-slate-400 font-semibold text-[11px] w-5">{idx + 1}.</span>
                           
                           {/* Поле */}
                           <div className="flex items-center gap-1.5">
                             <span className="text-slate-500 font-medium">Поле:</span>
                             <select
                               value={df.field}
                               onChange={(e) => updateFilterRow(df.id, { field: e.target.value, value: '', dateFrom: '', dateTo: '' })}
                               className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none max-w-[210px] font-medium text-slate-800"
                             >
                               {availableStudentFields.map(f => (
                                 <option key={f} value={f}>{f}</option>
                               ))}
                             </select>
                           </div>

                           {/* Значение */}
                           {isDate ? (
                             <div className="flex items-center gap-2 flex-wrap">
                               <div className="flex items-center gap-1">
                                 <span className="text-slate-500">От:</span>
                                 <input
                                   type="date"
                                   value={df.dateFrom}
                                   onChange={(e) => updateFilterRow(df.id, { dateFrom: e.target.value })}
                                   className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                 />
                               </div>
                               <div className="flex items-center gap-1">
                                 <span className="text-slate-500">До:</span>
                                 <input
                                   type="date"
                                   value={df.dateTo}
                                   onChange={(e) => updateFilterRow(df.id, { dateTo: e.target.value })}
                                   className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                 />
                               </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
                               <span className="text-slate-500 font-medium">Значение:</span>
                               <select
                                 value={df.value}
                                 onChange={(e) => updateFilterRow(df.id, { value: e.target.value })}
                                 className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none flex-1 max-w-[340px]"
                               >
                                 <option value="">-- Все значения --</option>
                                 {distinctVals.map(val => (
                                   <option key={val} value={val}>{val}</option>
                                 ))}
                               </select>
                             </div>
                           )}

                           {/* Удалить условную строку */}
                           <button
                             type="button"
                             onClick={() => removeFilterRow(df.id)}
                             className="text-slate-400 hover:text-red-600 p-1 rounded ml-auto transition-colors"
                             title="Удалить условие"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
             )}

             {/* Активные фильтры (Чипсы) */}
             {hasAnyActiveFilter && (
               <div className="flex flex-wrap items-center gap-1.5 pt-1">
                 <span className="text-[11px] font-semibold text-gray-500 mr-1">Активные фильтры:</span>
                 
                 {program !== 'Все' && (
                   <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                     Программа: {program}
                     <button type="button" onClick={() => setProgram('Все')} className="hover:text-blue-950 ml-0.5">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}

                 {search.trim() && (
                   <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                     Поиск: "{search.trim()}"
                     <button type="button" onClick={() => setSearch('')} className="hover:text-amber-950 ml-0.5">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}

                 {statusFilter && (
                   <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                     Статус: {statusFilter}
                     <button type="button" onClick={() => setStatusFilter('')} className="hover:text-emerald-950 ml-0.5">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}

                 {packageFilter && (
                   <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                     Пакет: {packageFilter}
                     <button type="button" onClick={() => setPackageFilter('')} className="hover:text-purple-950 ml-0.5">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 )}

                 {dynamicFilters.map((df) => {
                   const isDate = isDateField(df.field);
                   const hasVal = isDate ? (df.dateFrom || df.dateTo) : df.value;
                   if (!hasVal) return null;

                   let label = `${df.field}: `;
                   if (isDate) {
                     if (df.dateFrom && df.dateTo) label += `с ${df.dateFrom} по ${df.dateTo}`;
                     else if (df.dateFrom) label += `с ${df.dateFrom}`;
                     else if (df.dateTo) label += `по ${df.dateTo}`;
                   } else {
                     label += df.value;
                   }

                   return (
                     <span key={df.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium">
                       {label}
                       <button type="button" onClick={() => removeFilterRow(df.id)} className="hover:text-indigo-950 ml-0.5">
                         <X className="w-3 h-3" />
                       </button>
                     </span>
                   );
                 })}

                 <button
                   type="button"
                   onClick={clearAllFilters}
                   className="text-xs text-red-600 hover:text-red-800 font-medium underline ml-2 transition-colors"
                 >
                   Сбросить все
                 </button>
               </div>
             )}

             <div className="flex gap-4 text-sm text-gray-600 overflow-x-auto pb-1">
                {Object.entries(statuses).map(([k, v]) => (
                  <div key={k} className="whitespace-nowrap"><span className="font-semibold text-gray-800">{k}:</span> {v}</div>
                ))}
             </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 relative">
             <table className="text-left border-collapse text-sm" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
               <thead>
                 <tr className="border-b-2 border-gray-200">
                   <th style={{ width: widths.fio, minWidth: widths.fio, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('ФИО')} className="w-full h-full pr-4">{renderSortIcon('ФИО')}ФИО</div>
                     <div onMouseDown={e => handleResizeStart(e, 'fio')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.email, minWidth: widths.email, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Почта')} className="w-full h-full pr-4">{renderSortIcon('Почта')}Почта</div>
                     <div onMouseDown={e => handleResizeStart(e, 'email')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.phone, minWidth: widths.phone, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Телефон')} className="w-full h-full pr-4">{renderSortIcon('Телефон')}Телефон</div>
                     <div onMouseDown={e => handleResizeStart(e, 'phone')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.packet, minWidth: widths.packet, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Пакет обучения')} className="w-full h-full pr-4">{renderSortIcon('Пакет обучения')}Пакет</div>
                     <div onMouseDown={e => handleResizeStart(e, 'packet')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.status, minWidth: widths.status, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Статус')} className="w-full h-full pr-4">{renderSortIcon('Статус')}Статус</div>
                     <div onMouseDown={e => handleResizeStart(e, 'status')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.start, minWidth: widths.start, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Дата старта')} className="w-full h-full pr-4">{renderSortIcon('Дата старта')}Старт</div>
                     <div onMouseDown={e => handleResizeStart(e, 'start')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.graduate, minWidth: widths.graduate, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Дата выпуска')} className="w-full h-full pr-4">{renderSortIcon('Дата выпуска')}Выпуск</div>
                     <div onMouseDown={e => handleResizeStart(e, 'graduate')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                   <th style={{ width: widths.comment, minWidth: widths.comment, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                     <div onClick={() => handleSort('Комментарий')} className="w-full h-full pr-4">{renderSortIcon('Комментарий')}Комментарий</div>
                     <div onMouseDown={e => handleResizeStart(e, 'comment')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {paginatedData.map((s: any) => (
                   <tr key={s.id} onClick={() => setSelectedStudent(s)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                     <td className="py-1.5 px-2 relative truncate animate-fade-in" style={{ width: widths.fio, maxWidth: widths.fio, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['ФИО']}>
                        {s._color && <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: s._color}} />}
                        {s['ФИО']}
                     </td>
                     <td className="py-1.5 px-2 text-gray-500 truncate" style={{ width: widths.email, maxWidth: widths.email, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Почта']}>{s['Почта']}</td>
                     <td className="py-1.5 px-2 text-gray-500 truncate" style={{ width: widths.phone, maxWidth: widths.phone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Телефон']}>{s['Телефон']}</td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.packet, maxWidth: widths.packet, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Пакет обучения']}>{s['Пакет обучения']}</td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.status, maxWidth: widths.status, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={canonStatus(s['Статус'])}>
                        <StatusBadge status={canonStatus(s['Статус'])} />
                     </td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.start, maxWidth: widths.start, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Дата старта']}>{s['Дата старта']}</td>
                     <td className="py-1.5 px-2 truncate" style={{ width: widths.graduate, maxWidth: widths.graduate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Дата выпуска']}>{s['Дата выпуска']}</td>
                     <td className="py-1.5 px-2 text-gray-500 truncate" style={{ width: widths.comment, maxWidth: widths.comment, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s['Комментарий']}>{s['Комментарий']}</td>
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

function StudentPanel({ student, collectionName, allRecords, onClose }: { student: any, collectionName: string, allRecords: any[], onClose: () => void }) {
  const isNew = student._isNew;
  const [data, setData] = useState(isNew ? { id: crypto.randomUUID() } : { ...student });
  const [showConfirmDel, setShowConfirmDel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowForm, setFlowForm] = useState({
    old: '',
    new: '',
    date: normalizeToIsoDate(new Date().toISOString().split('T')[0]),
    reason: ''
  });
  const [flowError, setFlowError] = useState('');

  const executeSave = (recordToSave: any) => {
    const sanitizedRecord = sanitizeStudentDates(recordToSave);
    if (isNew) {
      createRecord(collectionName, sanitizedRecord);
    } else {
      const formatValue = (val: any) => {
        if (val === undefined || val === null || val === '') return '';
        if (typeof val === 'object') {
          if (Array.isArray(val)) {
            if (val.length === 0) return '';
            return val.map((item) => {
              if (item && typeof item === 'object' && (item.old || item.new || item.reason)) {
                return `[${item.date || ''}] ${item.old || ''} -> ${item.new || ''} (причина: ${item.reason || ''})`;
              }
              return JSON.stringify(item);
            }).join('; ');
          }
          return JSON.stringify(val);
        }
        return String(val);
      };

      const allKeys = Array.from(new Set([...Object.keys(student || {}), ...Object.keys(sanitizedRecord || {})]));
      const changes: { field: string; oldValue: string; newValue: string }[] = [];

      for (const key of allKeys) {
        if (key === 'id' || key === '_isNew') continue;

        const oldVal = student ? student[key] : undefined;
        const newVal = sanitizedRecord ? sanitizedRecord[key] : undefined;

        const oldStr = formatValue(oldVal);
        const newStr = formatValue(newVal);

        if (oldStr !== newStr) {
          changes.push({
            field: key === 'flow_changes' ? 'История смены потока' : key,
            oldValue: oldStr || '—',
            newValue: newStr || '—'
          });
        }
      }

      if (changes.length > 0) {
        const studentFio = sanitizedRecord['ФИО'] || sanitizedRecord['fio'] || (student && (student['ФИО'] || student['fio'])) || 'Без ФИО';
        createRecord('logs', {
          timestamp: new Date().toISOString(),
          author: auth.currentUser?.email || 'Неизвестный',
          studentId: sanitizedRecord.id,
          studentFio: String(studentFio).trim(),
          changes
        });
      }

      updateRecord(collectionName, sanitizedRecord.id, sanitizedRecord);
    }
    onClose();
  };

  const save = () => {
    const currentEvo = normalizeToIsoDate(data['Старт Эво 2.0'] ?? data['Старт Эво'] ?? data['Дата старта'] ?? '');
    const currentNast = normalizeToIsoDate(data['Старт Наставничество'] ?? '');

    const prevEvo = normalizeToIsoDate(student['Старт Эво 2.0'] ?? student['Старт Эво'] ?? student['Дата старта'] ?? '');
    const prevNast = normalizeToIsoDate(student['Старт Наставничество'] ?? '');

    const evoChanged = currentEvo !== prevEvo;
    const nastChanged = currentNast !== prevNast;

    if (evoChanged || nastChanged) {
      const oldParts: string[] = [];
      const newParts: string[] = [];

      if (evoChanged) {
        oldParts.push(`Эво 2.0: ${prevEvo || 'не указан'}`);
        newParts.push(`Эво 2.0: ${currentEvo || 'не указан'}`);
      }
      if (nastChanged) {
        oldParts.push(`Наставничество: ${prevNast || 'не указан'}`);
        newParts.push(`Наставничество: ${currentNast || 'не указан'}`);
      }

      setFlowForm({
        old: oldParts.join(', '),
        new: newParts.join(', '),
        date: normalizeToIsoDate(new Date().toISOString().split('T')[0]),
        reason: ''
      });
      setFlowError('');
      setShowFlowModal(true);
      return;
    }

    executeSave(sanitizeStudentDates(data));
  };

  const confirmFlowChange = () => {
    if (!flowForm.reason.trim()) {
      setFlowError('Укажите причину смены потока');
      return;
    }

    const flowDateIso = normalizeToIsoDate(flowForm.date) || new Date().toISOString().split('T')[0];

    const changeRecord = {
      old: flowForm.old,
      new: flowForm.new,
      date: flowDateIso,
      reason: flowForm.reason.trim(),
      author: auth.currentUser?.email || 'Пользователь',
      timestamp: new Date().toISOString()
    };

    const updatedData = sanitizeStudentDates({
      ...data,
      flow_changes: [...(data.flow_changes || []), changeRecord]
    });

    setData(updatedData);
    setShowFlowModal(false);
    executeSave(updatedData);
  };

  const del = async () => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteRecord(collectionName, data.id, data);
      onClose();
    } catch (err: any) {
      console.error("Failed to delete student:", err);
      setDeleteError(err?.message || "Не удалось удалить. Проверьте права доступа.");
      setIsDeleting(false);
    }
  };

  const uniquePackages = Array.from(new Set(allRecords.map(r => r['Пакет обучения']).filter(Boolean)));
  const uniqueMentors = Array.from(new Set(allRecords.map(r => r['Ментор'] || r['ментор']).filter(Boolean)));
  const uniqueGroups = Array.from(new Set(allRecords.map(r => r['Группа']).filter(Boolean)));
  const uniqueMarkets = Array.from(new Set(allRecords.map(r => r['Рынок']).filter(Boolean)));

  const mentorOptions = useMemo(() => {
    const dbMentors = allRecords
      .map(r => r['ментор'] || r['Ментор'] || r['mentor'])
      .filter(Boolean)
      .map(m => canonMentor(m));

    return Array.from(
      new Set(
        [...ACTIVE_MENTORS, ...dbMentors]
          .map(m => canonMentor(m))
          .filter(Boolean)
      )
    ).sort();
  }, [allRecords]);

  const renderInput = (k: string, isMain = false) => {
    const val = data[k] || '';
    const setVal = (v: string) => setData({...data, [k]: v});
    const className = isMain ? "w-full border border-gray-300 rounded px-2 py-1" : "w-full border border-gray-200 rounded px-2 py-1 text-sm bg-gray-50";

    if (isDateField(k)) {
      const safeIsoVal = normalizeToIsoDate(val);
      return (
        <input
          type="date"
          className={className}
          value={safeIsoVal}
          onChange={e => setVal(e.target.value ? normalizeToIsoDate(e.target.value) : '')}
        />
      );
    }

    if (k === 'Пакет обучения' || k === 'Ментор' || k === 'Группа' || k === 'Рынок') {
      let options: string[] = [];
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
    'ФИО', 'Почта', 'Телефон', 'Статус', 'Пакет обучения', 'Группа', 'группа', 'Комментарий', 'Рынок',
    'ментор', 'Ментор', 'mentor',
    'Старт Эво 2.0', 'Старт Эво', 'Дата старта', 'Старт Наставничество',
    'Анкета 2/3', 'Отправки', 'Звонки', 'Результаты',
    'анкета 2/3', 'отправки', 'звонки', 'результаты',
    'Анкета 2', 'Анкета 3', 'анкета 2', 'анкета 3',
    'flow_changes'
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
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-sm"
            value={data['Статус'] || ''}
            onChange={e => setData({ ...data, 'Статус': e.target.value })}
          >
            <option value="">— не указан —</option>
            {STANDARD_STATUSES.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
            {data['Статус'] && !STANDARD_STATUSES.includes(data['Статус']) && (
              <option value={data['Статус']}>{data['Статус']} (нестандартный)</option>
            )}
          </select>
          {data['Статус'] && !STANDARD_STATUSES.includes(data['Статус']) && (
            <p className="text-yellow-600 text-xs mt-1 font-medium bg-yellow-50 border border-yellow-100 rounded px-2 py-1">
              Нестандартный статус, выберите правильный
            </p>
          )}
        </div>

        {/* Состав группы */}
        <div className="pt-2 border-t border-gray-100 flex flex-col gap-3">
          <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Состав группы</h4>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Пакет обучения</label>
            <input
              list="student-packet-datalist"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              value={data['Пакет обучения'] || ''}
              onChange={e => setData({ ...data, 'Пакет обучения': e.target.value })}
              placeholder="Выберите или введите пакет"
            />
            <datalist id="student-packet-datalist">
              {uniquePackages.map(p => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Группа</label>
            <input
              list="student-group-datalist"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              value={data['Группа'] ?? data['группа'] ?? ''}
              onChange={e => {
                const val = e.target.value;
                const next = { ...data, 'Группа': val };
                if ('группа' in next) {
                  delete next['группа'];
                }
                setData(next);
              }}
              placeholder="Выберите или введите группу"
            />
            <datalist id="student-group-datalist">
              {uniqueGroups.map(g => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ментор</label>
            <input
              list="student-mentor-datalist"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              value={data['ментор'] ?? data['Ментор'] ?? ''}
              onChange={e => {
                const val = e.target.value;
                const next = { ...data, 'ментор': val };
                if ('Ментор' in next) {
                  delete next['Ментор'];
                }
                setData(next);
              }}
              placeholder="Выберите или введите ментора"
            />
            <datalist id="student-mentor-datalist">
              {mentorOptions.map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Даты старта */}
        <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
          <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Даты старта</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Старт Эво 2.0</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                value={normalizeToIsoDate(data['Старт Эво 2.0'] ?? data['Старт Эво'] ?? data['Дата старта'] ?? '')}
                onChange={e => setData({ ...data, 'Старт Эво 2.0': e.target.value ? normalizeToIsoDate(e.target.value) : '' })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Старт Наставничество</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                value={normalizeToIsoDate(data['Старт Наставничество'] || '')}
                onChange={e => setData({ ...data, 'Старт Наставничество': e.target.value ? normalizeToIsoDate(e.target.value) : '' })}
              />
            </div>
          </div>
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

        {/* История смены потока */}
        <div className="pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>История смены потока</span>
            {data.flow_changes && data.flow_changes.length > 0 && (
              <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                {data.flow_changes.length}
              </span>
            )}
          </h4>
          {data.flow_changes && data.flow_changes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.flow_changes.map((item: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-xs flex flex-col gap-1">
                  <div className="flex justify-between items-center text-gray-500 font-medium pb-1 border-b border-gray-200/60">
                    <span>Дата перехода: {item.date || '—'}</span>
                    {item.author && <span className="text-[10px] text-gray-400">{item.author}</span>}
                  </div>
                  <div className="text-gray-800 font-medium mt-1">
                    <span className="text-gray-500 font-normal">Было:</span> {item.old || '—'}
                  </div>
                  <div className="text-gray-800 font-medium">
                    <span className="text-gray-500 font-normal">Стало:</span> {item.new || '—'}
                  </div>
                  <div className="text-gray-700 mt-1 bg-white p-2 rounded border border-gray-100">
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">Причина:</span>
                    {item.reason}
                  </div>
                  {item.timestamp && (
                    <div className="text-[10px] text-gray-400 text-right mt-0.5">
                      {new Date(item.timestamp).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic bg-gray-50 p-2.5 rounded border border-dashed border-gray-200">
              История смен потока пуста
            </p>
          )}
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
      {deleteError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-red-600 text-xs font-medium">
          {deleteError}
        </div>
      )}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        {!isNew ? (
          showConfirmDel ? (
            <div className="flex gap-1.5 items-center">
              <span className="text-xs text-red-600 font-medium">Удалить студента?</span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={del}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition-colors"
              >
                {isDeleting ? 'Удаление...' : 'Да'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirmDel(false)}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 px-2 py-1 rounded text-xs transition-colors"
              >
                Нет
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmDel(true)}
              className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
          )
        ) : <div />}
        <button onClick={save} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Сохранить</button>
      </div>

      {/* Модальное окно "Смена потока" */}
      {showFlowModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-gray-800">Смена потока</h3>
              <button
                type="button"
                onClick={() => setShowFlowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Старый поток
                </label>
                <input
                  type="text"
                  readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded px-2.5 py-1.5 text-sm text-gray-700"
                  value={flowForm.old}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Новый поток
                </label>
                <input
                  type="text"
                  readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded px-2.5 py-1.5 text-sm text-gray-700"
                  value={flowForm.new}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Дата перехода <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={normalizeToIsoDate(flowForm.date)}
                  onChange={(e) => setFlowForm({ ...flowForm, date: e.target.value ? normalizeToIsoDate(e.target.value) : '' })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Причина смены потока <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Укажите причину перехода (обязательно)..."
                  value={flowForm.reason}
                  onChange={(e) => {
                    setFlowForm({ ...flowForm, reason: e.target.value });
                    if (flowError) setFlowError('');
                  }}
                />
                {flowError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{flowError}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowFlowModal(false)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmFlowChange}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
              >
                Сохранить смену
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
