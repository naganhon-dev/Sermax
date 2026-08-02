import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Search, Trash2, X, Calendar as CalendarIcon, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { usePagination } from '../lib/usePagination';
import Pagination from './Pagination';
import { auth } from '../firebase';
import { useResizableColumns } from '../lib/useResizableColumns';

export const getWebinarField = (e: any, key: string): string => {
  if (!e) return '';
  switch (key) {
    case 'date':
      return String(e.date || e['Дата'] || '').trim();
    case 'time':
      return String(e.time || e['Время'] || '').trim();
    case 'topic':
      return String(e.topic || e['Тема'] || '').trim();
    case 'groups':
      return String(e.groups || e['Группы клиентов'] || '').trim();
    case 'linkStudents':
      return String(e.linkStudents || e['Ссылка для студентов'] || e['Ссылка на трансляцию'] || '').trim();
    case 'host':
      return String(e.host || e['Ведущий'] || '').trim();
    case 'mailDate':
      return String(e.mailDate || e['Дата отправки письма'] || '').trim();
    default:
      return String(e[key] || '').trim();
  }
};

export const toIsoDate = (d: string) => {
  if (!d) return '';
  const str = String(d).trim();
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str;
};

export const formatDateDisplay = (d: string) => {
  if (!d) return '';
  const str = String(d).trim();
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
  }
  return str;
};

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
                <span className="font-medium">{t.month || t['Месяц']}</span>
                <span>{t.topic || t['Тема']}</span>
             </div>
           ))}
           <button onClick={() => setShowThemes(true)} className="text-amber-600 text-xs underline">Редактировать темы</button>
         </div>
      </div>

      <div className="flex-1 overflow-hidden flex relative">
         <div className="flex-1 overflow-auto p-4">
           {view === 'calendar' ? (
             <WebinarsCalendarView events={events} onSelect={setSelectedEvent} />
           ) : (
             <WebinarsList view={view} events={events} onSelect={setSelectedEvent} />
           )}
         </div>
         {selectedEvent && <EventPanel event={selectedEvent} allRecords={events} onClose={() => setSelectedEvent(null)} />}
         {showThemes && <ThemesPanel themes={themes} onClose={() => setShowThemes(false)} />}
      </div>
    </div>
  );
}

