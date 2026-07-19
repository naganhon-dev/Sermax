import { useState, useMemo } from 'react';
import { useCollection, updateRecord, createRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AmgTab() {
  const { data: entries } = useCollection('amg_entries');
  const { data: meta } = useCollection('amg_meta');
  
  const [month, setMonth] = useState('Октябрь'); // e.g. current month
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const slotsDoc = meta.find((m:any) => m.id === 'slots');
  const slotsData = slotsDoc?.data || {};
  const currentSlots = slotsData[month] || { plan: '', debts: '' };

  const monthEntries = useMemo(() => entries.filter(e => e.month === month), [entries, month]);

  const saveSlots = async (plan: string, debts: string) => {
     if (slotsDoc) {
        await updateDoc(doc(db, 'amg_meta', 'slots'), {
           [`data.${month}`]: { plan, debts }
        });
     }
  };

  const addStudent = async () => {
    const fio = prompt("ФИО студента:");
    if (fio) {
      await createRecord('amg_entries', { month, fio, email: '', debts: '', monthsToTransfer: '' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <select value={month} onChange={e => setMonth(e.target.value)} className="border rounded px-4 py-2 text-lg font-bold bg-white text-gray-800">
           {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        
        <div className="flex gap-4 items-center bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm">
           <div className="text-sm font-medium text-gray-500">Слоты месяца:</div>
           <div className="flex items-center gap-2">
             <span className="text-xs text-gray-400">Планово</span>
             <input className="w-12 border rounded px-1 text-center font-semibold" value={currentSlots.plan} onChange={e => saveSlots(e.target.value, currentSlots.debts)} />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-xs text-gray-400">С долгами</span>
             <input className="w-12 border rounded px-1 text-center font-semibold text-red-600" value={currentSlots.debts} onChange={e => saveSlots(currentSlots.plan, e.target.value)} />
           </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 max-w-4xl">
         <div className="flex justify-between items-center mb-4">
           <h3 className="font-bold text-lg text-gray-800">Студенты АМГ ({monthEntries.length})</h3>
           <button onClick={addStudent} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Добавить
           </button>
         </div>
         <table className="w-full text-left border-collapse text-sm border border-gray-200 rounded-lg overflow-hidden">
           <thead className="bg-gray-100">
             <tr>
               <th className="py-2 px-3 border-b border-gray-200 w-1/3">ФИО</th>
               <th className="py-2 px-3 border-b border-gray-200 w-1/4">Почта</th>
               <th className="py-2 px-3 border-b border-gray-200">Долги</th>
               <th className="py-2 px-3 border-b border-gray-200 text-center">До перехода</th>
               <th className="py-2 px-3 border-b border-gray-200"></th>
             </tr>
           </thead>
           <tbody>
             {monthEntries.map(e => (
               <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                 <td className="py-2 px-3">
                   <input className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={e.fio || ''} onChange={ev => updateRecord('amg_entries', e.id, {fio: ev.target.value})} />
                 </td>
                 <td className="py-2 px-3">
                   <input className="w-full bg-transparent text-gray-500 border-b border-transparent focus:border-blue-500 outline-none" value={e.email || ''} onChange={ev => updateRecord('amg_entries', e.id, {email: ev.target.value})} />
                 </td>
                 <td className="py-2 px-3">
                   <input className="w-full bg-transparent text-red-600 border-b border-transparent focus:border-blue-500 outline-none" value={e.debts || ''} onChange={ev => updateRecord('amg_entries', e.id, {debts: ev.target.value})} placeholder="Нет" />
                 </td>
                 <td className="py-2 px-3 text-center">
                   <input className="w-12 text-center bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-semibold" value={e.monthsToTransfer || ''} onChange={ev => updateRecord('amg_entries', e.id, {monthsToTransfer: ev.target.value})} />
                 </td>
                 <td className="py-2 px-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => confirm("Удалить?") && deleteRecord('amg_entries', e.id, e)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
                 </td>
               </tr>
             ))}
             {monthEntries.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-400">В этом месяце нет студентов в АМГ</td></tr>}
           </tbody>
         </table>
      </div>
    </div>
  );
}
