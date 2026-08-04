import { useState, useMemo } from 'react';
import { useCollection } from '../lib/useCollection';
import { Search, Users, Activity, Star } from 'lucide-react';
import { canonStatus } from '../lib/status';
import { getWebinarField, toIsoDate, formatDateDisplay } from './WebinarsTab';

export default function HomeTab({ onStudentClick }: { onStudentClick: (s: any) => void }) {
  const { data: students } = useCollection('students');
  const { data: activities } = useCollection('activities');
  const { data: reviews } = useCollection('os_reviews');
  const { data: webinars } = useCollection('webinar_events');

  const [search, setSearch] = useState('');

  const studyingCount = useMemo(() => students.filter(s => canonStatus(s['Статус']).includes('Учится')).length, [students]);
  
  const currentMonthActivities = useMemo(() => {
     // Usually period is something like "Октябрь 2026" or similar. We just count latest.
     // Let's just find the latest period that has activities.
     const periods = Array.from(new Set(activities.map(a => a['Период']).filter(Boolean))).sort().reverse();
     if (periods.length === 0) return 0;
     const latest = periods[0];
     return activities.filter(a => a['Период'] === latest).length;
  }, [activities]);

  const avgScore = useMemo(() => {
     if (reviews.length === 0) return '—';
     // In original app, os_reviews have "Оценка ментору за ..." 6 columns.
     // If we just take average of whatever is there
     let sum = 0;
     let cnt = 0;
     reviews.forEach(r => {
        ['Оценка ментору 1', 'Оценка ментору 2'].forEach(k => { // example keys
           const v = Number(r[k]);
           if (!isNaN(v) && v > 0) { sum+=v; cnt++; }
        });
     });
     return cnt > 0 ? (sum/cnt).toFixed(2) : '—';
  }, [reviews]);

  const upcomingWebinars = useMemo(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      let list = webinars.filter(e => {
        const d = toIsoDate(getWebinarField(e, 'date'));
        return d && d >= todayStr;
      });
      list.sort((a,b) => toIsoDate(getWebinarField(a, 'date')).localeCompare(toIsoDate(getWebinarField(b, 'date'))));
      return list.slice(0, 5);
  }, [webinars]);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return students.filter(s => {
      const f = String(s['ФИО']||'').toLowerCase();
      const e = String(s['Почта']||'').toLowerCase();
      const p = String(s['Телефон']||'').toLowerCase();
      return f.includes(q) || e.includes(q) || p.includes(q);
    }).slice(0, 5);
  }, [search, students]);

  return (
    <div className="flex flex-col h-full bg-slate-50 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* Search */}
        <div className="relative">
          <div className="relative bg-white rounded-xl shadow-sm border border-gray-200 flex items-center p-2">
            <Search className="w-6 h-6 text-gray-400 ml-2" />
            <input 
              placeholder="Глобальный поиск студентов (ФИО, почта, телефон)..." 
              className="flex-1 text-lg px-4 py-2 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-10 overflow-hidden">
               {searchResults.length > 0 ? searchResults.map(s => (
                 <div key={s.id} onClick={() => onStudentClick(s)} className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between items-center">
                   <div>
                     <div className="font-bold">{s['ФИО']}</div>
                     <div className="text-sm text-gray-500">{s['Почта']} • {s['Телефон']}</div>
                   </div>
                   <div className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">{canonStatus(s['Статус'])}</div>
                 </div>
               )) : <div className="p-4 text-gray-500">Ничего не найдено</div>}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg text-green-600"><Users className="w-8 h-8"/></div>
            <div>
              <div className="text-3xl font-bold text-gray-800">{studyingCount}</div>
              <div className="text-sm text-gray-500 font-medium">Студентов учится</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Activity className="w-8 h-8"/></div>
            <div>
              <div className="text-3xl font-bold text-gray-800">{currentMonthActivities}</div>
              <div className="text-sm text-gray-500 font-medium">Активности за мес.</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-center space-x-4">
            <div className="bg-amber-100 p-3 rounded-lg text-amber-600"><Star className="w-8 h-8"/></div>
            <div>
              <div className="text-3xl font-bold text-gray-800">{avgScore}</div>
              <div className="text-sm text-gray-500 font-medium">Ср. оценка менторов</div>
            </div>
          </div>
        </div>

        {/* Webinars */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-lg text-gray-800">Ближайшие вебинары</h3>
          </div>
          <div>
            {upcomingWebinars.map(w => {
              const topicStr = getWebinarField(w, 'topic');
              const dateStr = formatDateDisplay(getWebinarField(w, 'date'));
              const timeStr = getWebinarField(w, 'time');
              const hostStr = getWebinarField(w, 'host');
              const linkStr = getWebinarField(w, 'linkStudents');

              return (
                <div key={w.id} className="px-6 py-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
                   <div>
                     <div className="font-bold text-gray-800">{topicStr}</div>
                     <div className="text-sm text-gray-500 mt-1">{dateStr} {timeStr ? `в ${timeStr}` : ''} • Ведущий: {hostStr || '—'}</div>
                   </div>
                   {linkStr && (
                     <a
                       href={linkStr.startsWith('http') ? linkStr : `https://${linkStr}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                     >
                       Войти
                     </a>
                   )}
                </div>
              );
            })}
            {upcomingWebinars.length === 0 && <div className="p-6 text-gray-500">Нет ближайших вебинаров</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
