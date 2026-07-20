import { useState, useMemo, Fragment, FormEvent } from 'react';
import { useCollection, createRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, ChevronRight, ChevronDown, ChevronUp, Search, Calendar, Clock } from 'lucide-react';

function toText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (Array.isArray(v)) {
    return v.map(toText).join(', ');
  }
  if (typeof v === 'object') {
    return v.label ?? v.name ?? v.title ?? JSON.stringify(v);
  }
  return String(v);
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

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

const formatCallText = (c: any) => {
  const mentor = toText(c.Ментор) || 'Не указан';
  const duration = c['Длительность мин'] != null ? `${c['Длительность мин']} мин` : '';
  
  // Format date from YYYY-MM-DD or DD.MM.YYYY to DD.MM
  let dateStr = '';
  if (c.Дата) {
    const d = toText(c.Дата);
    if (d.includes('-')) {
      const parts = d.split('-');
      if (parts.length === 3) {
        dateStr = `${parts[2]}.${parts[1]}`;
      } else {
        dateStr = d;
      }
    } else if (d.includes('.')) {
      const parts = d.split('.');
      if (parts.length >= 2) {
        dateStr = `${parts[0]}.${parts[1]}`;
      } else {
        dateStr = d;
      }
    } else {
      dateStr = d;
    }
  }
  
  const timeStr = c.Время ? toText(c.Время) : '';
  
  const parts = [
    mentor,
    [dateStr, timeStr].filter(Boolean).join(' '),
    duration
  ].filter(Boolean);
  
  return parts.join(' · ');
};

