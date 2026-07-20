import { useState, useMemo } from 'react';
import { useCollection } from '../lib/useCollection';
import { Users, Phone, Clock, FileText, Layers, Calendar, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export default function WorkloadTab() {
  const { data: students } = useCollection('students');
  const { data: calls } = useCollection('calls');
  const { data: activities } = useCollection('activities');

  const [selectedMentor, setSelectedMentor] = useState<string>('');

  // 1. Gather all unique mentors from students, calls, and activities
  const mentorsList = useMemo(() => {
    const mSet = new Set<string>();

    students.forEach((s: any) => {
      const m = s['Ментор'] || s['ментор'];
      if (m && typeof m === 'string' && m.trim()) {
        mSet.add(m.trim());
      }
    });

    calls.forEach((c: any) => {
      const m = c['Ментор'] || c['ментор'] || c['mentor'];
      if (m && typeof m === 'string' && m.trim()) {
        mSet.add(m.trim());
      }
    });

    activities.forEach((a: any) => {
      const m = a['Ментор'] || a['ментор'] || a['mentor'];
      if (m && typeof m === 'string' && m.trim()) {
        mSet.add(m.trim());
      }
    });

    return Array.from(mSet).sort();
  }, [students, calls, activities]);

  // Set default selected mentor to the first one in the list if empty
  const activeMentor = selectedMentor || mentorsList[0] || '';

  // 2. Metrics Calculations
  const activeStudentsCount = useMemo(() => {
    if (!activeMentor) return 0;
    return students.filter((s: any) => {
      const m = (s['Ментор'] || s['ментор'] || '').trim();
      const status = s['Статус'] || '';
      return m === activeMentor && status.includes('Учится');
    }).length;
  }, [students, activeMentor]);

  const uniqueGroupsCount = useMemo(() => {
    if (!activeMentor) return 0;
    const gSet = new Set<string>();
    
    students.forEach((s: any) => {
      const m = (s['Ментор'] || s['ментор'] || '').trim();
      const group = s['Группа'] || s['группа'] || '';
      if (m === activeMentor && group) {
        gSet.add(group);
      }
    });

    calls.forEach((c: any) => {
      const m = (c['Ментор'] || c['ментор'] || c['mentor'] || '').trim();
      const group = c['Группа'] || c['группа'] || '';
      if (m === activeMentor && group) {
        gSet.add(group);
      }
    });

    return gSet.size;
  }, [students, calls, activeMentor]);

  const currentMonthCallsCount = useMemo(() => {
    if (!activeMentor) return 0;
    const currentMonthNum = new Date().getMonth() + 1; // 1-12
    return calls.filter((c: any) => {
      const m = (c['Ментор'] || c['ментор'] || c['mentor'] || '').trim();
      const monthNum = Number(c['Месяц']) || 0;
      return m === activeMentor && monthNum === currentMonthNum;
    }).length;
  }, [calls, activeMentor]);

  const currentMonthHours = useMemo(() => {
    if (!activeMentor) return 0;
    const currentMonthNum = new Date().getMonth() + 1; // 1-12
    const currentCalls = calls.filter((c: any) => {
      const m = (c['Ментор'] || c['ментор'] || c['mentor'] || '').trim();
      const monthNum = Number(c['Месяц']) || 0;
      return m === activeMentor && monthNum === currentMonthNum;
    });
    
    const totalMinutes = currentCalls.reduce((acc, c) => {
      return acc + (Number(c['Длительность мин']) || 0);
    }, 0);

    return Number((totalMinutes / 60).toFixed(1));
  }, [calls, activeMentor]);

  // Robust activity month helper
  const getMonthFromActivity = (a: any): number => {
    const dateStr = a['Дата проведения'] || a['date'] || '';
    if (dateStr) {
      const parts = dateStr.includes('.') ? dateStr.split('.') : dateStr.split('-');
      if (dateStr.includes('.')) {
        const monthNum = Number(parts[1]);
        if (monthNum >= 1 && monthNum <= 12) return monthNum;
      } else if (dateStr.includes('-')) {
        const monthNum = Number(parts[1]);
        if (monthNum >= 1 && monthNum <= 12) return monthNum;
      }
    }

    const period = a['Период'] || '';
    if (period) {
      for (let i = 0; i < 12; i++) {
        if (period.toLowerCase().includes(MONTH_NAMES[i].toLowerCase())) {
          return i + 1;
        }
      }
      const num = parseFloat(period);
      if (num >= 1 && num <= 12) return Math.floor(num);
    }
    return 0;
  };

  // 3. Monthly statistics: calls, activities, hours
  const monthlyStats = useMemo(() => {
    const stats = Array.from({ length: 12 }, (_, i) => ({
      monthNum: i + 1,
      monthName: MONTH_NAMES[i],
      callsCount: 0,
      activitiesCount: 0,
      hours: 0,
      mins: 0
    }));

    if (!activeMentor) return stats;

    // Calls processing
    calls.forEach((c: any) => {
      const m = (c['Ментор'] || c['ментор'] || c['mentor'] || '').trim();
      if (m !== activeMentor) return;

      const monthNum = Number(c['Месяц']) || 0;
      if (monthNum >= 1 && monthNum <= 12) {
        stats[monthNum - 1].callsCount += 1;
        stats[monthNum - 1].mins += Number(c['Длительность мин']) || 0;
      }
    });

    // Convert minutes to hours for each month
    stats.forEach(s => {
      s.hours = Number((s.mins / 60).toFixed(1));
    });

    // Activities processing
    activities.forEach((a: any) => {
      const m = (a['Ментор'] || a['ментор'] || a['mentor'] || '').trim();
      if (m !== activeMentor) return;

      const monthNum = getMonthFromActivity(a);
      if (monthNum >= 1 && monthNum <= 12) {
        const count = Number(a['Кол-во'] || a['Кол-во активностей']) || 1;
        stats[monthNum - 1].activitiesCount += count;
      }
    });

    return stats;
  }, [calls, activities, activeMentor]);

  // 4. Educational program breakdown (all and active)
  const programBreakdown = useMemo(() => {
    if (!activeMentor) return [];
    const counts: Record<string, { total: number; active: number }> = {};

    students.forEach((s: any) => {
      const m = (s['Ментор'] || s['ментор'] || '').trim();
      if (m !== activeMentor) return;

      const program = s['Пакет обучения'] || s['пакет обучения'] || 'Не указан';
      const isActive = (s['Статус'] || '').includes('Учится');

      if (!counts[program]) {
        counts[program] = { total: 0, active: 0 };
      }
      counts[program].total += 1;
      if (isActive) {
        counts[program].active += 1;
      }
    });

    return Object.entries(counts).map(([name, stat]) => ({
      name,
      ...stat
    })).sort((a, b) => b.total - a.total);
  }, [students, activeMentor]);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar - Mentors list */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Менторы ({mentorsList.length})</h2>
          <p className="text-xs text-slate-500 mt-1">Выберите ментора для просмотра нагрузки</p>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {mentorsList.map(mentor => (
            <button
              key={mentor}
              onClick={() => setSelectedMentor(mentor)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-between group ${
                activeMentor === mentor
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <span className="truncate">{mentor}</span>
              <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${activeMentor === mentor ? 'translate-x-0.5 text-blue-500' : ''}`} />
            </button>
          ))}
          {mentorsList.length === 0 && (
            <div className="p-4 text-center text-slate-400 text-xs">
              Нет данных о менторах
            </div>
          )}
        </div>
      </div>

      {/* Main content pane */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {activeMentor ? (
          <>
            {/* Header with selected mentor */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{activeMentor}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Детализированный разрез занятости и учебных активностей</p>
              </div>
              <div className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-100 rounded-full text-xs font-semibold uppercase tracking-wider">
                аналитика нагрузки
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Active Students Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Студентов сейчас</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{activeStudentsCount}</p>
                  <p className="text-[10px] text-green-600 font-medium mt-0.5">со статусом "Учится"</p>
                </div>
              </div>

              {/* Unique Groups Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Активных групп</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{uniqueGroupsCount}</p>
                  <p className="text-[10px] text-purple-600 font-medium mt-0.5">из записей и созвонов</p>
                </div>
              </div>

              {/* Current Month Calls */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Созвонов в этом месяце</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{currentMonthCallsCount}</p>
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">текущий календарный месяц</p>
                </div>
              </div>

              {/* Hours in Current Month */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Часов в этом месяце</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{currentMonthHours} ч</p>
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">суммарно за созвоны</p>
                </div>
              </div>
            </div>

            {/* Monthly Analytics & Programs Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly stats table (2/3 width on desktop) */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Разрез по месяцам (1-12)</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Январь - Декабрь</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-semibold text-slate-600">Месяц</th>
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Созвоны</th>
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Активности</th>
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Длительность</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyStats.map(stat => {
                        const isCurrentMonth = stat.monthNum === (new Date().getMonth() + 1);
                        return (
                          <tr key={stat.monthNum} className={`hover:bg-slate-50/50 transition-colors ${isCurrentMonth ? 'bg-blue-50/30' : ''}`}>
                            <td className="py-2.5 px-4 font-medium text-slate-700 flex items-center gap-2">
                              {stat.monthName}
                              {isCurrentMonth && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">
                                  Текущий
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-800 font-semibold">
                              {stat.callsCount > 0 ? stat.callsCount : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-800 font-semibold">
                              {stat.activitiesCount > 0 ? stat.activitiesCount : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-800 font-semibold">
                              {stat.hours > 0 ? `${stat.hours} ч` : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Educational Programs breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">По программам (пакетам)</h3>
                </div>

                <div className="flex-1 p-4 space-y-3 overflow-auto max-h-[480px]">
                  {programBreakdown.map((prog, idx) => (
                    <div key={prog.name} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-xs text-slate-800 truncate" title={prog.name}>
                          {prog.name}
                        </span>
                        <span className="text-xs font-bold text-slate-500 shrink-0 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                        <div className="bg-white border border-slate-200/60 p-1.5 rounded-md shadow-sm">
                          <p className="text-[10px] text-slate-400 font-medium uppercase">Всего студентов</p>
                          <p className="text-sm font-bold text-slate-700 mt-0.5">{prog.total}</p>
                        </div>
                        <div className="bg-white border border-slate-200/60 p-1.5 rounded-md shadow-sm">
                          <p className="text-[10px] text-green-500 font-medium uppercase">Активных ("Учится")</p>
                          <p className="text-sm font-bold text-green-600 mt-0.5">{prog.active}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {programBreakdown.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Нет распределения по учебным программам
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
            <Users className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-base font-semibold">Менторы не найдены</p>
            <p className="text-xs text-slate-400 mt-1">Добавьте менторов в студентов или созвоны, чтобы отобразить нагрузку</p>
          </div>
        )}
      </div>
    </div>
  );
}
