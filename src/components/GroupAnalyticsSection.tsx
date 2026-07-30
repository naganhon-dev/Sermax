import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Users, Calendar, Award, AlertTriangle, UserCheck } from 'lucide-react';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

interface GroupAnalyticsSectionProps {
  calls: any[];
  students: any[];
  allMentorsList: string[];
}

export default function GroupAnalyticsSection({
  calls,
  students,
  allMentorsList
}: GroupAnalyticsSectionProps) {
  const currentMonthNum = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [expandedMentors, setExpandedMentors] = useState<Record<string, boolean>>({});

  const toggleExpand = (mentor: string) => {
    setExpandedMentors(prev => ({
      ...prev,
      [mentor]: !prev[mentor]
    }));
  };

  // Student lookup map
  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    students.forEach(s => {
      const email = (s['Почта'] || s['почта'] || '').trim().toLowerCase();
      const fio = (s['ФИО'] || s['фио'] || '').trim().toLowerCase();
      if (email) map.set(email, s);
      if (fio) map.set(fio, s);
    });
    return map;
  }, [students]);

  // Compute analytics per mentor
  const analyticsData = useMemo(() => {
    const result: Record<string, {
      mentor: string;
      eventsCount: number;
      attendedStudentsCount: number;
      uniqueStudentsCount: number;
      attendedDetails: Array<{
        studentFio: string;
        studentEmail: string;
        eventTitle: string;
        eventDate: string;
        eventTime: string;
        initialGroup: string;
        initialPackage: string;
        hasChangedStream: boolean;
        currentGroup: string;
      }>;
    }> = {};

    allMentorsList.forEach(m => {
      result[m] = {
        mentor: m,
        eventsCount: 0,
        attendedStudentsCount: 0,
        uniqueStudentsCount: 0,
        attendedDetails: []
      };
    });

    // Process all group calls
    calls.forEach((c: any) => {
      // Check if call is a group event
      const isGroup = c.is_group === true || Array.isArray(c.participants);
      if (!isGroup) return;

      const cMonth = Number(c.Месяц) || (c.Дата ? (new Date(c.Дата.split('.').reverse().join('-')).getMonth() + 1) : 0);
      
      // Filter by selected month (if not 0/All)
      if (selectedMonth !== 0 && cMonth !== selectedMonth) return;

      const mentor = (c.Ментор || c['Ментор'] || '').trim();
      if (!mentor) return;

      if (!result[mentor]) {
        result[mentor] = {
          mentor,
          eventsCount: 0,
          attendedStudentsCount: 0,
          uniqueStudentsCount: 0,
          attendedDetails: []
        };
      }

      result[mentor].eventsCount += 1;

      const participants: any[] = c.participants || [];
      const uniqueStudentSet = new Set<string>();

      participants.forEach(p => {
        if (p.present === true) {
          const emailKey = (p.email || '').trim().toLowerCase();
          const fioKey = (p.fio || '').trim().toLowerCase();

          const currentStudent = studentMap.get(emailKey) || studentMap.get(fioKey);
          const currentGroup = currentStudent ? (currentStudent['Группа'] || currentStudent['группа'] || '').trim() : '';
          const currentPackage = currentStudent ? (currentStudent['Программа'] || currentStudent['Пакет'] || currentStudent['программа'] || currentStudent['пакет'] || '').trim() : '';

          const initialGroup = (p.initial_group || '').trim();
          const initialPackage = (p.initial_package || '').trim();

          const hasChangedStream = Boolean(
            currentStudent && (
              (initialGroup && currentGroup && initialGroup.toLowerCase() !== currentGroup.toLowerCase()) ||
              (initialPackage && currentPackage && initialPackage.toLowerCase() !== currentPackage.toLowerCase())
            )
          );

          result[mentor].attendedStudentsCount += 1;
          uniqueStudentSet.add(emailKey || fioKey);

          result[mentor].attendedDetails.push({
            studentFio: p.fio || 'Без имени',
            studentEmail: p.email || '',
            eventTitle: c.Тип || 'Групповой созвон',
            eventDate: c.Дата || '',
            eventTime: c.Время || '',
            initialGroup,
            initialPackage,
            hasChangedStream,
            currentGroup
          });
        }
      });

      result[mentor].uniqueStudentsCount += uniqueStudentSet.size;
    });

    return Object.values(result).sort((a, b) => b.attendedStudentsCount - a.attendedStudentsCount);
  }, [calls, selectedMonth, allMentorsList, studentMap]);

  return (
    <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="p-4 bg-indigo-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Award className="w-5 h-5 text-indigo-300" />
          <div>
            <h3 className="font-bold text-base leading-snug">Аналитика групповых событий по менторам</h3>
            <p className="text-xs text-indigo-200">
              Посещаемость групповых созвонов, выпускных и торговых дней
            </p>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-indigo-200 font-medium">Месяц:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-indigo-800 text-white border border-indigo-600 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
          >
            <option value={0}>За весь период</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics List */}
      <div className="divide-y divide-gray-200">
        {analyticsData.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            За выбранный период групповых событий не найдено.
          </div>
        ) : (
          analyticsData.map(item => {
            const isExpanded = !!expandedMentors[item.mentor];

            return (
              <div key={item.mentor} className="bg-white hover:bg-indigo-50/20 transition-colors">
                
                {/* Mentor Summary Row */}
                <div
                  onClick={() => toggleExpand(item.mentor)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-sm border border-indigo-200">
                      {item.mentor.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {item.mentor}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Проведено событий: <span className="font-semibold text-gray-800">{item.eventsCount}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-center">
                        <div className="font-extrabold text-sm leading-none text-emerald-700">{item.attendedStudentsCount}</div>
                        <div className="text-[10px] text-emerald-600 mt-0.5">студентов было</div>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-lg text-center">
                        <div className="font-extrabold text-sm leading-none text-indigo-700">{item.uniqueStudentsCount}</div>
                        <div className="text-[10px] text-indigo-600 mt-0.5">уникальных</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                      title="Раскрыть список студентов"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details List */}
                {isExpanded && (
                  <div className="bg-gray-50/80 border-t border-gray-200 p-4 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        Детальный список посещений по ментору "{item.mentor}" ({item.attendedDetails.length}):
                      </span>
                    </div>

                    {item.attendedDetails.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">
                        Студентов, посетивших события ментора в этом месяце, не зарегистрировано.
                      </p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">Студент</th>
                              <th className="py-2 px-3">Почта</th>
                              <th className="py-2 px-3">Группа (тогда)</th>
                              <th className="py-2 px-3">Событие</th>
                              <th className="py-2 px-3">Дата / Время</th>
                              <th className="py-2 px-3">Поток</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {item.attendedDetails.map((det, idx) => (
                              <tr key={`${det.studentEmail}-${det.eventDate}-${idx}`} className="hover:bg-gray-50">
                                <td className="py-1.5 px-3 text-gray-400 text-[10px] font-mono">{idx + 1}</td>
                                <td className="py-1.5 px-3 font-semibold text-gray-900">{det.studentFio}</td>
                                <td className="py-1.5 px-3 text-gray-500">{det.studentEmail || '—'}</td>
                                <td className="py-1.5 px-3 text-gray-700">{det.initialGroup || '—'}</td>
                                <td className="py-1.5 px-3">
                                  <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded font-medium text-[11px] border border-indigo-100">
                                    {det.eventTitle}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-gray-600">
                                  {det.eventDate} {det.eventTime ? `в ${det.eventTime}` : ''}
                                </td>
                                <td className="py-1.5 px-3">
                                  {det.hasChangedStream ? (
                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-300">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      Сменил поток, не засчитано
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium text-[10px]">
                                      ✓ Подтверждено
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
