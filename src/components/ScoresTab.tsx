import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, Filter, ExternalLink, Calendar, User, Layers, Award, Star, Search, Check, Info } from 'lucide-react';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function ScoresTab() {
  const [subTab, setSubTab] = useState('call_scores'); // call_scores, os_reviews

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 shadow-sm shrink-0">
        {[
          { id: 'call_scores', label: 'Оценки созвонов' },
          { id: 'os_reviews', label: 'ОС менторов' },
        ].map(t => (
          <button
            key={t.id}
            id={`subtab-btn-${t.id}`}
            onClick={() => setSubTab(t.id)}
            className={`px-5 py-3 border-b-2 font-semibold text-sm transition-all duration-150 ${
              subTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contents wrapper */}
      <div className="flex-1 overflow-hidden relative">
        {subTab === 'call_scores' && <CallScoresView />}
        {subTab === 'os_reviews' && <OsReviewsView />}
      </div>
    </div>
  );
}

// ==========================================
// UTILS & HELPER FUNCTIONS
// ==========================================

const CRITERIA_CALLS = [
  'Оценка орг',
  'Вид',
  'Подготовка техническая',
  'Вовлечённость',
  'Объяснение',
  'Компетентность',
  'Лояльность'
];

// Calculate average for call scores (up to 7 criteria)
const calcAverageCalls = (rec: any): number => {
  let sum = 0;
  let count = 0;

  CRITERIA_CALLS.forEach(key => {
    let val = Number(rec[key]);
    // Fallback support for old schema "Подготовка"
    if (key === 'Подготовка техническая' && (isNaN(val) || val <= 0)) {
      val = Number(rec['Подготовка']);
    }
    if (!isNaN(val) && val > 0) {
      sum += val;
      count++;
    }
  });

  return count > 0 ? Number((sum / count).toFixed(2)) : 0;
};

// Return badge color class based on score
const getScoreColorClass = (score: number): string => {
  if (!score) return 'bg-slate-100 text-slate-400';
  if (score >= 8.5) return 'bg-green-100 text-green-800 border-green-200 font-bold';
  if (score >= 7.0) return 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
  return 'bg-rose-100 text-rose-800 border-rose-200 font-semibold';
};


// ==========================================
// 1. CALL SCORES VIEW
// ==========================================

function CallScoresView() {
  const { data: scores } = useCollection('call_scores');
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ studentKey: string; studentFio: string; studentEmail: string; studentSection: string; monthNum: number; record: any } | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Filter and search
  const filteredScores = useMemo(() => {
    if (!search) return scores;
    const q = search.toLowerCase();
    return scores.filter((s: any) => 
      (s['ФИО'] || '').toLowerCase().includes(q) || 
      (s['Почта'] || '').toLowerCase().includes(q) ||
      (s['Ментор'] || '').toLowerCase().includes(q)
    );
  }, [scores, search]);

  // Group flat database records into student rows
  const studentRows = useMemo(() => {
    const studentsMap: Record<string, {
      fio: string;
      email: string;
      section: string;
      months: Record<number, any>;
    }> = {};

    filteredScores.forEach((rec: any) => {
      const fio = (rec['ФИО'] || '').trim();
      const email = (rec['Почта'] || '').trim();
      if (!fio && !email) return;

      const key = fio || email;
      if (!studentsMap[key]) {
        studentsMap[key] = {
          fio: fio || 'Не указан',
          email: email || '',
          section: rec['Секция'] || '',
          months: {}
        };
      }

      const mNum = Number(rec['Месяц']) || 0;
      if (mNum >= 1 && mNum <= 12) {
        studentsMap[key].months[mNum] = rec;
      }
    });

    return Object.values(studentsMap).sort((a, b) => a.fio.localeCompare(b.fio));
  }, [filteredScores]);

  // Mentor Summary calculation
  const mentorSummaries = useMemo(() => {
    const summary: Record<string, Record<string, { sum: number; count: number }>> = {};

    scores.forEach((rec: any) => {
      const mentor = (rec['Ментор'] || 'Не указан').trim();
      if (!summary[mentor]) {
        summary[mentor] = {};
        CRITERIA_CALLS.forEach(c => {
          summary[mentor][c] = { sum: 0, count: 0 };
        });
        summary[mentor]['Оценка средняя'] = { sum: 0, count: 0 };
      }

      CRITERIA_CALLS.forEach(crit => {
        let val = Number(rec[crit]);
        if (crit === 'Подготовка техническая' && (isNaN(val) || val <= 0)) {
          val = Number(rec['Подготовка']);
        }
        if (!isNaN(val) && val > 0) {
          summary[mentor][crit].sum += val;
          summary[mentor][crit].count += 1;
        }
      });

      const avgVal = calcAverageCalls(rec) || Number(rec['Оценка средняя']);
      if (avgVal && avgVal > 0) {
        summary[mentor]['Оценка средняя'].sum += avgVal;
        summary[mentor]['Оценка средняя'].count += 1;
      }
    });

    return Object.entries(summary).map(([mentorName, metricsMap]) => {
      const averages: Record<string, number> = {};
      Object.entries(metricsMap).forEach(([crit, data]) => {
        averages[crit] = data.count > 0 ? Number((data.sum / data.count).toFixed(2)) : 0;
      });
      return {
        mentorName,
        averages
      };
    }).sort((a, b) => b.averages['Оценка средняя'] - a.averages['Оценка средняя']);
  }, [scores]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="call-scores-search"
              placeholder="Поиск по ФИО, почте или ментору..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-slate-100/50 transition-colors"
            />
          </div>
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Сбросить
            </button>
          )}
        </div>

        <button
          id="btn-add-call-score"
          onClick={() => setIsAddingNew(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить оценку
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Top summary section: Mentors list */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            Сводка по менторам (средние по критериям)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentorSummaries.map(item => (
              <div key={item.mentorName} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 text-sm truncate max-w-[70%]">{item.mentorName}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${getScoreColorClass(item.averages['Оценка средняя'])}`}>
                      {item.averages['Оценка средняя'] ? item.averages['Оценка средняя'].toFixed(2) : '0.00'} avg
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                    <div>Орг: <span className="font-bold text-slate-700">{item.averages['Оценка орг'] || '—'}</span></div>
                    <div>Вид: <span className="font-bold text-slate-700">{item.averages['Вид'] || '—'}</span></div>
                    <div>Подг. тех: <span className="font-bold text-slate-700">{item.averages['Подготовка техническая'] || '—'}</span></div>
                    <div>Вовлеч: <span className="font-bold text-slate-700">{item.averages['Вовлечённость'] || '—'}</span></div>
                    <div>Объясн: <span className="font-bold text-slate-700">{item.averages['Объяснение'] || '—'}</span></div>
                    <div>Компет: <span className="font-bold text-slate-700">{item.averages['Компетентность'] || '—'}</span></div>
                    <div className="col-span-2 border-t border-dashed border-slate-100 pt-1 mt-1">
                      Лояльность: <span className="font-bold text-slate-700">{item.averages['Лояльность'] || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {mentorSummaries.length === 0 && (
              <div className="col-span-full py-6 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl text-sm">
                Нет данных для расчёта средних по менторам
              </div>
            )}
          </div>
        </div>

        {/* Student matrix table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Матрица студент × месяц</h3>
            <span className="text-xs text-slate-400 font-medium">Январь (1) - Декабрь (12)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4 border-r border-slate-200 min-w-[200px] sticky left-0 bg-slate-100 z-10">Студент</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i + 1} className="py-3 px-2 text-center border-r border-slate-200 min-w-[75px]">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentRows.map(row => (
                  <tr key={row.fio} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-2.5 px-4 border-r border-slate-200 font-medium text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10">
                      <div>
                        <div className="font-semibold text-slate-900">{row.fio}</div>
                        {row.email && <div className="text-[10px] text-slate-400 font-normal truncate max-w-[220px]">{row.email}</div>}
                        {row.section && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded font-semibold uppercase tracking-wider">
                            {row.section}
                          </span>
                        )}
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mNum = i + 1;
                      const cellRecord = row.months[mNum];
                      const avg = cellRecord ? calcAverageCalls(cellRecord) : 0;
                      const mentor = cellRecord ? (cellRecord['Ментор'] || '').trim() : '';

                      return (
                        <td
                          key={mNum}
                          onClick={() => setSelectedCell({
                            studentKey: row.fio,
                            studentFio: row.fio,
                            studentEmail: row.email,
                            studentSection: row.section,
                            monthNum: mNum,
                            record: cellRecord || null
                          })}
                          className="py-2 px-2 border-r border-slate-200 text-center cursor-pointer hover:bg-blue-50/50 transition-all"
                        >
                          {cellRecord ? (
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${getScoreColorClass(avg)}`}>
                                {avg ? avg.toFixed(1) : '—'}
                              </span>
                              {mentor && (
                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[65px]" title={mentor}>
                                  {mentor}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 group-hover:text-slate-400 font-light">+</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {studentRows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      Студенты не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editor popovers */}
      {selectedCell && (
        <CallScoreEditor
          initialRecord={selectedCell.record}
          studentFio={selectedCell.studentFio}
          studentEmail={selectedCell.studentEmail}
          studentSection={selectedCell.studentSection}
          monthNum={selectedCell.monthNum}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {isAddingNew && (
        <CallScoreEditor
          initialRecord={null}
          studentFio=""
          studentEmail=""
          studentSection=""
          monthNum={1}
          onClose={() => setIsAddingNew(false)}
        />
      )}
    </div>
  );
}

// Interactive Call Score Editor component
interface CallScoreEditorProps {
  initialRecord: any;
  studentFio: string;
  studentEmail: string;
  studentSection: string;
  monthNum: number;
  onClose: () => void;
}

function CallScoreEditor({ initialRecord, studentFio, studentEmail, studentSection, monthNum, onClose }: CallScoreEditorProps) {
  const [fio, setFio] = useState(initialRecord ? (initialRecord['ФИО'] || '') : studentFio);
  const [email, setEmail] = useState(initialRecord ? (initialRecord['Почта'] || '') : studentEmail);
  const [section, setSection] = useState(initialRecord ? (initialRecord['Секция'] || '') : studentSection);
  const [mentor, setMentor] = useState(initialRecord ? (initialRecord['Ментор'] || '') : '');
  const [month, setMonth] = useState<number>(initialRecord ? (Number(initialRecord['Месяц']) || monthNum) : monthNum);

  // Initialize rating state with values 1-10
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    CRITERIA_CALLS.forEach(c => {
      let val = '';
      if (initialRecord) {
        val = initialRecord[c] != null ? String(initialRecord[c]) : '';
        // Check legacy preparation field name
        if (c === 'Подготовка техническая' && !val) {
          val = initialRecord['Подготовка'] != null ? String(initialRecord['Подготовка']) : '';
        }
      }
      r[c] = val;
    });
    return r;
  });

  const liveAvg = useMemo(() => {
    let sum = 0;
    let count = 0;
    Object.values(ratings).forEach(valStr => {
      const v = Number(valStr);
      if (!isNaN(v) && v > 0 && v <= 10) {
        sum += v;
        count++;
      }
    });
    return count > 0 ? Number((sum / count).toFixed(2)) : 0;
  }, [ratings]);

  const handleRatingChange = (key: string, valueStr: string) => {
    let val = valueStr.trim();
    if (val !== '') {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 10) return; // limit to 1-10
    }
    setRatings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!fio.trim()) {
      alert('Пожалуйста, заполните ФИО студента');
      return;
    }

    const payload: any = {
      'ФИО': fio.trim(),
      'Почта': email.trim(),
      'Секция': section.trim(),
      'Ментор': mentor.trim(),
      'Месяц': Number(month),
      'Оценка средняя': liveAvg || '',
    };

    CRITERIA_CALLS.forEach(c => {
      payload[c] = ratings[c] ? Number(ratings[c]) : '';
    });

    try {
      if (initialRecord && initialRecord.id) {
        await updateRecord('call_scores', initialRecord.id, payload);
      } else {
        await createRecord('call_scores', payload);
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении');
    }
  };

  const handleDelete = async () => {
    if (!initialRecord || !initialRecord.id) return;
    if (window.confirm('Вы действительно хотите удалить эту запись оценки?')) {
      try {
        await deleteRecord('call_scores', initialRecord.id, initialRecord);
        onClose();
      } catch (e) {
        console.error(e);
        alert('Ошибка при удалении');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div>
            <h4 className="font-bold text-slate-800 text-base">
              {initialRecord ? 'Редактировать оценку' : 'Создать новую оценку'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">Оценки созвонов (критерии 1-10)</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* FIO */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ФИО студента *</label>
            <input
              type="text"
              value={fio}
              onChange={e => setFio(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ФИО"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Почта (Email)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@mail.com"
            />
          </div>

          {/* Grid for Section, Mentor, Month */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Секция</label>
              <input
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Наставничество"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ментор</label>
              <input
                type="text"
                value={mentor}
                onChange={e => setMentor(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ФИО ментора"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Месяц (1-12) *</label>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {idx + 1} ({m})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ratings Block */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Критерии созвона (1-10)</h5>
            <div className="space-y-3">
              {CRITERIA_CALLS.map(critName => (
                <div key={critName} className="flex items-center justify-between gap-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                  <span className="text-xs font-semibold text-slate-600 truncate" title={critName}>{critName}</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ratings[critName] || ''}
                    onChange={e => handleRatingChange(critName, e.target.value)}
                    className="w-16 border border-slate-200 rounded-md px-2 py-1 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live Average Preview */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Оценка средняя</p>
              <p className="text-[10px] text-slate-400 mt-0.5">считается на лету из заполненных критериев</p>
            </div>
            <div className={`px-4 py-2 rounded-lg text-lg font-extrabold border ${getScoreColorClass(liveAvg)}`}>
              {liveAvg ? liveAvg.toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          {initialRecord ? (
            <button
              onClick={handleDelete}
              className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg transition-colors"
              title="Удалить оценку"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 2. MENTOR OS REVIEWS VIEW
// ==========================================

function OsReviewsView() {
  const { data: reviews } = useCollection('os_reviews');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterMentor, setFilterMentor] = useState<string>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  // Dynamic Rating Keys detection (looks at keys inside os_reviews to find numeric ratings)
  const ratingKeys = useMemo(() => {
    const keysSet = new Set<string>();
    reviews.forEach((r: any) => {
      Object.keys(r).forEach(k => {
        const isExcluded = ['id', 'month', 'monthNum', 'Месяц', 'Ментор', 'ментор', 'mentor', 'Ссылка на отзыв', 'ссылка', 'link'].includes(k);
        if (!isExcluded) {
          const val = Number(r[k]);
          if (!isNaN(val) && val >= 0 && val <= 10) {
            keysSet.add(k);
          }
        }
      });
    });

    let detected = Array.from(keysSet);
    // Ensure we list 6 keys. Fallback elegantly if less than 6.
    const defaults = [
      'Понятность материала',
      'Качество ответов',
      'Полезность созвона',
      'Вовлеченность ментора',
      'Пунктуальность',
      'Общая оценка'
    ];

    if (detected.length === 0) {
      detected = defaults;
    } else if (detected.length < 6) {
      let i = 0;
      while (detected.length < 6 && i < defaults.length) {
        if (!detected.includes(defaults[i])) {
          detected.push(defaults[i]);
        }
        i++;
      }
    }
    return detected.slice(0, 6);
  }, [reviews]);

  // Unique mentors from reviews
  const uniqueMentors = useMemo(() => {
    const mSet = new Set<string>();
    reviews.forEach((r: any) => {
      const m = r['Ментор'] || r['ментор'] || r['mentor'];
      if (m && typeof m === 'string' && m.trim()) {
        mSet.add(m.trim());
      }
    });
    return Array.from(mSet).sort();
  }, [reviews]);

  // Unique months from reviews
  const uniqueMonths = useMemo(() => {
    const mSet = new Set<string>();
    reviews.forEach((r: any) => {
      const m = r['month'] || r['Месяц'];
      if (m != null) {
        mSet.add(String(m).trim());
      }
    });
    return Array.from(mSet).sort();
  }, [reviews]);

  // Active filters and query matching
  const filteredReviews = useMemo(() => {
    return reviews.filter((r: any) => {
      const m = String(r['month'] || r['Месяц'] || '').trim();
      const mentor = String(r['Ментор'] || r['ментор'] || r['mentor'] || '').trim();

      const matchesMonth = filterMonth === 'all' || m === filterMonth;
      const matchesMentor = filterMentor === 'all' || mentor === filterMentor;

      return matchesMonth && matchesMentor;
    });
  }, [reviews, filterMonth, filterMentor]);

  // Mentor average calculations for os_reviews
  const mentorOsSummaries = useMemo(() => {
    const summary: Record<string, Record<string, { sum: number; count: number }>> = {};

    reviews.forEach((r: any) => {
      const mentor = (r['Ментор'] || 'Не указан').trim();
      if (!summary[mentor]) {
        summary[mentor] = {};
        ratingKeys.forEach(k => {
          summary[mentor][k] = { sum: 0, count: 0 };
        });
      }

      ratingKeys.forEach(k => {
        const val = Number(r[k]);
        if (!isNaN(val) && val > 0) {
          summary[mentor][k].sum += val;
          summary[mentor][k].count += 1;
        }
      });
    });

    return Object.entries(summary).map(([mentorName, metricsMap]) => {
      const averages: Record<string, number> = {};
      let totalSum = 0;
      let totalCount = 0;

      ratingKeys.forEach(k => {
        const data = metricsMap[k];
        const avg = data.count > 0 ? Number((data.sum / data.count).toFixed(2)) : 0;
        averages[k] = avg;
        if (avg > 0) {
          totalSum += avg;
          totalCount += 1;
        }
      });

      const overallAvg = totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : 0;

      return {
        mentorName,
        averages,
        overallAvg
      };
    }).sort((a, b) => b.overallAvg - a.overallAvg);
  }, [reviews, ratingKeys]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Controls & Filter Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-white shrink-0">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Month Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 font-medium transition-colors"
            >
              <option value="all">Все месяцы</option>
              {uniqueMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Mentor Filter */}
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={filterMentor}
              onChange={e => setFilterMentor(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 font-medium transition-colors"
            >
              <option value="all">Все менторы</option>
              {uniqueMentors.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {(filterMonth !== 'all' || filterMentor !== 'all') && (
            <button
              onClick={() => {
                setFilterMonth('all');
                setFilterMentor('all');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Очистить фильтры
            </button>
          )}
        </div>

        <button
          id="btn-add-os-review"
          onClick={() => setIsAddingNew(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Новый отзыв
        </button>
      </div>

      {/* Main body split */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Metric widgets & Mentor summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Counter Hero */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100/80 shadow-sm flex flex-col justify-between shrink-0">
            <div>
              <span className="inline-block p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Star className="w-5 h-5 fill-current" />
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4">Оценено отзывов</p>
              <p className="text-4xl font-extrabold text-slate-800 mt-1">{filteredReviews.length}</p>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-medium">
              Показано на основе текущих фильтров из {reviews.length} общих отзывов.
            </p>
          </div>

          {/* Mentors averaged metrics list */}
          <div className="lg:col-span-3 space-y-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-500" />
              Сводка средних по менторам (из ОС)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[160px] overflow-y-auto pr-1">
              {mentorOsSummaries.map(item => (
                <div key={item.mentorName} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.mentorName}</p>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1 text-[10px] text-slate-400">
                      {ratingKeys.map((k, idx) => (
                        <span key={k}>
                          О{idx + 1}: <span className="font-bold text-slate-600">{item.averages[k] || '—'}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs border shrink-0 text-center ${getScoreColorClass(item.overallAvg)}`}>
                    <p className="text-[8px] uppercase tracking-wider font-bold">overall</p>
                    <p className="font-extrabold">{item.overallAvg ? item.overallAvg.toFixed(2) : '0.00'}</p>
                  </div>
                </div>
              ))}
              {mentorOsSummaries.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl text-xs">
                  Нет данных отзывов по менторам
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Master Reviews Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Отзывы и Оценки</h3>
            <span className="text-xs text-slate-400 font-medium">Подробные критерии обратной связи</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4 border-r border-slate-100 min-w-[100px]">Месяц</th>
                  <th className="py-3 px-4 border-r border-slate-100 min-w-[150px]">Ментор</th>
                  {ratingKeys.map(k => (
                    <th key={k} className="py-3 px-2 text-center border-r border-slate-100 min-w-[80px]" title={k}>
                      {k}
                    </th>
                  ))}
                  <th className="py-3 px-4 border-r border-slate-100 min-w-[120px]">Отзыв</th>
                  <th className="py-3 px-4 text-center min-w-[90px]">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 border-r border-slate-100 font-medium text-slate-700">
                      {r['month'] || r['Месяц'] || '—'}
                    </td>
                    <td className="py-2.5 px-4 border-r border-slate-100 font-bold text-slate-900">
                      {r['Ментор'] || r['ментор'] || r['mentor'] || '—'}
                    </td>
                    {ratingKeys.map(k => {
                      const score = Number(r[k]) || 0;
                      return (
                        <td key={k} className="py-2.5 px-2 border-r border-slate-100 text-center font-bold">
                          {score > 0 ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${getScoreColorClass(score)}`}>
                              {score}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 border-r border-slate-100 text-slate-500">
                      {r['Ссылка на отзыв'] || r['ссылка'] || r['link'] ? (
                        <a
                          href={r['Ссылка на отзыв'] || r['ссылка'] || r['link']}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          Открыть
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300">нет ссылки</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedReview(r)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredReviews.length === 0 && (
                  <tr>
                    <td colSpan={ratingKeys.length + 4} className="py-12 text-center text-slate-400">
                      Отзывы не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OS Review Popover editors */}
      {selectedReview && (
        <OsReviewEditor
          initialReview={selectedReview}
          ratingKeys={ratingKeys}
          onClose={() => setSelectedReview(null)}
        />
      )}

      {isAddingNew && (
        <OsReviewEditor
          initialReview={null}
          ratingKeys={ratingKeys}
          onClose={() => setIsAddingNew(false)}
        />
      )}
    </div>
  );
}

// Os Review Editor Component
interface OsReviewEditorProps {
  initialReview: any;
  ratingKeys: string[];
  onClose: () => void;
}

function OsReviewEditor({ initialReview, ratingKeys, onClose }: OsReviewEditorProps) {
  const [month, setMonth] = useState<string>(initialReview ? String(initialReview['month'] || initialReview['Месяц'] || '') : '');
  const [mentor, setMentor] = useState<string>(initialReview ? String(initialReview['Ментор'] || initialReview['ментор'] || initialReview['mentor'] || '') : '');
  const [link, setLink] = useState<string>(initialReview ? String(initialReview['Ссылка на отзыв'] || initialReview['ссылка'] || initialReview['link'] || '') : '');

  // Initialize rating inputs
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    ratingKeys.forEach(k => {
      r[k] = initialReview && initialReview[k] != null ? String(initialReview[k]) : '';
    });
    return r;
  });

  const handleRatingChange = (key: string, valueStr: string) => {
    let val = valueStr.trim();
    if (val !== '') {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 10) return;
    }
    setRatings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!mentor.trim()) {
      alert('Пожалуйста, заполните поле Ментор');
      return;
    }

    const payload: any = {
      'month': month.trim(),
      'Месяц': month.trim(),
      'Ментор': mentor.trim(),
      'Ссылка на отзыв': link.trim()
    };

    ratingKeys.forEach(k => {
      payload[k] = ratings[k] ? Number(ratings[k]) : '';
    });

    try {
      if (initialReview && initialReview.id) {
        await updateRecord('os_reviews', initialReview.id, payload);
      } else {
        await createRecord('os_reviews', payload);
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении');
    }
  };

  const handleDelete = async () => {
    if (!initialReview || !initialReview.id) return;
    if (window.confirm('Вы действительно хотите удалить этот отзыв?')) {
      try {
        await deleteRecord('os_reviews', initialReview.id, initialReview);
        onClose();
      } catch (e) {
        console.error(e);
        alert('Ошибка при удалении');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div>
            <h4 className="font-bold text-slate-800 text-base">
              {initialReview ? 'Редактировать отзыв ОС' : 'Новый отзыв ОС менторов'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">Оценки отзывов и обратной связи (1-10)</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Mentor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ФИО Ментора *</label>
            <input
              type="text"
              value={mentor}
              onChange={e => setMentor(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ФИО ментора"
            />
          </div>

          {/* Month input / selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Месяц (номер или название)</label>
            <input
              type="text"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например, Январь или 1"
            />
          </div>

          {/* Review link */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ссылка на отзыв (URL)</label>
            <input
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {/* Rating Scores Grid */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Оценки ОС (1-10)</h5>
            <div className="space-y-3">
              {ratingKeys.map(k => (
                <div key={k} className="flex items-center justify-between gap-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                  <span className="text-xs font-semibold text-slate-600 truncate" title={k}>{k}</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ratings[k] || ''}
                    onChange={e => handleRatingChange(k, e.target.value)}
                    className="w-16 border border-slate-200 rounded-md px-2 py-1 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          {initialReview ? (
            <button
              onClick={handleDelete}
              className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg transition-colors"
              title="Удалить отзыв"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
