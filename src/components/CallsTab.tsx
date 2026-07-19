import { useState, useMemo } from 'react';
import { useCollection, createRecord, updateRecord, deleteRecord } from '../lib/useCollection';
import { Plus, Trash2, X, ChevronRight, Settings } from 'lucide-react';

export default function CallsTab() {
  const { data: calls } = useCollection('calls');
  const { data: categories } = useCollection('call_categories');

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const tabs = ['Наставничество/Блэк', 'ТП/ТЭ/Эво'];
  
  const activeCat = useMemo(() => categories.find(c => c.id === selectedCatId) || categories.find(c => !c.hidden), [categories, selectedCatId]);

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar with categories */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
             <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
             <span>Показать скрытые</span>
          </label>
        </div>
        {tabs.map(tab => {
           const cats = categories.filter(c => c.tab === tab && (!c.hidden || showHidden)).sort((a,b) => (a.order||0) - (b.order||0));
           if (cats.length === 0) return null;
           return (
             <div key={tab} className="mb-4">
               <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{tab}</div>
               {cats.map(c => (
                 <button
                   key={c.id}
                   onClick={() => setSelectedCatId(c.id)}
                   className={`w-full text-left px-4 py-1.5 text-sm flex items-center justify-between hover:bg-gray-200 ${activeCat?.id === c.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700'}`}
                 >
                   <span>{c['название']}</span>
                   {activeCat?.id === c.id && <ChevronRight className="w-4 h-4"/>}
                 </button>
               ))}
             </div>
           );
        })}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
         {activeCat ? <CategoryMatrix category={activeCat} allCalls={calls} /> : <div className="p-8 text-gray-500">Выберите категорию</div>}
      </div>
    </div>
  );
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function CategoryMatrix({ category, allCalls }: { category: any, allCalls: any[] }) {
  const catCalls = useMemo(() => allCalls.filter(c => c.categoryId === category.id), [allCalls, category.id]);
  const isMonthly = category.monthly !== false;
  const rawLeadFields = category.leadFields || ['ФИО'];
  const lf = Array.isArray(rawLeadFields) ? rawLeadFields : (rawLeadFields ? [String(rawLeadFields)] : []);
  const [selectedCell, setSelectedCell] = useState<{rowId: string, month: string} | null>(null);

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return catCalls;
    const q = search.toLowerCase();
    return catCalls.filter(c => lf.some((f:string) => String(c[f] ?? '').toLowerCase().includes(q)));
  }, [catCalls, search, lf]);

  if (!isMonthly) {
    return (
      <div className="p-4 overflow-auto h-full">
         <h2 className="text-xl font-bold mb-4">{category['название']}</h2>
         <div className="mb-4 w-64"><input placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-2 py-1 w-full text-sm"/></div>
         <table className="w-full text-left border-collapse text-sm">
           <thead>
             <tr className="border-b-2 border-gray-200">
               {lf.map((f:string) => <th key={f} className="py-2 px-2">{f}</th>)}
               {category.metrics?.map((m:string) => <th key={m} className="py-2 px-2">{m}</th>)}
             </tr>
           </thead>
           <tbody>
             {filtered.map(c => (
               <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                 {lf.map((f:string) => <td key={f} className="py-1.5 px-2">{c[f]}</td>)}
                 {category.metrics?.map((m:string) => <td key={m} className="py-1.5 px-2 text-gray-500">{c[m]}</td>)}
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    );
  }

  // Monthly Matrix
  return (
    <div className="flex flex-col h-full relative">
       <div className="p-4 border-b border-gray-200 bg-white">
         <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">{category['название']}</h2>
            <button 
              onClick={async () => {
                const newRow = { categoryId: category.id };
                await createRecord('calls', newRow);
              }}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4"/> Добавить строку
            </button>
         </div>
         {category.legend && (
           <div className="flex gap-4 text-xs mt-2">
             {Object.entries(category.legend).map(([color, label]) => (
               <div key={color} className="flex items-center gap-1">
                 <div className="w-3 h-3 rounded-full" style={{backgroundColor: color}} />
                 <span className="text-gray-600">{label as string}</span>
               </div>
             ))}
           </div>
         )}
         <div className="mt-4 w-64"><input placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-2 py-1 w-full text-sm"/></div>
       </div>

       <div className="flex-1 overflow-auto p-4">
         <table className="w-full text-left border-collapse text-sm">
           <thead className="bg-gray-50 sticky top-0 shadow-sm z-0">
             <tr>
               {lf.map((f:string) => <th key={f} className="py-2 px-2 border-r border-gray-200">{f}</th>)}
               {MONTHS.map(m => <th key={m} className="py-2 px-2 text-center border-r border-gray-200 min-w-[80px]">{m}</th>)}
               <th className="py-2 px-2 text-center bg-gray-100">Итог за год</th>
             </tr>
           </thead>
           <tbody>
             {filtered.map(row => {
                let yCount = 0;
                let yMins = 0;
                return (
                 <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                   {lf.map((f:string, i:number) => (
                     <td key={f} className={`py-1.5 px-2 border-r border-gray-200 relative ${i===0?'font-medium':''}`}>
                       {i===0 && row._color && <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: row._color}} />}
                       {row[f]}
                     </td>
                   ))}
                   {MONTHS.map(m => {
                     const mData = row[m] || {};
                     const cnt = Number(mData['Количест. созвонов']) || 0;
                     const dur = Number(mData['Длительность']) || 0;
                     yCount += cnt;
                     yMins += dur;
                     return (
                       <td key={m} 
                           onClick={() => setSelectedCell({rowId: row.id, month: m})}
                           className="py-1.5 px-2 border-r border-gray-200 text-center cursor-pointer hover:bg-blue-50">
                         {cnt > 0 ? (
                           <div className="text-xs">
                             <span className="font-semibold text-blue-900">{cnt}</span><span className="text-gray-400">×</span><span className="text-gray-600">{dur}м</span>
                           </div>
                         ) : <span className="text-gray-300">—</span>}
                       </td>
                     );
                   })}
                   <td className="py-1.5 px-2 bg-gray-50 text-center">
                     <div className="text-xs font-bold text-gray-700">{yCount > 0 ? `${yCount} × ${yMins}м` : '—'}</div>
                     {yCount > 0 && <div className="text-[10px] text-gray-500 italic text-center">ср. {Math.round(yMins/yCount)}м</div>}
                   </td>
                 </tr>
                );
             })}
           </tbody>
         </table>
       </div>

       {selectedCell && (
         <CellPopover 
            row={catCalls.find(c => c.id === selectedCell.rowId)} 
            month={selectedCell.month}
            category={category}
            onClose={() => setSelectedCell(null)}
         />
       )}
    </div>
  );
}

function CellPopover({ row, month, category, onClose }: { row: any, month: string, category: any, onClose: () => void }) {
  if (!row) {
    onClose();
    return null;
  }

  const mData = row[month] || {};
  const [data, setData] = useState({ ...mData });

  const save = async () => {
    await updateRecord('calls', row.id, { [month]: data });
    onClose();
  };

  const metrics = category.metrics || [];

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
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={data[m] || ''} onChange={e => setData({...data, [m]: e.target.value})} />
           </div>
         ))}
       </div>
       <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
         <button onClick={save} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Сохранить</button>
       </div>
    </div>
  );
}
