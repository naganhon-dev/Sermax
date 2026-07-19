import { useState, useMemo, useEffect } from 'react';
import { useGlobalData } from '../lib/globalStore';
import { Search, Calendar, Users, Activity, Star } from 'lucide-react';
import { CellValue } from '../types';

export default function HomeTab({ setActiveTabAndSheet }: { setActiveTabAndSheet: (tabId: string, sheetId: string, row?: number) => void }) {
  const { data, loading } = useGlobalData();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const metrics = useMemo(() => {
    if (loading || !data) return null;
    
    // 1. Students Learning
    let gpStudents = 0;
    let evoStudents = 0;
    
    // GP
    const gpTab = data['students_gp'];
    if (gpTab) {
      const gpSheetObj = Object.values(gpTab.sheets).find(s => s.sheet.name.toLowerCase() === 'гп студенты');
      if (gpSheetObj) {
        const mx = gpSheetObj.matrix;
        const headerRow = mx[0] || [];
        const statCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'статус');
        if (statCol > -1) {
          gpStudents = mx.slice(1).filter(row => String(row[statCol] || '').trim().toLowerCase() === 'учится').length;
        }
      }
    }
    
    // Evo
    const evoTab = data['students_evo'];
    if (evoTab) {
      const evoSheetObj = Object.values(evoTab.sheets).find(s => s.sheet.name.toLowerCase() === 'студенты');
      if (evoSheetObj) {
        const mx = evoSheetObj.matrix;
        const headerRow = mx[0] || [];
        const statCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'статус');
        if (statCol > -1) {
          evoStudents = mx.slice(1).filter(row => String(row[statCol] || '').trim().toLowerCase() === 'учится').length;
        }
      }
    }

    // 2. Activities this month
    let activitiesTotal = 0;
    let activitiesCall = 0;
    const monthsRu = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const currentMonthRu = monthsRu[new Date().getMonth()];
    
    const gteTab = data['gte_report'];
    if (gteTab) {
      const gteSheetObj = Object.values(gteTab.sheets).find(s => s.sheet.name.trim().toLowerCase() === 'активности внутри программ');
      if (gteSheetObj) {
        const mx = gteSheetObj.matrix;
        const headerRow = mx[0] || [];
        const periodCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'период');
        const countCol = headerRow.findIndex(c => String(c).trim().toLowerCase().includes('кол-во'));
        const typeCol = headerRow.findIndex(c => String(c).trim().toLowerCase().includes('тип активности'));
        
        if (periodCol > -1 && countCol > -1) {
          mx.slice(1).forEach(row => {
            if (String(row[periodCol] || '').trim().toLowerCase() === currentMonthRu) {
              const valStr = String(row[countCol] || '').replace(/,/g, '.');
              const count = parseFloat(valStr) || 0;
              activitiesTotal += count;
              if (typeCol > -1 && String(row[typeCol] || '').trim().toLowerCase().includes('созвон')) {
                activitiesCall += count;
              }
            }
          });
        }
      }
    }

    // 3. Average mentor rating
    let avgRating = 0;
    let ratingMonthName = 'Нет данных';
    const osTab = data['os_calls'];
    if (osTab) {
      // Find latest month sheet that has data
      const monthIndices = Object.values(osTab.sheets)
        .map(s => ({ sheet: s, idx: monthsRu.indexOf(s.sheet.name.trim().toLowerCase()) }))
        .filter(x => x.idx > -1 && x.sheet.matrix.length > 1) // has data
        .sort((a, b) => b.idx - a.idx); // descending
        
      if (monthIndices.length > 0) {
        const latestSheetObj = monthIndices[0].sheet;
        ratingMonthName = latestSheetObj.sheet.name;
        const mx = latestSheetObj.matrix;
        const headerRow = mx[0] || [];
        
        // Find rating columns
        const ratingCols: number[] = [];
        headerRow.forEach((h, c) => {
          const lowerH = String(h).toLowerCase();
          if (lowerH.includes('оценка ментору за') || lowerH.includes('оценка компетентности')) {
            ratingCols.push(c);
          }
        });
        
        if (ratingCols.length > 0) {
          let sum = 0;
          let count = 0;
          mx.slice(1).forEach(row => {
            ratingCols.forEach(c => {
              const val = row[c];
              if (val !== undefined && val !== null && val !== '') {
                const num = parseFloat(String(val).replace(/,/g, '.'));
                if (!isNaN(num)) {
                  sum += num;
                  count++;
                }
              }
            });
          });
          if (count > 0) {
            avgRating = sum / count;
          }
        }
      }
    }

    // 4. Upcoming events
    let upcomingEvents: any[] = [];
    const webTab = data['webinars'];
    if (webTab) {
      const webSheetObj = Object.values(webTab.sheets).find(s => s.sheet.name.trim().toLowerCase() === 'лист1');
      if (webSheetObj) {
        const mx = webSheetObj.matrix;
        const headerRow = mx[0] || [];
        const dateCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'дата вебинара');
        const timeCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'время');
        const topicCol = headerRow.findIndex(c => String(c).trim().toLowerCase() === 'тема');
        const presenterCol = headerRow.findIndex(c => String(c).trim().toLowerCase().includes('кто ведет'));
        
        if (dateCol > -1) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          mx.forEach((row, rIdx) => {
            if (rIdx === 0) return;
            const dateStr = String(row[dateCol] || '').trim();
            // Try parse DD.MM.YYYY or YYYY-MM-DD
            let evDate: Date | null = null;
            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
               const [y, m, d] = dateStr.split(' ')[0].split('-');
               evDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
            } else if (/^\d{2}\.\d{2}\.\d{4}/.test(dateStr)) {
               const [d, m, y] = dateStr.split(' ')[0].split('.');
               evDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
            }
            
            if (evDate && evDate >= today) {
              upcomingEvents.push({
                rowIdx: rIdx,
                dateObj: evDate,
                dateText: dateStr,
                time: timeCol > -1 ? String(row[timeCol] || '') : '',
                topic: topicCol > -1 ? String(row[topicCol] || '') : '',
                presenter: presenterCol > -1 ? String(row[presenterCol] || '') : ''
              });
            }
          });
          
          upcomingEvents.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
          upcomingEvents = upcomingEvents.slice(0, 10);
        }
      }
    }

    return {
      gpStudents,
      evoStudents,
      activitiesTotal,
      activitiesCall,
      avgRating,
      ratingMonthName,
      upcomingEvents
    };
  }, [data, loading]);

  const searchResults = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 3 || !data) return [];
    
    const results: any[] = [];
    const q = debouncedSearch.toLowerCase();
    
    Object.values(data).forEach(tabObj => {
      Object.values(tabObj.sheets).forEach(sheetObj => {
        const mx = sheetObj.matrix;
        if (!mx || mx.length === 0) return;
        const headerRow = mx[0] || [];
        
        // Find priority columns
        const priorityCols = new Set<number>();
        headerRow.forEach((h, c) => {
          const lowerH = String(h).toLowerCase();
          if (lowerH.includes('фио') || lowerH.includes('почта')) {
            priorityCols.add(c);
          }
        });
        
        mx.forEach((row, rIdx) => {
          if (rIdx === 0) return;
          let matchCol = -1;
          let isPriority = false;
          
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] || '').toLowerCase();
            if (val.includes(q)) {
              matchCol = c;
              if (priorityCols.has(c)) {
                isPriority = true;
                break;
              }
            }
          }
          
          if (matchCol > -1) {
            // Context: Name or Email or just matched value
            let contextStr = String(row[matchCol] || '');
            for (const pc of Array.from(priorityCols)) {
              if (row[pc] && pc !== matchCol) {
                contextStr = `${String(row[pc])} (${contextStr})`;
                break;
              }
            }
            
            results.push({
              tabId: tabObj.tab.id,
              tabName: tabObj.tab.name,
              sheetId: sheetObj.sheet.id,
              sheetName: sheetObj.sheet.name,
              rowIdx: rIdx,
              context: contextStr,
              isPriority
            });
          }
        });
      });
    });
    
    results.sort((a, b) => (a.isPriority === b.isPriority ? 0 : a.isPriority ? -1 : 1));
    return results.slice(0, 50);
  }, [debouncedSearch, data]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Загрузка данных для главной...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fa] overflow-y-auto p-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded shadow-sm border border-slate-200 p-5 flex flex-col">
            <div className="flex items-center text-slate-500 mb-2">
              <Users className="w-4 h-4 mr-2" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Студентов учится</h3>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {metrics?.gpStudents! + metrics?.evoStudents!}
            </div>
            <div className="text-xs font-medium text-slate-500 space-y-1 mt-auto">
              <div>ГП: <span className="text-slate-700 font-semibold">{metrics?.gpStudents}</span></div>
              <div>Эволюция: <span className="text-slate-700 font-semibold">{metrics?.evoStudents}</span></div>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border border-slate-200 p-5 flex flex-col">
            <div className="flex items-center text-slate-500 mb-2">
              <Activity className="w-4 h-4 mr-2" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Активности в этом мес.</h3>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {metrics?.activitiesTotal}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-auto">
              Из них созвонов: <span className="text-slate-700 font-semibold">{metrics?.activitiesCall}</span>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border border-slate-200 p-5 flex flex-col">
            <div className="flex items-center text-slate-500 mb-2">
              <Star className="w-4 h-4 mr-2" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Ср. оценка менторов</h3>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {metrics?.avgRating ? metrics.avgRating.toFixed(2) : '-'}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-auto">
              За месяц: <span className="text-slate-700 font-semibold">{metrics?.ratingMonthName}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Events */}
          <div className="bg-white rounded shadow-sm border border-slate-200 p-5 flex flex-col">
             <div className="flex items-center text-slate-800 mb-4 pb-2 border-b border-slate-100">
               <Calendar className="w-5 h-5 mr-2 text-blue-500" />
               <h3 className="text-base font-bold">Ближайшие события</h3>
             </div>
             
             <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '300px' }}>
               {metrics?.upcomingEvents && metrics.upcomingEvents.length > 0 ? (
                 <div className="space-y-3">
                   {metrics.upcomingEvents.map((ev, i) => {
                     const dStr = ev.dateText; // e.g. 2023-10-12
                     const displayDate = dStr.includes('-') ? dStr.split('-').reverse().slice(0,2).join('.') : dStr.split('.').slice(0,2).join('.');
                     return (
                       <div 
                         key={i} 
                         onClick={() => setActiveTabAndSheet('webinars', 'Лист1', ev.rowIdx)} // Need sheetId! 'webinars' tab, 'Лист1' sheet name.
                         className="flex items-start p-2 rounded hover:bg-slate-50 cursor-pointer group transition-colors"
                       >
                         <div className="w-16 shrink-0 text-center mr-3 bg-blue-50 rounded p-1">
                           <div className="text-xs font-bold text-blue-700">{displayDate}</div>
                           <div className="text-[10px] text-blue-500 font-mono">{ev.time || '--:--'}</div>
                         </div>
                         <div className="flex-1">
                           <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{ev.topic || 'Без темы'}</div>
                           <div className="text-xs text-slate-500 mt-0.5">{ev.presenter}</div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="text-sm text-slate-500 italic py-4 text-center">Ближайших вебинаров нет</div>
               )}
             </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded shadow-sm border border-slate-200 p-5 flex flex-col">
             <div className="flex items-center text-slate-800 mb-4 pb-2 border-b border-slate-100">
               <Search className="w-5 h-5 mr-2 text-blue-500" />
               <h3 className="text-base font-bold">Поиск студента</h3>
             </div>
             
             <div className="mb-4">
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Введите от 3 символов (ФИО, почта)..." 
                 className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
               />
             </div>
             
             <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '245px' }}>
               {debouncedSearch.length < 3 ? (
                 <div className="text-sm text-slate-400 text-center py-4">Начните вводить запрос для поиска по всем вкладкам</div>
               ) : searchResults.length > 0 ? (
                 <div className="space-y-2">
                   {searchResults.map((res, i) => (
                     <div 
                       key={i}
                       onClick={() => setActiveTabAndSheet(res.tabId, res.sheetId, res.rowIdx)}
                       className="p-2 border border-slate-100 rounded hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                     >
                       <div className="text-sm font-semibold text-slate-800">{res.context}</div>
                       <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">
                         {res.tabName} &rarr; {res.sheetName} (строка {res.rowIdx + 1})
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-sm text-slate-500 text-center py-4">Ничего не найдено</div>
               )}
             </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
