import { useState, useMemo } from 'react';
import { useCollection } from '../lib/useCollection';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { usePagination } from '../lib/usePagination';
import Pagination from './Pagination';

export default function LogsTab() {
  const { data: rawLogs, loading } = useCollection<any>('logs');

  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const [authorFilter, setAuthorFilter] = useState('all');

  // Unique authors
  const authors = useMemo(() => {
    const set = new Set<string>();
    rawLogs.forEach(l => {
      if (l.author) set.add(l.author);
    });
    return Array.from(set).sort();
  }, [rawLogs]);

  // Unique students
  const students = useMemo(() => {
    const set = new Set<string>();
    rawLogs.forEach(l => {
      if (l.studentFio) set.add(l.studentFio);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [rawLogs]);

  // Filter & Sort logs (fresh ones on top)
  const filteredLogs = useMemo(() => {
    let result = [...rawLogs];

    // Sort by timestamp desc
    result.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    if (studentFilter !== 'all') {
      result = result.filter(l => l.studentFio === studentFilter);
    }

    if (authorFilter !== 'all') {
      result = result.filter(l => l.author === authorFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(l => {
        const fioMatch = String(l.studentFio || '').toLowerCase().includes(q);
        const authorMatch = String(l.author || '').toLowerCase().includes(q);
        const changesMatch = Array.isArray(l.changes) && l.changes.some((c: any) => 
          String(c.field || '').toLowerCase().includes(q) ||
          String(c.oldValue || '').toLowerCase().includes(q) ||
          String(c.newValue || '').toLowerCase().includes(q)
        );
        return fioMatch || authorMatch || changesMatch;
      });
    }

    return result;
  }, [rawLogs, studentFilter, authorFilter, search]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    startIndex,
    endIndex,
    totalItems
  } = usePagination(filteredLogs, [studentFilter, authorFilter, search], 'logs_page_size');

  const formatDateTime = (ts: string) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Загрузка логов...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Логи изменений карточек студентов</h2>
          <p className="text-xs text-gray-500">Показано записей: {filteredLogs.length}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Author filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span>Автор:</span>
            <select
              className="border border-gray-300 rounded px-2.5 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[180px] truncate"
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
            >
              <option value="all">Все авторы ({authors.length})</option>
              {authors.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Student filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>Студент:</span>
            <select
              className="border border-gray-300 rounded px-2.5 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[200px] truncate"
              value={studentFilter}
              onChange={e => setStudentFilter(e.target.value)}
            >
              <option value="all">Все студенты ({students.length})</option>
              {students.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по логам..."
              className="pl-8 pr-6 py-1 border border-gray-300 rounded text-xs w-60 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="py-2.5 px-4 w-44">Дата / Время</th>
              <th className="py-2.5 px-4 w-48">Кто изменил</th>
              <th className="py-2.5 px-4 w-52">Студент</th>
              <th className="py-2.5 px-4">Что изменилось (Поле: Было → Стало)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-400 italic">
                  История изменений пуста или ничего не найдено по фильтрам
                </td>
              </tr>
            ) : (
              paginatedData.map((log: any) => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 align-top text-gray-500 font-mono text-[11px] whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="py-3 px-4 align-top font-medium text-gray-800">
                    {log.author || '—'}
                  </td>
                  <td className="py-3 px-4 align-top font-semibold text-slate-900">
                    {log.studentFio || '—'}
                  </td>
                  <td className="py-3 px-4 align-top">
                    {Array.isArray(log.changes) && log.changes.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {log.changes.map((ch: any, idx: number) => (
                          <div key={idx} className="flex flex-wrap items-baseline gap-1.5 bg-gray-50 p-1.5 rounded border border-gray-100">
                            <span className="font-semibold text-gray-700 bg-gray-200/80 px-1.5 py-0.5 rounded text-[11px]">
                              {ch.field}:
                            </span>
                            <span className="text-red-700 line-through max-w-xs truncate" title={ch.oldValue}>
                              {ch.oldValue || '—'}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-700 font-medium max-w-md truncate" title={ch.newValue}>
                              {ch.newValue || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Нет деталей изменений</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
        grandTotal={filteredLogs.length}
      />
    </div>
  );
}
