import { useState, useMemo, FormEvent } from 'react';
import { updateRecord } from '../lib/useCollection';
import { X, Check, X as IconX, AlertTriangle, Users, Plus, Search, Trash2 } from 'lucide-react';
import { canonStatus } from '../lib/status';
import { canonMentor, ACTIVE_MENTORS } from '../lib/mentors';

interface GroupParticipant {
  email: string;
  fio: string;
  present: boolean | null;
  initial_package?: string;
  initial_group?: string;
  initial_mentor?: string;
}

interface GroupEventCardModalProps {
  groupCall: any;
  students: any[];
  onClose: () => void;
}

export default function GroupEventCardModal({
  groupCall,
  students,
  onClose
}: GroupEventCardModalProps) {
  const [participants, setParticipants] = useState<GroupParticipant[]>(
    groupCall?.participants || []
  );

  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Map students by email and FIO for fast current stream lookup
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

  // Check if participant changed stream/group between creation and marking
  const getStreamChangeInfo = (p: GroupParticipant) => {
    const emailKey = (p.email || '').trim().toLowerCase();
    const fioKey = (p.fio || '').trim().toLowerCase();

    const currentStudent = studentMap.get(emailKey) || studentMap.get(fioKey);

    if (!currentStudent) {
      return { hasChanged: false, currentGroup: '', currentPackage: '' };
    }

    const currentGroup = (currentStudent['Группа'] || currentStudent['группа'] || '').trim();
    const currentPackage = (currentStudent['Программа'] || currentStudent['Пакет'] || currentStudent['программа'] || currentStudent['пакет'] || '').trim();

    const initialGroup = (p.initial_group || '').trim();
    const initialPackage = (p.initial_package || '').trim();

    const groupChanged = Boolean(initialGroup && currentGroup && initialGroup.toLowerCase() !== currentGroup.toLowerCase());
    const packageChanged = Boolean(initialPackage && currentPackage && initialPackage.toLowerCase() !== currentPackage.toLowerCase());

    const hasChanged = groupChanged || packageChanged;

    return {
      hasChanged,
      currentGroup,
      currentPackage,
      initialGroup,
      initialPackage
    };
  };

  // Toggle present status for participant
  const handleTogglePresent = async (index: number, status: boolean | null) => {
    const updated = [...participants];
    updated[index] = {
      ...updated[index],
      present: status
    };
    setParticipants(updated);

    // Save to Firestore
    if (groupCall?.id) {
      await updateRecord('calls', groupCall.id, {
        participants: updated
      });
    }
  };

  // Remove participant from event
  const handleRemoveParticipant = async (index: number) => {
    if (confirm(`Удалить участника "${participants[index]?.fio}" из созвона?`)) {
      const updated = participants.filter((_, i) => i !== index);
      setParticipants(updated);

      if (groupCall?.id) {
        await updateRecord('calls', groupCall.id, {
          participants: updated
        });
      }
    }
  };

  // Add new participant manually
  const handleAddParticipant = async (student: any) => {
    const status = canonStatus(student['Статус'] || student['статус'] || '');
    if (status !== 'Учится') {
      alert('Созвон можно назначить только студенту в статусе Учится');
      return;
    }

    const email = (student['Почта'] || student['почта'] || '').trim().toLowerCase();
    const fio = (student['ФИО'] || student['фио'] || 'Без имени').trim();

    const exists = participants.some(p => (email && p.email === email) || (fio && p.fio.toLowerCase() === fio.toLowerCase()));
    if (exists) {
      alert(`Студент "${fio}" уже есть в составе события.`);
      return;
    }

    const newP: GroupParticipant = {
      email,
      fio,
      present: null,
      initial_group: (student['Группа'] || student['группа'] || '').trim(),
      initial_package: (student['Программа'] || student['Пакет'] || student['программа'] || student['пакет'] || '').trim(),
      initial_mentor: canonMentor(student['Ментор'] || student['ментор'] || '').trim()
    };

    const updated = [...participants, newP];
    setParticipants(updated);
    setIsAddingStudent(false);
    setSearchQuery('');

    if (groupCall?.id) {
      await updateRecord('calls', groupCall.id, {
        participants: updated
      });
    }
  };

  const uniquePackages = useMemo(() => {
    const arr = Array.from(
      new Set(
        students
          .map(s => s['Пакет обучения'] || s['Пакет'] || s['программа'] || s['Программа'])
          .filter(Boolean)
      )
    ).sort();
    console.log('[GroupEventCardModal] uniquePackages count:', arr.length, arr);
    return arr;
  }, [students]);

  const uniqueGroups = useMemo(() => {
    const arr = Array.from(
      new Set(
        students
          .map(s => s['Группа'] || s['группа'])
          .filter(Boolean)
      )
    ).sort();
    console.log('[GroupEventCardModal] uniqueGroups count:', arr.length, arr);
    return arr;
  }, [students]);

  const [manualFio, setManualFio] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualGroup, setManualGroup] = useState('');
  const [manualPackage, setManualPackage] = useState('');
  const [manualMentor, setManualMentor] = useState('');

  const handleAddManualParticipant = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualFio.trim()) return;

    const email = manualEmail.trim().toLowerCase();
    const fio = manualFio.trim();

    const newP: GroupParticipant = {
      email,
      fio,
      present: null,
      initial_group: manualGroup.trim(),
      initial_package: manualPackage.trim(),
      initial_mentor: canonMentor(manualMentor.trim())
    };

    const updated = [...participants, newP];
    setParticipants(updated);
    setManualFio('');
    setManualEmail('');
    setManualGroup('');
    setManualPackage('');
    setManualMentor('');
    setIsAddingStudent(false);

    if (groupCall?.id) {
      await updateRecord('calls', groupCall.id, {
        participants: updated
      });
    }
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

  // Summary counters
  const totalCount = participants.length;
  const presentCount = participants.filter(p => p.present === true).length;
  const absentCount = participants.filter(p => p.present === false).length;
  const unmarkedCount = participants.filter(p => p.present === null).length;
  const changedStreamCount = participants.filter(p => getStreamChangeInfo(p).hasChanged).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-indigo-700 text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded text-xs font-semibold">
                {groupCall.Тип || 'Групповое событие'}
              </span>
              <h3 className="font-bold text-base">{groupCall.Дата || 'Без даты'} {groupCall.Время ? `в ${groupCall.Время}` : ''}</h3>
            </div>
            <p className="text-xs text-indigo-200 font-normal mt-0.5">
              Ментор: <span className="font-semibold text-white">{groupCall.Ментор || 'Не указан'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Badges Bar */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-5 py-2.5 flex flex-wrap items-center justify-between text-xs gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-900 font-semibold shadow-2xs">
              Всего: {totalCount} чел.
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-semibold border border-emerald-200">
              ✓ Был: {presentCount}
            </span>
            <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-md font-semibold border border-rose-200">
              ✗ Не был: {absentCount}
            </span>
            {unmarkedCount > 0 && (
              <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-medium border border-gray-200">
                Не отмечено: {unmarkedCount}
              </span>
            )}
            {changedStreamCount > 0 && (
              <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md font-semibold border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Сменили поток: {changedStreamCount}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAddingStudent(!isAddingStudent)}
            className="text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-indigo-300 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить участника
          </button>
        </div>

        {/* Manual Addition Area */}
        {isAddingStudent && (
          <div className="p-3 bg-gray-50 border-b border-gray-200 shrink-0 space-y-3">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Поиск студента из базы по ФИО, почте или группе..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            {searchedStudents.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto divide-y divide-gray-200 bg-white border border-gray-200 rounded-md shadow-xs max-w-md">
                {searchedStudents.map((st: any) => (
                  <div
                    key={st.id || st['Почта'] || st['ФИО']}
                    onClick={() => handleAddParticipant(st)}
                    className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{st['ФИО'] || 'Без имени'}</div>
                      <div className="text-[10px] text-gray-500">
                        {st['Почта']} · Группа: {st['Группа'] || '—'}
                      </div>
                    </div>
                    <span className="text-indigo-600 font-bold hover:underline">+ Добавить</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddManualParticipant} className="pt-2 border-t border-gray-200 space-y-2">
              <div className="text-xs font-semibold text-gray-700">Или добавьте участника вручную:</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">ФИО *</label>
                  <input
                    type="text"
                    required
                    placeholder="ФИО студента"
                    value={manualFio}
                    onChange={e => setManualFio(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Почта</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={manualEmail}
                    onChange={e => setManualEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Группа</label>
                  <input
                    type="text"
                    list="card-modal-group-list"
                    placeholder="Группа"
                    value={manualGroup}
                    onChange={e => setManualGroup(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                  />
                  <datalist id="card-modal-group-list">
                    {uniqueGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Пакет обучения</label>
                  <input
                    type="text"
                    list="card-modal-package-list"
                    placeholder="Пакет"
                    value={manualPackage}
                    onChange={e => setManualPackage(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                  />
                  <datalist id="card-modal-package-list">
                    {uniquePackages.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Ментор</label>
                  <input
                    type="text"
                    list="card-modal-mentor-list"
                    placeholder="Ментор"
                    value={manualMentor}
                    onChange={e => setManualMentor(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                  />
                  <datalist id="card-modal-mentor-list">
                    {["Герчик","Носков","Степченко","Кирш","Щеглов","Чорный","Кравченко"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded text-xs hover:bg-indigo-700"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Participants Table */}
        <div className="p-4 overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0 shadow-2xs">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Участник (ФИО / Почта)</th>
                <th className="py-2.5 px-3">Группа (на момент события)</th>
                <th className="py-2.5 px-3">Статус / Поток</th>
                <th className="py-2.5 px-3 text-center min-w-[200px]">Отметка присутствия</th>
                <th className="py-2.5 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Участники не добавлены
                  </td>
                </tr>
              ) : (
                participants.map((p, idx) => {
                  const streamInfo = getStreamChangeInfo(p);
                  const isPresent = p.present === true;
                  const isAbsent = p.present === false;
                  const isUnmarked = p.present === null;

                  return (
                    <tr
                      key={`${p.email}-${idx}`}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        streamInfo.hasChanged ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">{idx + 1}</td>

                      <td className="py-3 px-3 font-medium">
                        <div className="font-semibold text-gray-900 text-xs">{p.fio}</div>
                        <div className="text-[11px] text-gray-500 font-normal">{p.email || '—'}</div>
                      </td>

                      <td className="py-3 px-3 text-gray-700">
                        <div>{p.initial_group || '—'}</div>
                        {p.initial_package && (
                          <div className="text-[10px] text-gray-400 font-normal">{p.initial_package}</div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {streamInfo.hasChanged ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-300" title={`Создано в группе "${streamInfo.initialGroup}", а сейчас студент в группе "${streamInfo.currentGroup}"`}>
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            сменил поток, не засчитано
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium text-[11px]">
                            Поток без изменений
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleTogglePresent(idx, true)}
                            className={`px-3 py-1 rounded-md font-semibold transition-all text-xs flex items-center gap-1 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-gray-600 hover:text-emerald-700 hover:bg-gray-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Был
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePresent(idx, false)}
                            className={`px-3 py-1 rounded-md font-semibold transition-all text-xs flex items-center gap-1 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-gray-600 hover:text-rose-700 hover:bg-gray-200'
                            }`}
                          >
                            <IconX className="w-3.5 h-3.5" /> Не был
                          </button>
                          {!isUnmarked && (
                            <button
                              type="button"
                              onClick={() => handleTogglePresent(idx, null)}
                              className="px-2 py-1 text-gray-400 hover:text-gray-600 text-[10px]"
                              title="Сбросить отметку"
                            >
                              Сброс
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(idx)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Удалить участника из списка"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-500">
            Все изменения присутствия сохраняются автоматически в базе созвонов.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs shadow-xs"
          >
            Готово
          </button>
        </div>

      </div>
    </div>
  );
}