export default function CallsTab() {
  const { data: calls } = useCollection('calls');
  const { data: students } = useCollection('students');

  const [activeType, setActiveType] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ student: any; month: number } | null>(null);

  // 1. Sidebar categories = unique values of 'Тип' field
  const uniqueTypes = useMemo(() => {
    const typesSet = new Set<string>();
    calls.forEach(c => {
      const val = toText(c.Тип).trim();
      if (val) typesSet.add(val);
    });
    const list = Array.from(typesSet).sort();
    if (list.length === 0) {
      list.push('Не указан');
    }
    return list;
  }, [calls]);

  const currentType = activeType || uniqueTypes[0] || 'Не указан';

  // 2. Map of student statuses for highlighting
  const studentStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach((s: any) => {
      const email = toText(s['Почта']).trim().toLowerCase();
      if (email) {
        map[email] = toText(s['Статус']).trim();
      }
    });
    return map;
  }, [students]);

  // Determine row style based on student status
  const getRowBgClass = (email: string) => {
    const status = studentStatuses[email.toLowerCase().trim()] || '';
    if (['Выпустился', 'Заморозка', 'Блокировка'].includes(status)) {
      return 'bg-amber-50/60 text-gray-500 hover:bg-amber-100/60 transition-colors';
    }
    return 'hover:bg-gray-50 transition-colors';
  };

  // Grouping students under active category
  const studentsInType = useMemo(() => {
    const studentMap = new Map<string, { 
      ФИО: string; 
      Почта: string; 
      Группа: string; 
      Секция: string; 
      calls: any[] 
    }>();
    
    calls.forEach(c => {
      const cType = toText(c.Тип).trim() || 'Не указан';
      if (cType !== currentType) return;
      
      const fio = toText(c.ФИО).trim();
      const email = toText(c.Почта).trim().toLowerCase();
      
      // Stable unique key for students
      const key = `${email || 'no-email'}::${fio || 'no-fio'}`;
      
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          ФИО: fio || 'Не указано',
          Почта: email,
          Группа: toText(c.Группа),
          Секция: toText(c.Секция),
          calls: []
        });
      }
      
      const student = studentMap.get(key)!;
      student.calls.push(c);
      
      if (c.Группа && !student.Группа) student.Группа = toText(c.Группа);
      if (c.Секция && !student.Секция) student.Секция = toText(c.Секция);
    });
    
    return Array.from(studentMap.values());
  }, [calls, currentType]);

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    if (!search) return studentsInType;
    const q = search.toLowerCase();
    return studentsInType.filter(st => 
      st.ФИО.toLowerCase().includes(q) || 
      st.Почта.toLowerCase().includes(q) ||
      st.Группа.toLowerCase().includes(q) ||
      st.Секция.toLowerCase().includes(q)
    );
  }, [studentsInType, search]);

  // Group visible students by 'Группа/Секция'
  const groupedStudents = useMemo(() => {
    const groups: Record<string, typeof filteredStudents> = {};
    filteredStudents.forEach(st => {
      const gr = st.Секция || st.Группа || 'Без группы/секции';
      if (!groups[gr]) groups[gr] = [];
      groups[gr].push(st);
    });
    return groups;
  }, [filteredStudents]);

  const groupKeys = useMemo(() => Object.keys(groupedStudents).sort(), [groupedStudents]);

  // Visible calls based on the filtered list of students
  const visibleCalls = useMemo(() => {
    const list: any[] = [];
    filteredStudents.forEach(st => {
      list.push(...st.calls);
    });
    return list;
  }, [filteredStudents]);

  // Mentor statistics calculation from displayed records
  const mentorStats = useMemo(() => {
    const stats: Record<string, {
      totalCount: number;
      totalDuration: number;
      monthly: Record<number, { count: number; duration: number }>
    }> = {};
    
    visibleCalls.forEach(c => {
      const mentor = toText(c.Ментор).trim() || 'Не указан';
      const month = Number(c.Месяц) || 0;
      const duration = Number(c['Длительность мин']) || 0;
      
      if (!stats[mentor]) {
        stats[mentor] = {
          totalCount: 0,
          totalDuration: 0,
          monthly: {}
        };
        for (let m = 1; m <= 12; m++) {
          stats[mentor].monthly[m] = { count: 0, duration: 0 };
        }
      }
      
      stats[mentor].totalCount += 1;
      stats[mentor].totalDuration += duration;
      
      if (month >= 1 && month <= 12) {
        stats[mentor].monthly[month].count += 1;
        stats[mentor].monthly[month].duration += duration;
      }
    });
    
    return stats;
  }, [visibleCalls]);

  const sortedMentors = useMemo(() => Object.keys(mentorStats).sort(), [mentorStats]);

  const averageDuration = (duration: number, count: number) => {
    if (!count) return '—';
    return `${Math.round(duration / count)} мин`;
  };

  return (
    <div className="flex h-full bg-white font-sans">
      {/* Left Sidebar Categories */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-100">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Типы созвонов</div>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {uniqueTypes.map(t => (
            <button
              key={t}
              onClick={() => {
                setActiveType(t);
                setSelectedCell(null);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-all ${
                currentType === t 
                  ? 'bg-blue-600 text-white font-medium shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="truncate pr-2">{t}</span>
              {currentType === t && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header bar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{currentType}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Всего студентов: {filteredStudents.length} · Всего созвонов: {visibleCalls.length}
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                placeholder="Поиск по ФИО, почте, группе..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 w-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          
          {/* Collapsible Mentor Stats Summary */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowSummary(!showSummary)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                Сводка по менторам ({sortedMentors.length})
              </span>
              {showSummary ? <ChevronUp className="w-4 h-4 text-gray-500"/> : <ChevronDown className="w-4 h-4 text-gray-500"/>}
            </button>
            {showSummary && (
              <div className="overflow-x-auto max-h-60">
                {sortedMentors.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Нет записей по менторам в этой выборке</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 border-r border-gray-200 font-semibold text-gray-600 min-w-[120px]">Ментор</th>
                        {MONTHS.map(m => (
                          <th key={m} className="py-2 px-2 text-center border-r border-gray-200 font-semibold text-gray-600 min-w-[70px]">{m}</th>
                        ))}
                        <th className="py-2 px-3 text-center font-semibold text-gray-600 bg-gray-100 min-w-[100px]">Всего (кол-во / мин)</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-600 bg-gray-100 min-w-[90px]">Ср. длит.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMentors.map(mentor => {
                        const st = mentorStats[mentor];
                        return (
                          <tr key={mentor} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium border-r border-gray-200 sticky left-0 bg-white z-10 text-gray-800">{mentor}</td>
                            {MONTHS.map((_, idx) => {
                              const mIdx = idx + 1;
                              const mStat = st.monthly[mIdx];
                              return (
                                <td key={idx} className="py-2 px-2 text-center border-r border-gray-200 text-gray-700">
                                  {mStat.count > 0 ? (
                                    <span>
                                      <span className="font-semibold text-blue-900">{mStat.count}</span>
                                      <span className="text-gray-400 font-light mx-0.5">/</span>
                                      <span className="text-gray-600">{mStat.duration}м</span>
                                    </span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-center bg-gray-50 font-bold text-gray-800 border-r border-gray-200">
                              {st.totalCount} <span className="text-gray-400 font-light">/</span> {st.totalDuration}м
                            </td>
                            <td className="py-2 px-3 text-center bg-gray-50 font-medium text-gray-600">
                              {averageDuration(st.totalDuration, st.totalCount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Student Matrix Grid Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 border-r border-gray-200 font-semibold text-gray-700 min-w-[220px]">Студент (ФИО / Почта)</th>
                    {MONTHS.map(m => (
                      <th key={m} className="py-3 px-2 text-center border-r border-gray-200 font-semibold text-gray-700 min-w-[110px]">{m}</th>
                    ))}
                    <th className="py-3 px-4 text-center bg-gray-100 font-semibold text-gray-700 min-w-[100px]">Итог за год</th>
                  </tr>
                </thead>
                <tbody>
                  {groupKeys.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-gray-400 bg-gray-50">
                        Нет записей по созвонам
                      </td>
                    </tr>
                  ) : (
                    groupKeys.map(groupName => {
                      const groupStudents = groupedStudents[groupName];
                      return (
                        <Fragment key={groupName}>
                          {/* Visual Section Group Title Row */}
                          <tr className="bg-slate-100/80 border-y border-gray-200">
                            <td colSpan={14} className="py-1.5 px-4 font-bold text-xs text-slate-700 uppercase tracking-wider">
                              Группа / Секция: {groupName} ({groupStudents.length})
                            </td>
                          </tr>
                          
                          {groupStudents.map(st => {
                            let yCount = 0;
                            let yMins = 0;
                            
                            st.calls.forEach(c => {
                              yCount += 1;
                              yMins += Number(c['Длительность мин']) || 0;
                            });
                            
                            return (
                              <tr key={`${st.Почта}::${st.ФИО}`} className={`border-b border-gray-200 ${getRowBgClass(st.Почта)}`}>
                                <td className="py-2.5 px-4 border-r border-gray-200 font-medium">
                                  <div className="font-semibold text-gray-900 leading-tight">{st.ФИО}</div>
                                  <div className="text-xs text-gray-500 font-normal mt-0.5">{st.Почта || 'Почта не указана'}</div>
                                </td>
                                
                                {MONTHS.map((_, idx) => {
                                  const mIdx = idx + 1;
                                  const mCalls = st.calls.filter(c => Number(c.Месяц) === mIdx);
                                  
                                  return (
                                    <td 
                                      key={idx} 
                                      onClick={() => setSelectedCell({ student: st, month: mIdx })}
                                      className="py-2 px-2 border-r border-gray-200 text-center cursor-pointer hover:bg-blue-50/50 transition-colors align-top"
                                    >
                                      {mCalls.length > 0 ? (
                                        <div className="flex flex-col gap-1 text-[10px] text-left">
                                          {mCalls.map(c => (
                                            <div 
                                              key={c.id} 
                                              className="bg-blue-50 text-blue-900 border border-blue-100 rounded px-1.5 py-0.5 leading-snug break-words font-medium hover:bg-blue-100 transition-colors"
                                              title={`Дата: ${c.Дата || '—'} · Время: ${c.Время || '—'} · Длительность: ${c['Длительность мин'] || 0} мин`}
                                            >
                                              {formatCallText(c)}
                                            </div>
                                          ))}
                                        </div>
                                      ) : <span className="text-gray-300 select-none text-xs">—</span>}
                                    </td>
                                  );
                                })}
                                
                                <td className="py-2.5 px-4 bg-gray-50 text-center">
                                  {yCount > 0 ? (
                                    <div className="text-xs">
                                      <div className="font-bold text-gray-800">{yCount} созв.</div>
                                      <div className="text-gray-600 mt-0.5 font-medium">{yMins} мин</div>
                                      <div className="text-[10px] text-gray-500 italic mt-0.5">ср. {Math.round(yMins / yCount)}м</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Right popover panel */}
      {selectedCell && (
        <CellPopover 
          student={selectedCell.student} 
          month={selectedCell.month}
          currentType={currentType}
          calls={calls}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}

interface CellPopoverProps {
  student: any;
  month: number;
  currentType: string;
  calls: any[];
  onClose: () => void;
}

function CellPopover({ student, month, currentType, calls, onClose }: CellPopoverProps) {
  const monthName = MONTHS[month - 1];
  
  // Filter current calls for this student in this month
  const studentCallsInMonth = useMemo(() => {
    return student.calls.filter((c: any) => Number(c.Месяц) === month);
  }, [student, month]);

  // Form states
  const [newMentor, setNewMentor] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState('15');
  const [newNote, setNewNote] = useState('');

  // Collect unique mentors for datalist from ALL calls
  const allMentors = useMemo(() => {
    const set = new Set<string>();
    calls.forEach(c => {
      const val = toText(c.Ментор).trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [calls]);

  const handleAddCall = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMentor.trim()) {
      alert("Пожалуйста, укажите ментора");
      return;
    }
    
    const newRecord = {
      Почта: student.Почта,
      ФИО: student.ФИО,
      Месяц: month,
      Тип: currentType,
      Секция: student.Секция,
      Группа: student.Группа,
      Ментор: newMentor.trim(),
      Дата: fromDateInput(newDate),
      Время: newTime,
      "Длительность мин": Number(newDuration) || 0,
      Примечание: newNote.trim(),
      Источник: 'Вручную'
    };

    await createRecord('calls', newRecord);
    
    // Reset form fields
    setNewMentor('');
    setNewDate('');
    setNewTime('');
    setNewDuration('15');
    setNewNote('');
  };

  const handleDeleteCall = async (c: any) => {
    if (confirm("Вы действительно хотите удалить это событие созвона?")) {
      await deleteRecord('calls', c.id, c);
    }
  };


  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
        <div>
          <h3 className="font-bold text-gray-900 truncate max-w-[280px]">{student.ФИО}</h3>
          <p className="text-xs text-blue-600 font-medium mt-0.5">{monthName} (Созвоны)</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-colors focus:outline-none">
          <X className="w-5 h-5"/>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Call List */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Список созвонов ({studentCallsInMonth.length})
          </h4>
          
          {studentCallsInMonth.length === 0 ? (
            <div className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-200">
              В этом месяце созвонов нет
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {studentCallsInMonth.map((c: any) => (
                <div key={c.id} className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex justify-between items-start gap-2 relative group hover:bg-blue-50 hover:border-blue-200 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-blue-900 flex items-center gap-1">
                      <span>{toText(c.Ментор) || 'Не указан'}</span>
                      {c.Источник && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 rounded px-1.5 font-normal select-none">
                          {toText(c.Источник)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                      <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded flex items-center gap-1 text-[11px]">
                        <Calendar className="w-2.5 h-2.5 text-gray-500" />
                        {c.Дата ? toText(c.Дата) : '—'}
                      </span>
                      {c.Время && (
                        <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded flex items-center gap-1 text-[11px]">
                          <Clock className="w-2.5 h-2.5 text-gray-500" />
                          {toText(c.Zeit || c.Время)}
                        </span>
                      )}
                      {c['Длительность мин'] != null && (
                        <span className="bg-white/80 border border-gray-200 px-1 py-0.5 rounded text-[11px] font-medium text-gray-700">
                          {c['Длительность мин']} мин
                        </span>
                      )}
                    </div>
                    {c.Примечание && (
                      <div className="text-xs text-gray-500 mt-2 bg-white/60 border border-gray-100 rounded-md p-1.5 italic whitespace-pre-wrap">
                        {toText(c.Примечание)}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDeleteCall(c)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 focus:outline-none"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Event Form */}
        <div className="border-t border-gray-150 pt-5">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Добавить новый созвон
          </h4>
          
          <form onSubmit={handleAddCall} className="flex flex-col gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ментор *</label>
              <input 
                list="popover-mentors"
                placeholder="Имя ментора"
                value={newMentor}
                onChange={e => setNewMentor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
              <datalist id="popover-mentors">
                {allMentors.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
                <input 
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Время</label>
                <input 
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Длительность (мин)</label>
              <input 
                type="number"
                min="0"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Примечание / Комментарий</label>
              <textarea 
                rows={3}
                placeholder="Краткое описание созвона..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>

            <button 
              type="submit"
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm text-center text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Добавить созвон
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
