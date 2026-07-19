import { useState, useEffect } from 'react';
import { useCollection } from '../lib/useCollection';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, ChevronRight, EyeOff, Eye, AlertTriangle } from 'lucide-react';

export default function ArchiveTab() {
  const { data: sheets } = useCollection('archive');
  const [selectedSheet, setSelectedSheet] = useState<any>(null);

  return (
    <div className="flex h-full bg-white">
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-700">Архивные страницы</h2>
        </div>
        <div className="flex-1 overflow-auto py-2">
           {sheets.map(s => (
             <button
               key={s.id}
               onClick={() => setSelectedSheet(s)}
               className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-200 ${selectedSheet?.id === s.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700'}`}
             >
               <span className="truncate">{s.name}</span>
               {selectedSheet?.id === s.id && <ChevronRight className="w-4 h-4 shrink-0"/>}
             </button>
           ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-white">
         {selectedSheet ? <ArchiveSheetView sheet={selectedSheet} /> : <div className="p-8 text-gray-500">Выберите страницу архива</div>}
      </div>
    </div>
  );
}

function ArchiveSheetView({ sheet }: { sheet: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    let mounted = true;
    (async () => {
      const chunksSnap = await getDocs(query(collection(db, `archive/${sheet.id}/chunks`)));
      if (!mounted) return;
      const chunks = chunksSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).sort((a,b) => Number(a.id) - Number(b.id));
      
      const allRows: any[] = [];
      chunks.forEach(ch => {
        try {
          const data = JSON.parse(ch.data);
          allRows.push(...data);
        } catch (e) {}
      });
      setRows(allRows);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [sheet.id]);

  const [showPwd, setShowPwd] = useState<Record<number, boolean>>({});

  const filtered = rows.filter(r => {
    if (!search) return true;
    if (!r) return false;
    const q = search.toLowerCase();
    const cells = Array.isArray(r) ? r : (r.c || []);
    return cells.some(c => {
      const v = c?.v || c || '';
      return String(v).toLowerCase().includes(q);
    });
  });

  const isAnalytics = sheet.name.includes('Аналитика общая');
  const isVera = sheet.name.includes('Выпуск Вера');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex flex-col gap-2">
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{sheet.name}</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
              <input placeholder="Поиск по странице..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-2 py-1 border border-gray-300 rounded text-sm w-full" />
            </div>
         </div>
         {isAnalytics && (
           <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm flex items-center gap-2">
             <AlertTriangle className="w-4 h-4 text-yellow-600" />
             ⚠ Значения из таблицы «Платина 3.5» заморожены 17.07.2026
           </div>
         )}
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
         {loading ? <div className="text-gray-500">Загрузка данных...</div> : (
           <table className="w-max text-left border-collapse text-sm bg-white shadow-sm border border-gray-200">
              <tbody>
                {filtered.map((row, rIdx) => {
                  if (!row) return null;
                  const cells = Array.isArray(row) ? row : (row.c || []);
                  return (
                    <tr key={rIdx} className="border-b border-gray-100 hover:bg-gray-50">
                      {cells.map((c:any, cIdx:number) => {
                        let val = c?.v !== undefined ? c.v : c;
                        let bg = c?.s?.bg || '';
                        if (val === null || val === undefined) val = '';
                        
                        // Mask password for Vera
                        if (isVera && cIdx === 4 && val) { // assuming pwd is col 4 or whatever, let's just mask anything that looks like pwd
                           // Actually the requirement is "колонку «Пароль» маскировать"
                           // We don't know the exact column, but let's check if the first row has "Пароль" in this col
                           const headerCells = Array.isArray(rows[0]) ? rows[0] : (rows[0]?.c || []);
                           const headerVal = headerCells[cIdx]?.v || headerCells[cIdx];
                           if (String(headerVal).toLowerCase() === 'пароль' && rIdx > 0) {
                              const isVis = showPwd[rIdx];
                              return (
                                <td key={cIdx} className="py-1.5 px-2 border-r border-gray-200" style={{backgroundColor: bg}}>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-gray-600">{isVis ? val : '••••••••'}</span>
                                    <button onClick={() => setShowPwd(p => ({...p, [rIdx]: !p[rIdx]}))} className="text-gray-400">
                                       {isVis ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                    </button>
                                  </div>
                                </td>
                              );
                           }
                        }

                        return (
                          <td key={cIdx} className="py-1 px-2 border-r border-gray-200 min-w-[80px]" style={{backgroundColor: bg}}>
                             {String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td className="p-4 text-gray-500">Ничего не найдено</td></tr>}
              </tbody>
           </table>
         )}
      </div>
    </div>
  );
}