function WebinarsList({ view, events, onSelect }: { view: string, events: any[], onSelect: (e: any) => void }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const userEmail = auth?.currentUser?.email || 'guest';
  const defaultWidths = {
    date: 110,
    time: 100,
    topic: 320,
    groups: 160,
    linkStudents: 140,
    mailDate: 120,
    host: 150,
  };
  const { widths, handleResizeStart, resetWidths } = useResizableColumns(
    'webinars_width_v2',
    defaultWidths,
    userEmail
  );

  const filtered = useMemo(() => {
    let list = [...events];
    const todayStr = new Date().toISOString().slice(0, 10);

    if (view === 'upcoming') {
      list = list.filter(e => {
        const d = toIsoDate(getWebinarField(e, 'date'));
        return d && d >= todayStr;
      });
      list.sort((a, b) => toIsoDate(getWebinarField(a, 'date')).localeCompare(toIsoDate(getWebinarField(b, 'date'))));
    } else {
      list.sort((a, b) => toIsoDate(getWebinarField(b, 'date')).localeCompare(toIsoDate(getWebinarField(a, 'date'))));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        getWebinarField(e, 'topic').toLowerCase().includes(q) ||
        getWebinarField(e, 'host').toLowerCase().includes(q) ||
        getWebinarField(e, 'groups').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, view, search]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = getWebinarField(a, sortField);
      let valB = getWebinarField(b, sortField);
      if (sortField === 'date' || sortField === 'mailDate') {
        valA = toIsoDate(valA);
        valB = toIsoDate(valB);
      }
      const res = String(valA).localeCompare(String(valB), 'ru', { numeric: true });
      return sortDir === 'asc' ? res : -res;
    });
  }, [filtered, sortField, sortDir]);

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1 text-blue-600" /> : <ArrowDown className="w-3 h-3 inline ml-1 text-blue-600" />;
  };

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
  } = usePagination<any>(sortedData, [view, search, sortField, sortDir], 'pageSize_webinars');

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            placeholder="Поиск по теме, ведущему, группе..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <button onClick={resetWidths} className="text-gray-500 hover:text-gray-700 text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors" title="Сбросить ширину колонок">
          Сбросить ширину
        </button>
      </div>
      
      <div className="flex-1 overflow-auto relative">
        <table className="text-left border-collapse text-sm" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
           <thead>
             <tr className="border-b-2 border-gray-200">
               <th style={{ width: widths.date, minWidth: widths.date, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('date')} className="w-full h-full pr-4">{renderSortIcon('date')}Дата</div>
                 <div onMouseDown={e => handleResizeStart(e, 'date')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.time, minWidth: widths.time, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('time')} className="w-full h-full pr-4">{renderSortIcon('time')}Время</div>
                 <div onMouseDown={e => handleResizeStart(e, 'time')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.topic, minWidth: widths.topic, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('topic')} className="w-full h-full pr-4">{renderSortIcon('topic')}Тема</div>
                 <div onMouseDown={e => handleResizeStart(e, 'topic')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.groups, minWidth: widths.groups, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('groups')} className="w-full h-full pr-4">{renderSortIcon('groups')}Группы клиентов</div>
                 <div onMouseDown={e => handleResizeStart(e, 'groups')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.linkStudents, minWidth: widths.linkStudents, position: 'sticky', top: 0 }} className="py-2 px-2 bg-white z-10 relative group">
                 <div className="w-full h-full pr-4">Ссылки</div>
                 <div onMouseDown={e => handleResizeStart(e, 'linkStudents')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.mailDate, minWidth: widths.mailDate, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('mailDate')} className="w-full h-full pr-4">{renderSortIcon('mailDate')}Дата рассылки</div>
                 <div onMouseDown={e => handleResizeStart(e, 'mailDate')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
               <th style={{ width: widths.host, minWidth: widths.host, position: 'sticky', top: 0 }} className="py-2 px-2 cursor-pointer hover:bg-gray-100 select-none bg-white z-10 relative group">
                 <div onClick={() => handleSort('host')} className="w-full h-full pr-4">{renderSortIcon('host')}Ведущий</div>
                 <div onMouseDown={e => handleResizeStart(e, 'host')} onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400 active:bg-blue-600 cursor-col-resize z-20" />
               </th>
             </tr>
           </thead>
           <tbody>
             {paginatedData.map(e => {
               const dateStr = formatDateDisplay(getWebinarField(e, 'date'));
               const timeStr = getWebinarField(e, 'time');
               const topicStr = getWebinarField(e, 'topic');
               const groupsStr = getWebinarField(e, 'groups');
               const linkStr = getWebinarField(e, 'linkStudents');
               const mailDateStr = formatDateDisplay(getWebinarField(e, 'mailDate'));
               const hostStr = getWebinarField(e, 'host');

               return (
                 <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(e)}>
                   <td className="py-2 px-2 font-medium text-gray-900 truncate" style={{ width: widths.date, maxWidth: widths.date, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dateStr}>{dateStr || '—'}</td>
                   <td className="py-2 px-2 text-gray-500 truncate" style={{ width: widths.time, maxWidth: widths.time, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={timeStr}>{timeStr || '—'}</td>
                   <td className="py-2 px-2 font-medium text-blue-900 truncate" style={{ width: widths.topic, maxWidth: widths.topic, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topicStr}>{topicStr || '—'}</td>
                   <td className="py-2 px-2 truncate text-gray-600" style={{ width: widths.groups, maxWidth: widths.groups, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={groupsStr}>{groupsStr || '—'}</td>
                   <td className="py-2 px-2 truncate" style={{ width: widths.linkStudents, maxWidth: widths.linkStudents, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                     {linkStr ? (
                       <a
                         href={linkStr.startsWith('http') ? linkStr : `https://${linkStr}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium text-xs"
                         onClick={ev => ev.stopPropagation()}
                       >
                         Для студентов <ExternalLink className="w-3 h-3" />
                       </a>
                     ) : <span className="text-gray-300">—</span>}
                   </td>
                   <td className="py-2 px-2 text-gray-500 truncate" style={{ width: widths.mailDate, maxWidth: widths.mailDate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mailDateStr}>{mailDateStr || '—'}</td>
                   <td className="py-2 px-2 text-gray-800 truncate" style={{ width: widths.host, maxWidth: widths.host, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hostStr}>{hostStr || '—'}</td>
                 </tr>
               );
             })}
             {paginatedData.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">Нет вебинаров</td></tr>}
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
        grandTotal={events.length}
      />
    </div>
  );
}

function WebinarsCalendarView({ events, onSelect }: { events: any[], onSelect: (e: any) => void }) {
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const monthGroups = useMemo(() => {
    const map = new Map<string, { label: string; key: string; events: any[] }>();
    
    // Sort events by date ascending
    const sorted = [...events].sort((a, b) => {
      const dA = toIsoDate(getWebinarField(a, 'date'));
      const dB = toIsoDate(getWebinarField(b, 'date'));
      return dA.localeCompare(dB);
    });

    sorted.forEach(e => {
      const iso = toIsoDate(getWebinarField(e, 'date'));
      if (!iso) return;
      const [year, month] = iso.split('-');
      if (!year || !month) return;

      const key = `${year}-${month}`;
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthName = d.toLocaleString('ru-RU', { month: 'long' });
      const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

      if (!map.has(key)) {
        map.set(key, { label, key, events: [] });
      }
      map.get(key)!.events.push(e);
    });

    return Array.from(map.values());
  }, [events]);

  const displayedGroups = useMemo(() => {
    if (monthFilter === 'all') return monthGroups;
    return monthGroups.filter(g => g.key === monthFilter);
  }, [monthGroups, monthFilter]);

  return (
    <div className="flex flex-col gap-6 h-full overflow-auto p-2">
      <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <CalendarIcon className="w-5 h-5 text-blue-600 shrink-0" />
        <span className="text-sm font-medium text-gray-700">Фильтр по месяцам:</span>
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Все месяцы ({events.length} вебинаров)</option>
          {monthGroups.map(g => (
            <option key={g.key} value={g.key}>{g.label} ({g.events.length})</option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {displayedGroups.map(g => (
          <div key={g.key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-bold text-base text-gray-800 border-b border-gray-100 pb-2 mb-4 flex justify-between items-center">
              <span>{g.label}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">{g.events.length} вебинаров</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.events.map(e => {
                const dateStr = formatDateDisplay(getWebinarField(e, 'date'));
                const timeStr = getWebinarField(e, 'time');
                const topicStr = getWebinarField(e, 'topic');
                const groupsStr = getWebinarField(e, 'groups');
                const linkStr = getWebinarField(e, 'linkStudents');
                const hostStr = getWebinarField(e, 'host');

                return (
                  <div
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className="border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all rounded-lg p-3 bg-gray-50/50 hover:bg-white cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="bg-blue-600 text-white font-semibold text-xs px-2 py-0.5 rounded">
                          {dateStr} {timeStr ? `в ${timeStr}` : ''}
                        </span>
                        {hostStr && (
                          <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium truncate max-w-[120px]">
                            {hostStr}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 mb-1 line-clamp-2">{topicStr || 'Без темы'}</h4>
                      {groupsStr && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2">Группы: {groupsStr}</p>
                      )}
                    </div>
                    {linkStr && (
                      <div className="pt-2 border-t border-gray-100 mt-2 flex justify-end">
                        <a
                          href={linkStr.startsWith('http') ? linkStr : `https://${linkStr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                          onClick={ev => ev.stopPropagation()}
                        >
                          Для студентов <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {displayedGroups.length === 0 && (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            Нет вебинаров в выбранный период
          </div>
        )}
      </div>
    </div>
  );
}

function EventPanel({ event, allRecords, onClose }: { event: any, allRecords: any[], onClose: () => void }) {
  const isNew = event._isNew;
  const [data, setData] = useState<any>(() => {
    if (isNew) {
      return {
        id: crypto.randomUUID(),
        date: '',
        time: '',
        topic: '',
        groups: '',
        linkStudents: '',
        host: '',
        mailDate: ''
      };
    }
    return {
      id: event.id,
      date: getWebinarField(event, 'date'),
      time: getWebinarField(event, 'time'),
      topic: getWebinarField(event, 'topic'),
      groups: getWebinarField(event, 'groups'),
      linkStudents: getWebinarField(event, 'linkStudents'),
      host: getWebinarField(event, 'host'),
      mailDate: getWebinarField(event, 'mailDate')
    };
  });

  const save = () => {
    const payload = {
      ...data,
      date: data.date || '',
      time: data.time || '',
      topic: data.topic || '',
      groups: data.groups || '',
      linkStudents: data.linkStudents || '',
      host: data.host || '',
      mailDate: data.mailDate || '',
      'Дата': formatDateDisplay(data.date),
      'Время': data.time || '',
      'Тема': data.topic || '',
      'Группы клиентов': data.groups || '',
      'Ссылка для студентов': data.linkStudents || '',
      'Ведущий': data.host || '',
      'Дата отправки письма': formatDateDisplay(data.mailDate)
    };

    if (isNew) createRecord('webinar_events', payload);
    else updateRecord('webinar_events', data.id, payload);
    onClose();
  };

  const del = async () => {
    if (confirm("Удалить вебинар?")) {
      await deleteRecord('webinar_events', data.id, data);
      onClose();
    }
  };

  const uniqueHosts = useMemo(() => {
    return Array.from(new Set(allRecords.map(r => getWebinarField(r, 'host')).filter(Boolean))).sort();
  }, [allRecords]);

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col z-10 absolute right-0 top-0 bottom-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">{isNew ? 'Новый вебинар' : 'Редактировать вебинар'}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Тема *</label>
          <textarea
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm h-20 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            placeholder="Тема вебинара"
            value={data.topic}
            onChange={e => setData({ ...data, topic: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Дата вебинара *</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={toIsoDate(data.date)}
            onChange={e => setData({ ...data, date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Время (напр. 17 UTC+3)</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="17 UTC+3"
            value={data.time}
            onChange={e => setData({ ...data, time: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Группы клиентов</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Группы клиентов"
            value={data.groups}
            onChange={e => setData({ ...data, groups: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ссылка для студентов</label>
          <input
            type="url"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="https://..."
            value={data.linkStudents}
            onChange={e => setData({ ...data, linkStudents: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ведущий</label>
          <input
            type="text"
            list="webinar-host-list"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Ведущий"
            value={data.host}
            onChange={e => setData({ ...data, host: e.target.value })}
          />
          <datalist id="webinar-host-list">
            {uniqueHosts.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Дата рассылки письма</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={toIsoDate(data.mailDate)}
            onChange={e => setData({ ...data, mailDate: e.target.value })}
          />
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between">
        {!isNew ? (
           <button onClick={del} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded text-sm flex items-center gap-1 font-medium"><Trash2 className="w-4 h-4"/> Удалить</button>
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
      createRecord('webinar_themes', { month, 'Месяц': month, topic: '', 'Тема': '' });
    }
  };

  return (
    <div className="w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col z-10 absolute right-0 top-0 bottom-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg">Темы месяцев</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {themes.map(t => {
          const mVal = t.month || t['Месяц'] || '';
          const tVal = t.topic || t['Тема'] || '';

          return (
            <div key={t.id} className="border border-gray-200 rounded-lg p-3 relative group bg-gray-50/70">
              <button 
                onClick={() => { if(confirm("Удалить тему?")) deleteRecord('webinar_themes', t.id, t); }} 
                className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
              <div className="mb-2">
                <label className="text-xs font-medium text-gray-500">Месяц</label>
                <input 
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white" 
                  value={mVal} 
                  onChange={e => updateRecord('webinar_themes', t.id, { month: e.target.value, 'Месяц': e.target.value })} 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Тема</label>
                <textarea 
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white h-16" 
                  value={tVal} 
                  onChange={e => updateRecord('webinar_themes', t.id, { topic: e.target.value, 'Тема': e.target.value })} 
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
        <button onClick={addTheme} className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded text-sm font-medium hover:bg-amber-200 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Добавить тему
        </button>
      </div>
    </div>
  );
}

