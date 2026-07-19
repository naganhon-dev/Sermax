import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X } from 'lucide-react';

export default function ScoresTab() {
  const [subTab, setSubTab] = useState('call_scores'); // call_scores, os_reviews

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
        {[
          { id: 'call_scores', label: 'Оценки созвонов' },
          { id: 'os_reviews', label: 'ОС менторов' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${subTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden relative">
        {subTab === 'call_scores' && <CallScoresView />}
        {subTab === 'os_reviews' && <OsReviewsView />}
      </div>
    </div>
  );
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function CallScoresView() {
  const { data: scores } = useCollection('call_scores');
  const [tabSet, setTabSet] = useState('Наставничество/Блэк');
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<any>(null);

  const filtered = useMemo(() => {
    let list = scores.filter(s => s.scoreTab === tabSet || (s.scoreTab === 'ТП/ТЭ/Эво (Копия)' && tabSet === 'ТП/ТЭ/Эво'));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => (s['ФИО']||'').toLowerCase().includes(q));
    }
    return list;
  }, [scores, tabSet, search]);

  const metrics = ['Количест. созвонов', 'Оценка орг', 'Вид', 'Подготовка', 'Вовлечённость', 'Объяснение', 'Компетентность', 'Лояльность', 'Оценка средняя'];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
         <div className="flex gap-4 items-center">
            <select value={tabSet} onChange={e=>setTabSet(e.target.value)} className="border rounded px-2 py-1 text-sm bg-gray-50">
               <option value="Наставничество/Блэк">Наставничество/Блэк</option>
               <option value="ТП/ТЭ/Эво">ТП/ТЭ/Эво</option>
            </select>
            <input placeholder="Поиск (ФИО)..." value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-2 py-1 text-sm w-64"/>
         </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
         <table className="w-full text-left border-collapse text-sm">
           <thead className="bg-gray-50 sticky top-0 shadow-sm z-0">
             <tr>
               <th className="py-2 px-2 border-r border-gray-200">ФИО</th>
               {MONTHS.map(m => <th key={m} className="py-2 px-2 text-center border-r border-gray-200 min-w-[80px]">{m}</th>)}
             </tr>
           </thead>
           <tbody>
             {filtered.map(row => (
               <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                 <td className="py-1.5 px-2 border-r border-gray-200 font-medium">
                   {row._color && <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: row._color}} />}
                   {row['ФИО']}
                 </td>
                 {MONTHS.map(m => {
                   const mData = row[m] || {};
                   const cnt = Number(mData['Количест. созвонов']) || 0;
                   const avg = Number(mData['Оценка средняя']) || 0;
                   return (
                     <td key={m} onClick={() => setSelectedCell({row, month: m})} className="py-1.5 px-2 border-r border-gray-200 text-center cursor-pointer hover:bg-blue-50">
                       {cnt > 0 ? (
                         <div className="text-xs">
                           <span className="font-semibold text-blue-900">{cnt}</span><span className="text-gray-400">×</span><span className="text-gray-600">{avg ? avg.toFixed(1) : '—'}</span>
                         </div>
                       ) : <span className="text-gray-300">—</span>}
                     </td>
                   );
                 })}
               </tr>
             ))}
           </tbody>
         </table>
      </div>

      {selectedCell && (
        <CallScorePopover 
           row={selectedCell.row} 
           month={selectedCell.month}
           metrics={metrics}
           onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}

function CallScorePopover({ row, month, metrics, onClose }: { row: any, month: string, metrics: string[], onClose: () => void }) {
  const mData = row[month] || {};
  const [data, setData] = useState({ ...mData });

  const save = async () => {
    // calculate avg
    const mToAvg = ['Оценка орг', 'Вид', 'Подготовка', 'Вовлечённость', 'Объяснение', 'Компетентность', 'Лояльность'];
    let sum = 0;
    let cnt = 0;
    mToAvg.forEach(k => {
       const v = Number(data[k]);
       if (!isNaN(v) && v > 0) { sum += v; cnt++; }
    });
    const avg = cnt > 0 ? (sum / cnt).toFixed(2) : '';
    await updateRecord('call_scores', row.id, { [month]: { ...data, 'Оценка средняя': avg } });
    onClose();
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-10">
       <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
         <div>
           <div className="font-bold">{row['ФИО']}</div>
           <div className="text-xs text-blue-600">{month}</div>
         </div>
         <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
       </div>
       <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
         {metrics.map((m:string) => (
           <div key={m}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{m}</label>
              {m === 'Оценка средняя' ? (
                <div className="text-sm italic text-gray-500 bg-gray-50 p-1 rounded">{data[m] || '—'}</div>
              ) : (
                <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={data[m] || ''} onChange={e => setData({...data, [m]: e.target.value})} />
              )}
           </div>
         ))}
       </div>
       <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
         <button onClick={save} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Сохранить</button>
       </div>
    </div>
  );
}

function OsReviewsView() {
  const { data: reviews } = useCollection('os_reviews');
  // Just a placeholder, implement table with list of reviews
  return <div className="p-4">ОС менторов (В разработке)</div>;
}
