import { useState, useMemo } from 'react';
import { useCollection, updateRecord, createRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

export default function AmgTab() {
  const { data: entries } = useCollection('amg_entries');
  const { data: meta } = useCollection('amg_meta');
  
  const [month, setMonth] = useState('Октябрь');
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  // Identify amg_meta document
  const metaDoc = meta.find((m: any) => m.id === 'slots') || meta[0];
  const metaId = metaDoc?.id || 'slots';

  // Getters for amg_meta configurations
  const scheduleVal = metaDoc?.['график'] || metaDoc?.['schedule'] || '';
  const limitVal = metaDoc?.['лимит_студентов'] !== undefined ? Number(metaDoc?.['лимит_студентов']) : (metaDoc?.['limit_students'] !== undefined ? Number(metaDoc?.['limit_students']) : 20);
  
  const slotsObj = metaDoc?.['слоты'] || metaDoc?.['slots'] || metaDoc?.['data'] || {};
  const currentMonthSlots = slotsObj[month] || {};
  
  const slotPlan = currentMonthSlots['Планово'] !== undefined ? currentMonthSlots['Планово'] : (currentMonthSlots['plan'] !== undefined ? currentMonthSlots['plan'] : '');
  const slotDebts = currentMonthSlots['С долгами'] !== undefined ? currentMonthSlots['С долгами'] : (currentMonthSlots['debts'] !== undefined ? currentMonthSlots['debts'] : '');

  // Filter entries for the selected month
  const monthEntries = useMemo(() => {
    return entries.filter(e => {
      const m = e['Месяц'] || e.month;
      return m === month;
    });
  }, [entries, month]);

  // Safe field getters for students
  const getFio = (e: any) => e['ФИО'] ?? e['fio'] ?? '';
  const getEmail = (e: any) => e['Почта'] ?? e['email'] ?? '';
  const getDebts = (e: any) => e['Долги'] ?? e['debts'] ?? '';
  const getMonthsToTransfer = (e: any) => e['До перехода'] ?? e['monthsToTransfer'] ?? '';
  const getSection = (e: any) => e['Секция'] ?? e['section'] ?? '';

  // Helpers to save config to amg_meta
  const saveSchedule = async (val: string) => {
    const isCyrillic = 'график' in (metaDoc || {}) || !('schedule' in (metaDoc || {}));
    const key = isCyrillic ? 'график' : 'schedule';
    
    if (metaDoc) {
      await updateRecord('amg_meta', metaId, { [key]: val });
    } else {
      await createRecord('amg_meta', { id: 'slots', [key]: val });
    }
  };

  const saveLimit = async (val: number) => {
    const isCyrillic = 'лимит_студентов' in (metaDoc || {}) || !('limit_students' in (metaDoc || {}));
    const key = isCyrillic ? 'лимит_студентов' : 'limit_students';
    
    if (metaDoc) {
      await updateRecord('amg_meta', metaId, { [key]: val });
    } else {
      await createRecord('amg_meta', { id: 'slots', [key]: val });
    }
  };

  const saveMonthSlots = async (plan: string, debts: string) => {
    const isCyrillicSlots = 'слоты' in (metaDoc || {}) || !('slots' in (metaDoc || {}) || 'data' in (metaDoc || {}));
    const slotsKey = isCyrillicSlots ? 'слоты' : ('slots' in (metaDoc || {}) ? 'slots' : 'data');
    
    const isCyrillicPlan = currentMonthSlots && 'Планово' in currentMonthSlots;
    const planKey = isCyrillicPlan || isCyrillicSlots ? 'Планово' : 'plan';
    const debtsKey = isCyrillicPlan || isCyrillicSlots ? 'С долгами' : 'debts';
    
    const newMonthData = {
      [planKey]: plan,
      [debtsKey]: debts
    };
    
    const updatedSlots = {
      ...slotsObj,
      [month]: newMonthData
    };
    
    if (metaDoc) {
      await updateRecord('amg_meta', metaId, { [slotsKey]: updatedSlots });
    } else {
      await createRecord('amg_meta', { id: 'slots', [slotsKey]: updatedSlots });
    }
  };

  // Student CRUD and inline update
  const handleUpdateStudent = async (id: string, updatedFields: any) => {
    const fieldsToSave: any = {};
    if ('ФИО' in updatedFields || 'fio' in updatedFields) {
      const val = updatedFields['ФИО'] !== undefined ? updatedFields['ФИО'] : updatedFields['fio'];
      fieldsToSave['ФИО'] = val;
      fieldsToSave['fio'] = val;
    }
    if ('Почта' in updatedFields || 'email' in updatedFields) {
      const val = updatedFields['Почта'] !== undefined ? updatedFields['Почта'] : updatedFields['email'];
      fieldsToSave['Почта'] = val;
      fieldsToSave['email'] = val;
    }
    if ('Долги' in updatedFields || 'debts' in updatedFields) {
      const val = updatedFields['Долги'] !== undefined ? updatedFields['Долги'] : updatedFields['debts'];
      fieldsToSave['Долги'] = val;
      fieldsToSave['debts'] = val;
    }
    if ('До перехода' in updatedFields || 'monthsToTransfer' in updatedFields) {
      const val = updatedFields['До перехода'] !== undefined ? updatedFields['До перехода'] : updatedFields['monthsToTransfer'];
      fieldsToSave['До перехода'] = val;
      fieldsToSave['monthsToTransfer'] = val;
    }
    if ('Секция' in updatedFields || 'section' in updatedFields) {
      const val = updatedFields['Секция'] !== undefined ? updatedFields['Секция'] : updatedFields['section'];
      fieldsToSave['Секция'] = val;
      fieldsToSave['section'] = val;
    }
    if ('Месяц' in updatedFields || 'month' in updatedFields) {
      const val = updatedFields['Месяц'] !== undefined ? updatedFields['Месяц'] : updatedFields['month'];
      fieldsToSave['Месяц'] = val;
      fieldsToSave['month'] = val;
    }
    
    await updateRecord('amg_entries', id, fieldsToSave);
  };

  const handleCreateStudent = async (sectName: string) => {
    const fio = prompt(`ФИО студента для секции "${sectName}":`);
    if (fio) {
      const newStudent = {
        'ФИО': fio,
        'fio': fio,
        'Месяц': month,
        'month': month,
        'Секция': sectName,
        'section': sectName,
        'Почта': '',
        'email': '',
        'Долги': '',
        'debts': '',
        'До перехода': '',
        'monthsToTransfer': ''
      };
      await createRecord('amg_entries', newStudent);
    }
  };

  // Section details
  const sectionNames = [
    "Студенты с одним созвоном",
    "Студенты с двумя созвонами",
    "Выпускники",
    "Платные созвоны"
  ];

  const sectionEntries = (sectionName: string) => {
    return monthEntries.filter(e => getSection(e) === sectionName);
  };

  const unassignedEntries = monthEntries.filter(e => {
    const sect = getSection(e);
    return !sectionNames.includes(sect);
  });

  // Calculations
  const totalDebts = useMemo(() => {
    return monthEntries.reduce((acc, curr) => {
      const val = getDebts(curr);
      const parsed = parseFloat(String(val).replace(/[^\d.]/g, '')) || 0;
      return acc + parsed;
    }, 0);
  }, [monthEntries]);

  const callSections = ["Студенты с одним созвоном", "Студенты с двумя созвонами", "Платные созвоны"];
  const studentsOnCallsCount = useMemo(() => {
    return monthEntries.filter(e => {
      const sect = getSection(e);
      return callSections.includes(sect);
    }).length;
  }, [monthEntries]);

  const isOverloaded = studentsOnCallsCount > limitVal;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Config Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <select 
            value={month} 
            onChange={e => setMonth(e.target.value)} 
            className="border border-gray-300 rounded px-3 py-1.5 text-base font-bold bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
             {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">График:</span>
            <input 
              type="text" 
              className="w-44 text-xs border-b border-gray-300 hover:border-gray-400 focus:border-blue-500 outline-none px-1 text-gray-700" 
              placeholder="Ссылка на график..."
              value={scheduleVal} 
              onChange={e => saveSchedule(e.target.value)} 
            />
            {scheduleVal && (
              <a 
                href={scheduleVal.startsWith('http') ? scheduleVal : `https://${scheduleVal}`} 
                target="_blank" 
                rel="noreferrer" 
                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-gray-100 transition-colors"
                title="Открыть график"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Слоты планово */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Слоты планово:</span>
            <input 
              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs" 
              value={slotPlan} 
              onChange={e => saveMonthSlots(e.target.value, slotDebts)} 
            />
          </div>

          {/* С долгами */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">С долгами:</span>
            <input 
              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center font-semibold text-red-600 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs" 
              value={slotDebts} 
              onChange={e => saveMonthSlots(slotPlan, e.target.value)} 
            />
          </div>

          {/* Лимит студентов */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Лимит созвонов:</span>
            <input 
              type="number"
              className="w-14 border border-gray-200 rounded px-1 py-0.5 text-center font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs" 
              value={limitVal} 
              onChange={e => saveLimit(Number(e.target.value))} 
            />
          </div>
        </div>
      </div>

      {/* Month Statistics Row */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="text-gray-500 font-medium">Студентов на созвонах:</span>
          <span className={`font-bold text-base ${isOverloaded ? 'text-red-600' : 'text-gray-800'}`}>
            {studentsOnCallsCount}
          </span>
          {isOverloaded && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold text-xs rounded border border-red-200 animate-pulse">
              перегруз (лимит {limitVal})
            </span>
          )}
        </div>

        <div className="hidden md:block w-px h-5 bg-gray-200"></div>

        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="text-gray-500 font-medium">Сумма долгов за месяц:</span>
          <span className="font-bold text-base text-gray-800">
            {totalDebts.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>
      
      {/* Scrollable tables by section */}
      <div className="flex-1 overflow-auto p-6 space-y-8 bg-gray-100/30">
        {sectionNames.map(sectName => {
          const sEntries = sectionEntries(sectName);
          return (
            <div key={sectName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">{sectName}</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold text-xs rounded-full">
                    {sEntries.length}
                  </span>
                </div>
                <button 
                  onClick={() => handleCreateStudent(sectName)} 
                  className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold text-gray-600">ФИО</th>
                      <th className="py-2.5 px-4 font-semibold text-gray-600">Почта</th>
                      <th className="py-2.5 px-4 font-semibold text-gray-600">Долги</th>
                      <th className="py-2.5 px-4 font-semibold text-gray-600 text-center">До перехода</th>
                      <th className="py-2.5 px-4 font-semibold text-gray-600 w-44">Секция</th>
                      <th className="py-2.5 px-4 font-semibold text-gray-600 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sEntries.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="py-2 px-4">
                          <input 
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none text-gray-800 font-medium py-0.5 text-xs md:text-sm" 
                            value={getFio(e)} 
                            onChange={ev => handleUpdateStudent(e.id, { 'ФИО': ev.target.value })} 
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input 
                            className="w-full bg-transparent text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none py-0.5 text-xs md:text-sm" 
                            value={getEmail(e)} 
                            onChange={ev => handleUpdateStudent(e.id, { 'Почта': ev.target.value })} 
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input 
                            className="w-full bg-transparent text-red-600 font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none py-0.5 text-xs md:text-sm" 
                            value={getDebts(e)} 
                            onChange={ev => handleUpdateStudent(e.id, { 'Долги': ev.target.value })} 
                            placeholder="Нет"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input 
                            className="w-16 text-center bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none font-semibold py-0.5 mx-auto block text-xs md:text-sm" 
                            value={getMonthsToTransfer(e)} 
                            onChange={ev => handleUpdateStudent(e.id, { 'До перехода': ev.target.value })} 
                          />
                        </td>
                        <td className="py-2 px-4">
                          <select
                            value={getSection(e)}
                            onChange={ev => handleUpdateStudent(e.id, { 'Секция': ev.target.value })}
                            className="text-xs bg-gray-50 border border-gray-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 outline-none text-gray-600 font-medium w-full max-w-[170px]"
                          >
                            {sectionNames.map(sn => (
                              <option key={sn} value={sn}>{sn}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button 
                            onClick={() => confirm("Удалить студента?") && deleteRecord('amg_entries', e.id, e)} 
                            className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-gray-400 text-xs">
                          Нет студентов в этой секции
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Fallback Section for Unassigned if any exist */}
        {unassignedEntries.length > 0 && (
          <div className="bg-red-50/30 rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-red-800 text-xs md:text-sm uppercase tracking-wide">Без секции (Неизвестные)</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 font-semibold text-xs rounded-full">
                  {unassignedEntries.length}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead className="bg-red-50/50 text-red-600 uppercase tracking-wider font-semibold text-[10px] border-b border-red-100">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">ФИО</th>
                    <th className="py-2.5 px-4 font-semibold">Почта</th>
                    <th className="py-2.5 px-4 font-semibold">Долги</th>
                    <th className="py-2.5 px-4 font-semibold text-center">До перехода</th>
                    <th className="py-2.5 px-4 font-semibold w-44">Секция</th>
                    <th className="py-2.5 px-4 font-semibold w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 bg-white">
                  {unassignedEntries.map(e => (
                    <tr key={e.id} className="hover:bg-red-50/10 transition-colors group">
                      <td className="py-2 px-4">
                        <input 
                          className="w-full bg-transparent border-b border-transparent hover:border-red-300 focus:border-red-500 outline-none text-gray-800 font-medium py-0.5" 
                          value={getFio(e)} 
                          onChange={ev => handleUpdateStudent(e.id, { 'ФИО': ev.target.value })} 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          className="w-full bg-transparent text-gray-500 border-b border-transparent hover:border-red-300 focus:border-red-500 outline-none py-0.5" 
                          value={getEmail(e)} 
                          onChange={ev => handleUpdateStudent(e.id, { 'Почта': ev.target.value })} 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          className="w-full bg-transparent text-red-600 font-medium border-b border-transparent hover:border-red-300 focus:border-red-500 outline-none py-0.5" 
                          value={getDebts(e)} 
                          onChange={ev => handleUpdateStudent(e.id, { 'Долги': ev.target.value })} 
                          placeholder="Нет"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input 
                          className="w-16 text-center bg-transparent border-b border-transparent hover:border-red-300 focus:border-red-500 outline-none font-semibold py-0.5 mx-auto block" 
                          value={getMonthsToTransfer(e)} 
                          onChange={ev => handleUpdateStudent(e.id, { 'До перехода': ev.target.value })} 
                        />
                      </td>
                      <td className="py-2 px-4">
                        <select
                          value={getSection(e)}
                          onChange={ev => handleUpdateStudent(e.id, { 'Секция': ev.target.value })}
                          className="text-xs bg-red-50/50 border border-red-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-red-500 outline-none text-red-700 font-medium w-full max-w-[170px]"
                        >
                          <option value="">-- Выберите секцию --</option>
                          {sectionNames.map(sn => (
                            <option key={sn} value={sn}>{sn}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button 
                          onClick={() => confirm("Удалить студента?") && deleteRecord('amg_entries', e.id, e)} 
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

