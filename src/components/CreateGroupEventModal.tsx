import { useState, useMemo, FormEvent } from 'react';
import { createRecord } from '../lib/useCollection';
import { X, Users, Plus, Trash2, Search, CheckCircle2, Sparkles } from 'lucide-react';
import { canonStatus } from '../lib/status';

export const GROUP_EVENT_TYPES = ['Групповой созвон', 'Выпускной', 'Групповой торговый день'];

interface ParticipantItem {
  email: string;
  fio: string;
  group: string;
  package: string;
  mentor: string;
}

interface CreateGroupEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  allMentorsList: string[];
  defaultType?: string;
}

const fromDateInput = (d: string) => {
  if (!d) return '';
  if (d.includes('-')) return d.split('-').reverse().join('.');
  return d;
};

export default function CreateGroupEventModal({
  isOpen,
  onClose,
  students,
  allMentorsList,
  defaultType = 'Групповой созвон'
}: CreateGroupEventModalProps) {
  const [type, setType] = useState(defaultType);
  const [customType, setCustomType] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [mentor, setMentor] = useState('');

  // Filters for auto-selecting participants
  const [filterPackage, setFilterPackage] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterMentor, setFilterMentor] = useState('');

  // Selected participants
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);

  // Search for manual addition
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

  // Available groups and packages from students collection
  const availablePackages = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const p = (s['Программа'] || s['Пакет'] || s['программа'] || s['пакет'] || '').trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [students]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const g = (s['Группа'] || s['группа'] || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [students]);

  // Active learning students (status "Учится")
  const activeStudents = useMemo(() => {
    return students.filter(s => {
      if (s.is_lead || s.isLead) return false;
      const status = canonStatus(s['Статус'] || s['статус'] || '');
      return status === 'Учится';
    });
  }, [students]);

  // Auto-suggest action based on selected Package + Group + Mentor
  const handleAutoSuggest = () => {
    let matched = activeStudents;

    if (filterPackage) {
      matched = matched.filter(s => {
        const p = (s['Программа'] || s['Пакет'] || s['программа'] || s['пакет'] || '').trim();
        return p.toLowerCase() === filterPackage.toLowerCase();
      });
    }

    if (filterGroup) {
      matched = matched.filter(s => {
        const g = (s['Группа'] || s['группа'] || '').trim();
        return g.toLowerCase() === filterGroup.toLowerCase();
      });
    }

    if (filterMentor) {
      matched = matched.filter(s => {
        const m = (s['Ментор'] || s['ментор'] || s['mentor'] || '').trim();
        return m.toLowerCase() === filterMentor.toLowerCase();
      });
    }

    const newItems: ParticipantItem[] = matched.map(s => ({
      email: (s['Почта'] || s['почта'] || '').trim().toLowerCase(),
      fio: (s['ФИО'] || s['фио'] || 'Без имени').trim(),
      group: (s['Группа'] || s['группа'] || '').trim(),
      package: (s['Программа'] || s['Пакет'] || s['программа'] || s['пакет'] || '').trim(),
      mentor: (s['Ментор'] || s['ментор'] || '').trim()
    }));

    // Merge with existing avoiding duplicates
    setParticipants(prev => {
      const existingKeys = new Set(prev.map(p => p.email || p.fio.toLowerCase()));
      const filteredNew = newItems.filter(p => !existingKeys.has(p.email || p.fio.toLowerCase()));
      return [...prev, ...filteredNew];
    });
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSingleStudent = (student: any) => {
    const status = canonStatus(student['Статус'] || student['статус'] || '');
    if (status !== 'Учится') {
      alert('Созвон можно назначить только студенту в статусе Учится');
      return;
    }

    const email = (student['Почта'] || student['почта'] || '').trim().toLowerCase();
    const fio = (student['ФИО'] || student['фио'] || 'Без имени').trim();

    const exists = participants.some(p => (email && p.email === email) || (fio && p.fio.toLowerCase() === fio.toLowerCase()));
    if (exists) {
      alert(`Студент "${fio}" уже есть в списке участников.`);
      return;
    }

    setParticipants(prev => [
      ...prev,
      {
        email,
        fio,
        group: (student['Группа'] || student['группа'] || '').trim(),
        package: (student['Программа'] || student['Пакет'] || student['программа'] || student['пакет'] || '').trim(),
        mentor: (student['Ментор'] || student['ментор'] || '').trim()
      }
    ]);
    setIsAddingManual(false);
    setSearchQuery('');
  };

  const searchedStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return students.filter(s => {
      const fio = (s['ФИО'] || s['фио'] || '').toLowerCase();
      const email = (s['Почта'] || s['почта'] || '').toLowerCase();
      const group = (s['Группа'] || s['группа'] || '').toLowerCase();
      return fio.includes(q) || email.includes(q) || group.includes(q);
    }).slice(0, 10);
  }, [students, searchQuery]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const finalType = type === 'Другое' ? customType.trim() : type.trim();
    if (!finalType) {
      alert('Укажите тип события');
      return;
    }
    if (!date) {
      alert('Укажите дату события');
      return;
    }
    if (!mentor.trim()) {
      alert('Укажите ментора');
      return;
    }
    if (participants.length === 0) {
      alert('Добавьте хотя бы одного участника в состав группового события');
      return;
    }

    for (const p of participants) {
      const st = students.find(s => 
        (p.email && (s['Почта'] || s['почта'] || '').trim().toLowerCase() === p.email) ||
        (p.fio && (s['ФИО'] || s['фио'] || '').trim().toLowerCase() === p.fio.toLowerCase())
      );
      if (st) {
        const status = canonStatus(st['Статус'] || st['статус'] || '');
        if (status !== 'Учится') {
          alert('Созвон можно назначить только студенту в статусе Учится');
          return;
        }
      }
    }

    const monthNum = date ? new Date(date).getMonth() + 1 : new Date().getMonth() + 1;

    const groupCallData = {
      is_group: true,
      Тип: finalType,
      Дата: fromDateInput(date),
      Время: time,
      Месяц: monthNum,
      Ментор: mentor.trim(),
      participants: participants.map(p => ({
        email: p.email,
        fio: p.fio,
        present: null, // null = not marked yet
        initial_package: p.package,
        initial_group: p.group,
        initial_mentor: p.mentor
      })),
      created_at: new Date().toISOString()
    };

    await createRecord('calls', groupCallData);

    // Reset and close
    onClose();
    setDate('');
    setTime('');
    setMentor('');
    setParticipants([]);
    setFilterPackage('');
    setFilterGroup('');
    setFilterMentor('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-indigo-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-200" />
            <div>
              <h3 className="font-bold text-base leading-snug">Создание группового события</h3>
              <p className="text-xs text-indigo-200 font-normal">Групповой созвон, Выпускной или Торговый день</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto text-sm flex-1">
          
          {/* Main Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Тип события *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Групповой созвон">Групповой созвон</option>
                <option value="Выпускной">Выпускной</option>
                <option value="Групповой торговый день">Групповой торговый день</option>
                <option value="Другое">Свой тип...</option>
              </select>
              {type === 'Другое' && (
                <input
                  type="text"
                  required
                  placeholder="Введите свой тип..."
                  value={customType}
                  onChange={e => setCustomType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm mt-2 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ментор *</label>
              <input
                list="mentor-group-create-list"
                required
                placeholder="Выберите или введите ментора"
                value={mentor}
                onChange={e => setMentor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <datalist id="mentor-group-create-list">
                {allMentorsList.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Дата события *</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Время</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Auto-suggest Section */}
          <div className="border border-indigo-100 bg-indigo-50/50 p-3.5 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Авто-подбор состава по группе, пакету и ментору
              </span>
              <span className="text-[11px] text-indigo-700">Только в статусе "Учится"</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block font-medium text-gray-600 mb-0.5">Пакет / Программа</label>
                <select
                  value={filterPackage}
                  onChange={e => setFilterPackage(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все пакеты</option>
                  {availablePackages.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-600 mb-0.5">Группа / Поток</label>
                <select
                  value={filterGroup}
                  onChange={e => setFilterGroup(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все группы</option>
                  {availableGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-600 mb-0.5">Ментор группы</label>
                <select
                  value={filterMentor}
                  onChange={e => setFilterMentor(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все менторы</option>
                  {allMentorsList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoSuggest}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Предложить состав из учащихся студентов</span>
            </button>
          </div>

          {/* Composition of Participants */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-800">
                Состав участников ({participants.length}):
              </label>
              <button
                type="button"
                onClick={() => setIsAddingManual(!isAddingManual)}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить студента вручную
              </button>
            </div>

            {/* Manual add popover */}
            {isAddingManual && (
              <div className="mb-3 p-3 bg-gray-50 border border-indigo-200 rounded-md">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Поиск студента (ФИО, почта, группа)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                {searchedStudents.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto divide-y divide-gray-200 bg-white border border-gray-200 rounded-md shadow-xs">
                    {searchedStudents.map((st: any) => (
                      <div
                        key={st.id || st['Почта'] || st['ФИО']}
                        onClick={() => handleAddSingleStudent(st)}
                        className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{st['ФИО'] || 'Без имени'}</div>
                          <div className="text-[10px] text-gray-500">
                            {st['Почта']} · Группа: {st['Группа'] || '—'} · Ментор: {st['Ментор'] || '—'}
                          </div>
                        </div>
                        <span className="text-indigo-600 font-bold hover:underline">+ Добавить</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Table of selected participants */}
            <div className="border border-gray-200 rounded-md overflow-hidden max-h-48 overflow-y-auto bg-white">
              {participants.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Состав участников пока пуст. Воспользуйтесь авто-подбором выше или добавьте вручную.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">ФИО</th>
                      <th className="py-2 px-3">Почта</th>
                      <th className="py-2 px-3">Группа</th>
                      <th className="py-2 px-3">Пакет</th>
                      <th className="py-2 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {participants.map((p, idx) => (
                      <tr key={`${p.email}-${idx}`} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-semibold text-gray-900">{p.fio}</td>
                        <td className="py-1.5 px-3 text-gray-500">{p.email || '—'}</td>
                        <td className="py-1.5 px-3 text-gray-700">{p.group || '—'}</td>
                        <td className="py-1.5 px-3 text-gray-700">{p.package || '—'}</td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(idx)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                            title="Удалить из списка"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              Зафиксировать событие ({participants.length} чел.)
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
