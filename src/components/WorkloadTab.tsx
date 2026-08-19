import { useState, useMemo } from 'react';
import { useCollection } from '../lib/useCollection';
import { Users, Phone, Clock, FileText, Layers, Calendar, ChevronRight, Coins, ShieldAlert, AlertTriangle, Video } from 'lucide-react';
import { canonStatus } from '../lib/status';
import { ACTIVE_MENTORS, canonMentor } from '../lib/mentors';
import {
  parseDate,
  getStudentPlan,
  getCurrentMonth,
  getMonthlyPlan,
  countUsedCalls,
  getStudentDebtsWithSettlement,
  isMonthFrozen
} from '../lib/quota';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export default function WorkloadTab() {
  const { data: students } = useCollection('students');
  const { data: calls } = useCollection('calls');
  const { data: activities } = useCollection('activities');

  const [selectedMentor, setSelectedMentor] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // 1. Gather all unique mentors from students, calls, and activities
  const mentorsList = useMemo(() => {
    const mSet = new Set<string>();
    const safeStudents = Array.isArray(students) ? students : [];
    const safeCalls = Array.isArray(calls) ? calls : [];
    const safeActivities = Array.isArray(activities) ? activities : [];

    safeStudents.forEach((s: any) => {
      const m = s?.['Ментор'] || s?.['ментор'];
      if (m && typeof m === 'string' && m.trim()) {
        const canonical = canonMentor(m.trim());
        if (canonical) mSet.add(canonical);
      }
    });

    safeCalls.forEach((c: any) => {
      const m = c?.['Ментор'] || c?.['ментор'] || c?.['mentor'];
      if (m && typeof m === 'string' && m.trim()) {
        const canonical = canonMentor(m.trim());
        if (canonical) mSet.add(canonical);
      }
    });

    safeActivities.forEach((a: any) => {
      const m = a?.['Ментор'] || a?.['ментор'] || a?.['mentor'];
      if (m && typeof m === 'string' && m.trim()) {
        const canonical = canonMentor(m.trim());
        if (canonical) mSet.add(canonical);
      }
    });

    ACTIVE_MENTORS.forEach(m => mSet.add(m));

    return Array.from(mSet).filter(Boolean).sort();
  }, [students, calls, activities]);

  // Set default selected mentor to the first one in the list if empty
  const activeMentor = selectedMentor || mentorsList[0] || '';

  const isAmgMentor = useMemo(() => {
    if (!activeMentor) return false;
    const name = canonMentor(activeMentor).toLowerCase();
    return name === 'герчик' || name === 'амг';
  }, [activeMentor]);

  // Robust call month helper
  const getCallMonth = (c: any): number => {
    if (!c) return 0;

    try {
      // 1. Try parsing the call's date field
      const rawDate = c['Дата'] ?? c.date ?? c.created_at ?? c.createdAt ?? c['Дата созвона'];
      const parsed = parseDate(rawDate);
      if (parsed) {
        return parsed.getMonth() + 1; // 1-12
      }

      // 2. Direct string date fallback
      if (typeof rawDate === 'string' && rawDate.trim()) {
        const str = rawDate.trim();
        if (str.includes('.')) {
          const parts = str.split('.');
          const mNum = Number(parts[1]);
          if (mNum >= 1 && mNum <= 12) return mNum;
        } else if (str.includes('-')) {
          const parts = str.split('-');
          const mNum = Number(parts[1]);
          if (mNum >= 1 && mNum <= 12) return mNum;
        }
      }

      // 3. Fallback to direct 'Месяц' field if numeric 1-12
      const rawMonth = c['Месяц'] ?? c.month;
      if (rawMonth !== undefined && rawMonth !== null && rawMonth !== '') {
        const num = Number(rawMonth);
        if (!isNaN(num) && num >= 1 && num <= 12) {
          return num;
        }
      }
    } catch (e) {
      console.error('Error in getCallMonth:', e);
    }

    return 0;
  };

  // Helper to extract duration in minutes safely
  const getCallDurationMinutes = (c: any): number => {
    if (!c || typeof c !== 'object') return 0;
    try {
      const raw = c['Длительность мин'] ?? c['Длительность'] ?? c['длительность'] ?? c['Длительность, мин'] ?? c['Длительность (мин)'] ?? c.duration ?? c.duration_minutes ?? c.durationMinutes ?? c['Продолжительность'] ?? c['продолжительность'];
      if (raw !== undefined && raw !== null && raw !== '') {
        if (typeof raw === 'number' && !isNaN(raw)) return raw > 0 ? raw : 30;
        const str = String(raw).trim();
        const parsed = parseFloat(str.replace(/[^\d.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) {
      console.error('Error in getCallDurationMinutes:', e);
    }
    return 30; // Standard default call duration in minutes
  };

  // AMG statistics (only for mentor "Герчик" / "АМГ") based on real student quota/debts/calls
  const amgData = useMemo(() => {
    if (!isAmgMentor) return { amgSummary: null, amgStatsByMonth: [] };

    try {
      const safeStudents = Array.isArray(students) ? students : [];
      const safeCalls = Array.isArray(calls) ? calls : [];
      const currentYear = new Date().getFullYear();

      // 1. Total active (unsettled) Gerchik debts across ALL students in the system
      let activeGerchikDebtsTotal = 0;

      // 2. Total unique students related to Gerchik (plan, fact calls, or debts)
      const gerchikStudentsSet = new Set<string>();

      safeStudents.forEach((s: any) => {
        if (!s) return;
        if (canonStatus(s['Статус']) !== 'Учится') return;

        const studentId = String(s.id || s['Почта'] || s['ФИО'] || '').trim().toLowerCase();

        // 1. Debts with Gerchik
        const debts = getStudentDebtsWithSettlement(s, safeCalls) || [];
        const activeGerchikDebts = debts.filter(d => d.type === 'gerchik' && d.status !== 'settled');
        activeGerchikDebtsTotal += activeGerchikDebts.length;

        // 2. Current plan with Gerchik in student's current study month
        const currentStudyMonth = getCurrentMonth(s);
        let hasCurrentGerchikPlan = false;
        if (currentStudyMonth && currentStudyMonth >= 1 && !isMonthFrozen(s, currentStudyMonth)) {
          const { gerchikPlan } = getMonthlyPlan(s, currentStudyMonth);
          hasCurrentGerchikPlan = (gerchikPlan || 0) > 0;
        }

        const isCurrentlyRelatedToGerchik = hasCurrentGerchikPlan || activeGerchikDebts.length > 0;

        if (studentId && isCurrentlyRelatedToGerchik) {
          gerchikStudentsSet.add(studentId);
        }
      });

      const totalStudentsCount = gerchikStudentsSet.size;

      // 3. Selected month metrics
      const selectedMonthName = MONTH_NAMES[selectedMonth - 1] || MONTH_NAMES[0];
      const selectedMonthRefDate = new Date(currentYear, Math.max(0, selectedMonth - 1), 15);

      let selectedMonthPlanned = 0;
      safeStudents.forEach((s: any) => {
        if (!s || canonStatus(s['Статус']) !== 'Учится') return;
        const studyMonth = getCurrentMonth(s, selectedMonthRefDate);
        if (studyMonth && studyMonth >= 1 && !isMonthFrozen(s, studyMonth)) {
          const { gerchikPlan } = getMonthlyPlan(s, studyMonth);
          selectedMonthPlanned += (gerchikPlan || 0);
        }
      });

      // Conducted Gerchik calls in selectedMonth
      const selectedMonthConducted = safeCalls.filter((c: any) => {
        if (!c) return false;
        const m = canonMentor(c['Ментор'] || c['ментор'] || c.mentor || '');
        return m === 'Герчик' && getCallMonth(c) === selectedMonth;
      }).length;

      const selectedMonthUnclosed = Math.max(0, selectedMonthPlanned - selectedMonthConducted);

      const amgSummary = {
        totalDebts: activeGerchikDebtsTotal,
        totalStudentsCount,
        selectedMonthName,
        plan: selectedMonthPlanned,
        conducted: selectedMonthConducted,
        debts: selectedMonthUnclosed,
        isOverloaded: selectedMonthPlanned > 20
      };

      // 4. Monthly breakdown for all 12 months
      const amgStatsByMonth = MONTH_NAMES.map((monthName, idx) => {
        const mNum = idx + 1;
        const monthRefDate = new Date(currentYear, mNum - 1, 15);

        let planned = 0;
        const monthStudentsSet = new Set<string>();

        safeStudents.forEach((s: any) => {
          if (!s) return;
          const studentId = String(s.id || s['Почта'] || s['ФИО'] || '').trim().toLowerCase();

          if (canonStatus(s['Статус']) === 'Учится') {
            const studyMonth = getCurrentMonth(s, monthRefDate);
            if (studyMonth && studyMonth >= 1 && !isMonthFrozen(s, studyMonth)) {
              const { gerchikPlan } = getMonthlyPlan(s, studyMonth);
              if (gerchikPlan > 0) {
                planned += gerchikPlan;
                if (studentId) monthStudentsSet.add(studentId);
              }
            }
          }
        });

        const conducted = safeCalls.filter((c: any) => {
          if (!c) return false;
          const m = canonMentor(c['Ментор'] || c['ментор'] || c.mentor || '');
          if (m === 'Герчик' && getCallMonth(c) === mNum) {
            const studentId = String(c.student_id || c.studentId || c['Почта'] || c['ФИО'] || '').trim().toLowerCase();
            if (studentId) monthStudentsSet.add(studentId);
            return true;
          }
          return false;
        }).length;

        const unclosed = Math.max(0, planned - conducted);

        return {
          monthName,
          monthNum: mNum,
          studentsCount: monthStudentsSet.size,
          totalDebts: unclosed,
          plan: planned,
          conducted,
          debts: unclosed,
        };
      });

      return { amgSummary, amgStatsByMonth };
    } catch (err) {
      console.error('Error calculating AMG metrics:', err);
      return {
        amgSummary: {
          totalDebts: 0,
          totalStudentsCount: 0,
          selectedMonthName: MONTH_NAMES[selectedMonth - 1] || MONTH_NAMES[0],
          plan: 0,
          conducted: 0,
          debts: 0,
          isOverloaded: false
        },
        amgStatsByMonth: MONTH_NAMES.map((monthName, idx) => ({
          monthName,
          monthNum: idx + 1,
          studentsCount: 0,
          totalDebts: 0,
          plan: 0,
          conducted: 0,
          debts: 0
        }))
      };
    }
  }, [students, calls, isAmgMentor, selectedMonth]);

  const { amgSummary, amgStatsByMonth } = amgData;

  // 2. Metrics Calculations for Selected Month
  const isCurrentMonthSelected = selectedMonth === (new Date().getMonth() + 1);

  // Helper to check if a call record is a group call/event
  const isGroupCall = (c: any): boolean => {
    if (!c) return false;
    return (
      c.is_group === true ||
      c.isGroup === true ||
      c.is_group_event === true ||
      (Array.isArray(c.participants) && c.participants.length > 0)
    );
  };

  // Helper to check if an activity record is a call type (to exclude from "Прочие активности")
  const isCallActivity = (a: any): boolean => {
    if (!a) return false;
    const t = String(a['Тип активности'] || a['тип активности'] || a['Тип'] || a.type || '').trim().toLowerCase();
    return (
      t.includes('индивидуальный созвон') ||
      t.includes('групповой созвон') ||
      t === 'созвон'
    );
  };

  // Robust activity month helper
  const getMonthFromActivity = (a: any): number => {
    if (!a) return 0;
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

  const selectedMonthCalls = useMemo(() => {
    if (!activeMentor) return [];
    const target = canonMentor(activeMentor);
    const safeCalls = Array.isArray(calls) ? calls : [];
    return safeCalls.filter((c: any) => {
      const m = canonMentor(c?.['Ментор'] || c?.['ментор'] || c?.['mentor'] || '');
      if (m !== target) return false;
      const monthNum = getCallMonth(c);
      return monthNum === selectedMonth;
    });
  }, [calls, activeMentor, selectedMonth]);

  const selectedMonthIndCallsCount = useMemo(() => {
    return selectedMonthCalls.filter(c => !isGroupCall(c)).length;
  }, [selectedMonthCalls]);

  const selectedMonthGroupEventsCount = useMemo(() => {
    return selectedMonthCalls.filter(c => isGroupCall(c)).length;
  }, [selectedMonthCalls]);

  const selectedMonthOtherActivitiesCount = useMemo(() => {
    if (!activeMentor) return 0;
    const target = canonMentor(activeMentor);
    const safeActivities = Array.isArray(activities) ? activities : [];
    return safeActivities.reduce((acc, a: any) => {
      const m = canonMentor(a?.['Ментор'] || a?.['ментор'] || a?.['mentor'] || '');
      if (m !== target) return acc;
      if (isCallActivity(a)) return acc;
      if (getMonthFromActivity(a) !== selectedMonth) return acc;
      const count = Number(a?.['Кол-во'] || a?.['Кол-во активностей']) || 1;
      return acc + count;
    }, 0);
  }, [activities, activeMentor, selectedMonth]);

  const selectedMonthHours = useMemo(() => {
    const totalMinutes = selectedMonthCalls.reduce((acc, c) => {
      return acc + getCallDurationMinutes(c);
    }, 0);
    return Number((totalMinutes / 60).toFixed(1));
  }, [selectedMonthCalls]);

  const activeStudentsCount = useMemo(() => {
    if (!activeMentor) return 0;
    const target = canonMentor(activeMentor);
    const sSet = new Set<string>();
    const safeStudents = Array.isArray(students) ? students : [];

    selectedMonthCalls.forEach((c: any) => {
      const studentId = c?.student_id || c?.studentId || c?.['Почта'] || c?.email || c?.['ФИО'] || c?.fio;
      if (studentId) sSet.add(String(studentId).trim().toLowerCase());
    });

    if (isCurrentMonthSelected) {
      safeStudents.forEach((s: any) => {
        const m = canonMentor(s?.['Ментор'] || s?.['ментор'] || '');
        const status = canonStatus(s?.['Статус']);
        if (m === target && status.includes('Учится')) {
          const studentId = s?.id || s?.['Почта'] || s?.['ФИО'];
          if (studentId) sSet.add(String(studentId).trim().toLowerCase());
        }
      });
    }

    return sSet.size;
  }, [students, activeMentor, selectedMonthCalls, isCurrentMonthSelected]);

  const uniqueGroupsCount = useMemo(() => {
    if (!activeMentor) return 0;
    const target = canonMentor(activeMentor);
    const gSet = new Set<string>();
    const safeStudents = Array.isArray(students) ? students : [];

    selectedMonthCalls.forEach((c: any) => {
      const group = c?.['Группа'] || c?.['группа'] || '';
      if (group) gSet.add(String(group).trim());
    });

    if (isCurrentMonthSelected) {
      safeStudents.forEach((s: any) => {
        const m = canonMentor(s?.['Ментор'] || s?.['ментор'] || '');
        const group = s?.['Группа'] || s?.['группа'] || '';
        const status = canonStatus(s?.['Статус']);
        if (m === target && group && status.includes('Учится')) {
          gSet.add(String(group).trim());
        }
      });
    }

    return gSet.size;
  }, [students, activeMentor, selectedMonthCalls, isCurrentMonthSelected]);

  // 3. Monthly statistics: individual calls, group events, other activities, hours
  const monthlyStats = useMemo(() => {
    const stats = Array.from({ length: 12 }, (_, i) => ({
      monthNum: i + 1,
      monthName: MONTH_NAMES[i],
      indCallsCount: 0,
      groupEventsCount: 0,
      otherActivitiesCount: 0,
      hours: 0,
      mins: 0
    }));

    if (!activeMentor) return stats;
    const target = canonMentor(activeMentor);
    const safeCalls = Array.isArray(calls) ? calls : [];
    const safeActivities = Array.isArray(activities) ? activities : [];

    // Calls processing (individual vs group)
    safeCalls.forEach((c: any) => {
      const m = canonMentor(c?.['Ментор'] || c?.['ментор'] || c?.['mentor'] || '');
      if (m !== target) return;

      const monthNum = getCallMonth(c);
      if (monthNum >= 1 && monthNum <= 12) {
        if (isGroupCall(c)) {
          stats[monthNum - 1].groupEventsCount += 1;
        } else {
          stats[monthNum - 1].indCallsCount += 1;
        }
        stats[monthNum - 1].mins += getCallDurationMinutes(c);
      }
    });

    // Convert minutes to hours for each month
    stats.forEach(s => {
      s.hours = Number((s.mins / 60).toFixed(1));
    });

    // Activities processing (excluding individual and group calls)
    safeActivities.forEach((a: any) => {
      const m = canonMentor(a?.['Ментор'] || a?.['ментор'] || a?.['mentor'] || '');
      if (m !== target) return;
      if (isCallActivity(a)) return;

      const monthNum = getMonthFromActivity(a);
      if (monthNum >= 1 && monthNum <= 12) {
        const count = Number(a['Кол-во'] || a['Кол-во активностей']) || 1;
        stats[monthNum - 1].otherActivitiesCount += count;
      }
    });

    return stats;
  }, [calls, activities, activeMentor]);

  // 4. Educational program breakdown (all and active)
  const programBreakdown = useMemo(() => {
    if (!activeMentor) return [];
    const target = canonMentor(activeMentor);
    const counts: Record<string, { total: number; active: number }> = {};
    const safeStudents = Array.isArray(students) ? students : [];

    safeStudents.forEach((s: any) => {
      const m = canonMentor(s?.['Ментор'] || s?.['ментор'] || '');
      if (m !== target) return;

      const program = s?.['Пакет обучения'] || s?.['пакет обучения'] || 'Не указан';
      const isActive = canonStatus(s?.['Статус']).includes('Учится');

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
            {/* Header with selected mentor and Month Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{activeMentor}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Детализированный разрез занятости и учебных активностей</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500">Месяц:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {MONTH_NAMES.map((mName, idx) => {
                      const mNum = idx + 1;
                      const isCurrent = mNum === (new Date().getMonth() + 1);
                      return (
                        <option key={mNum} value={mNum}>
                          {mName} {isCurrent ? '(Текущий)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="hidden md:block px-3 py-1 bg-blue-50 text-blue-800 border border-blue-100 rounded-full text-xs font-semibold uppercase tracking-wider">
                  аналитика нагрузки
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Active Students Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    {isCurrentMonthSelected ? 'Студентов сейчас' : `Студентов (${MONTH_NAMES[selectedMonth - 1]})`}
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{activeStudentsCount}</p>
                  <p className="text-[10px] text-green-600 font-medium truncate mt-0.5">
                    {isCurrentMonthSelected ? 'со статусом "Учится"' : `созвоны в ${MONTH_NAMES[selectedMonth - 1]}`}
                  </p>
                </div>
              </div>

              {/* Individual Calls Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    Инд. созвоны
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{selectedMonthIndCallsCount}</p>
                  <p className="text-[10px] text-blue-600 font-medium truncate mt-0.5">
                    1-на-1 за {MONTH_NAMES[selectedMonth - 1]}
                  </p>
                </div>
              </div>

              {/* Group Events Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    Групповые события
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{selectedMonthGroupEventsCount}</p>
                  <p className="text-[10px] text-purple-600 font-medium truncate mt-0.5">
                    групповые за {MONTH_NAMES[selectedMonth - 1]}
                  </p>
                </div>
              </div>

              {/* Other Activities Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    Прочие активности
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{selectedMonthOtherActivitiesCount}</p>
                  <p className="text-[10px] text-indigo-600 font-medium truncate mt-0.5">
                    без созвонов за {MONTH_NAMES[selectedMonth - 1]}
                  </p>
                </div>
              </div>

              {/* Hours in Month Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    {isCurrentMonthSelected ? 'Часов в месяце' : `Часов (${MONTH_NAMES[selectedMonth - 1]})`}
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{selectedMonthHours} ч</p>
                  <p className="text-[10px] text-amber-600 font-medium truncate mt-0.5">
                    все созвоны за {MONTH_NAMES[selectedMonth - 1]}
                  </p>
                </div>
              </div>
            </div>

            {/* AMG Block (only for "Герчик" / "АМГ") */}
            {isAmgMentor && amgSummary && (
              <div id="amg-block" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Показатели АМГ</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Расчёт квот, фактически проведённых созвонов и долгов с Герчиком</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Эксклюзивные данные АМГ
                  </span>
                </div>

                {/* Overload Warning Banner if Month Plan > 20 */}
                {amgSummary.isOverloaded && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold">Внимание: Высокая нагрузка АМГ!</span>
                      <p className="mt-0.5 text-amber-700">
                        Плановое количество созвонов с Герчиком на {amgSummary.selectedMonthName.toLowerCase()} ({amgSummary.plan}) превышает исторический лимит в 20 созвонов в месяц.
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Незакрытые слоты АМГ (всего)</p>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">
                        {amgSummary.totalDebts.toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Всего записей студентов</p>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">{amgSummary.totalStudentsCount}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Слоты ({amgSummary.selectedMonthName})</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        Планово: <span className="text-slate-900 font-extrabold">{amgSummary.plan}</span> | Проведено: <span className="text-emerald-600 font-extrabold">{amgSummary.conducted}</span> | Незакрытые: <span className="text-red-600 font-extrabold">{amgSummary.debts}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monthly breakdown table */}
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Детализация АМГ по месяцам</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-4 text-slate-600 font-semibold">Месяц</th>
                          <th className="py-2 px-4 text-slate-600 font-semibold text-center">Студентов</th>
                          <th className="py-2 px-4 text-slate-600 font-semibold text-center">Проведено созвонов</th>
                          <th className="py-2 px-4 text-slate-600 font-semibold text-center">Слоты: Планово</th>
                          <th className="py-2 px-4 text-slate-600 font-semibold text-center">Слоты: Незакрытые</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {amgStatsByMonth.map((stat) => {
                          const isCurrent = stat.monthNum === selectedMonth;
                          return (
                            <tr key={stat.monthName} className={`hover:bg-slate-50/50 transition-colors ${isCurrent ? 'bg-indigo-50/30 font-medium' : ''}`}>
                              <td className="py-2 px-4 text-slate-700 flex items-center gap-1.5">
                                {stat.monthName}
                                {isCurrent && (
                                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-bold rounded">
                                    Выбран
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-center text-slate-800 font-semibold">
                                {stat.studentsCount > 0 ? stat.studentsCount : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-2 px-4 text-center text-emerald-700 font-semibold">
                                {stat.conducted > 0 ? stat.conducted : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-2 px-4 text-center text-slate-800 font-semibold">
                                {stat.plan > 0 ? stat.plan : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-2 px-4 text-center text-red-600 font-semibold">
                                {stat.debts > 0 ? stat.debts : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

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
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Инд. созвоны</th>
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Групповые</th>
                        <th className="py-3 px-4 font-semibold text-slate-600 text-center">Прочие активности</th>
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
                              {stat.indCallsCount > 0 ? stat.indCallsCount : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-center text-purple-700 font-semibold">
                              {stat.groupEventsCount > 0 ? stat.groupEventsCount : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-center text-indigo-700 font-semibold">
                              {stat.otherActivitiesCount > 0 ? stat.otherActivitiesCount : <span className="text-slate-300">—</span>}
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
