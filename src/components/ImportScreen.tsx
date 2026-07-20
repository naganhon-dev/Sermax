import { useState } from 'react';
import { doc, writeBatch, collection, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const FILE_NAMES = [
  'manifest.json', 'students.json', 'graduates.json', 'blacklist.json', 
  'webinars.json', 'activities.json', 'calls.json', 'call_scores.json', 
  'os_reviews.json', 'amg.json', 'archive.json'
];

const TARGET_COLLECTIONS = [
  { value: 'students', label: 'students (Студенты)' },
  { value: 'graduates', label: 'graduates (Выпускники)' },
  { value: 'blacklist', label: 'blacklist (Черный список)' },
  { value: 'calls', label: 'calls (Созвоны)' },
  { value: 'call_groups', label: 'call_groups (Группы созвонов)' },
  { value: 'call_scores', label: 'call_scores (Оценки созвонов)' },
  { value: 'os_reviews', label: 'os_reviews (Отзывы ОС)' },
  { value: 'activities', label: 'activities (Активности)' },
  { value: 'webinar_events', label: 'webinar_events (Вебинары)' },
  { value: 'webinar_themes', label: 'webinar_themes (Темы вебинаров)' },
  { value: 'amg_entries', label: 'amg_entries (AMG записи)' },
  { value: 'amg_meta', label: 'amg_meta (AMG мета)' }
];

export default function ImportScreen({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'backup' | 'single'>('backup');
  const [selectedCol, setSelectedCol] = useState('students');
  const [clearBeforeImport, setClearBeforeImport] = useState(false);

  const addLog = (msg: string) => setLog(l => [...l, msg]);

  const handleFilesBackup = async (files: FileList) => {
    setLoading(true);
    setProgress(0);
    setLog([]);

    try {
      const fileMap = new Map<string, File>();
      for (let i = 0; i < files.length; i++) {
        fileMap.set(files[i].name, files[i]);
      }

      for (const name of FILE_NAMES) {
        if (!fileMap.has(name)) {
          throw new Error(`Отсутствует файл: ${name}`);
        }
      }

      const parseJson = async (name: string) => {
        const file = fileMap.get(name)!;
        return JSON.parse(await file.text());
      };

      // Read files
      const manifest = await parseJson('manifest.json');
      const studentsData = await parseJson('students.json');
      const graduatesData = await parseJson('graduates.json');
      const blacklistData = await parseJson('blacklist.json');
      const webinarsData = await parseJson('webinars.json');
      const activitiesData = await parseJson('activities.json');
      const callsData = await parseJson('calls.json');
      const callScoresData = await parseJson('call_scores.json');
      const osReviewsData = await parseJson('os_reviews.json');
      const amgData = await parseJson('amg.json');
      const archiveData = await parseJson('archive.json');

      const totalOps = 
        (studentsData.records?.length || 0) +
        (graduatesData.records?.length || 0) +
        (blacklistData.records?.length || 0) +
        (webinarsData.records?.length || webinarsData.events?.length || 0) +
        (activitiesData.records?.length || 0) +
        (callsData.records?.length || 0) +
        (callScoresData.records?.length || 0) +
        (osReviewsData.records?.length || 0) +
        (amgData.records?.length || 0) +
        100; // rough estimate for archive and meta
      
      let currentOp = 0;

      const runBatch = async (items: any[], colName: string) => {
        let batch = writeBatch(db);
        let count = 0;
        let totalCount = 0;
        for (const item of items) {
          const id = item.id || crypto.randomUUID();
          batch.set(doc(collection(db, colName), id), item);
          count++;
          totalCount++;
          if (count >= 400) {
            await batch.commit();
            currentOp += count;
            setProgress(Math.round((currentOp / totalOps) * 100));
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
          currentOp += count;
          setProgress(Math.round((currentOp / totalOps) * 100));
        }
        addLog(`${colName}: записано ${totalCount}`);
      };

      await runBatch(studentsData.records || [], 'students');
      await runBatch(graduatesData.records || [], 'graduates');
      await runBatch(blacklistData.records || [], 'blacklist');
      
      await runBatch(webinarsData.records || webinarsData.events || [], 'webinar_events');
      if (webinarsData.themes) {
        await runBatch(webinarsData.themes, 'webinar_themes');
      }

      await runBatch(activitiesData.records || [], 'activities');
      
      await runBatch(callsData.records || [], 'calls');
      if (callsData.categories) {
        await runBatch(callsData.categories, 'call_categories');
      }

      await runBatch(callScoresData.records || [], 'call_scores');
      await runBatch(osReviewsData.records || [], 'os_reviews');
      
      await runBatch(amgData.records || [], 'amg_entries');
      if (amgData.slots) {
        await setDoc(doc(db, 'amg_meta', 'slots'), { data: amgData.slots });
        addLog(`amg_meta/slots: записано`);
      }

      // Archive parsing
      const sheets = archiveData.sheets || archiveData.records || archiveData;
      if (Array.isArray(sheets)) {
        for (const sheet of sheets) {
          const sheetId = sheet.id || crypto.randomUUID();
          await setDoc(doc(db, 'archive', sheetId), {
            name: sheet.name || sheet.tabName || 'Архив',
            colWidths: sheet.colWidths || {},
            frozenCols: sheet.frozenCols || 0,
            styles: sheet.styles || [],
            chunkCount: Math.ceil((sheet.rows?.length || 0) / 100)
          });
          
          if (sheet.rows) {
            let batch = writeBatch(db);
            let count = 0;
            const chunkCount = Math.ceil(sheet.rows.length / 100);
            for (let c = 0; c < chunkCount; c++) {
              const start = c * 100;
              const chunkRows = sheet.rows.slice(start, start + 100);
              batch.set(doc(db, `archive/${sheetId}/chunks`, c.toString()), {
                start, data: JSON.stringify(chunkRows)
              });
              count++;
              if (count >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }
            if (count > 0) await batch.commit();
          }
        }
        addLog(`archive: записано страниц - ${sheets.length}`);
      }

      addLog(`Готово!`);
      setProgress(100);
      
      setTimeout(() => {
        onDone();
      }, 2000);

    } catch (e: any) {
      alert("Ошибка при импорте: " + e.message);
      setLoading(false);
    }
  };

  const handleSingleFile = async (file: File) => {
    setLoading(true);
    setProgress(0);
    setLog([]);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let records: any[] = [];
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed && Array.isArray(parsed.records)) {
        records = parsed.records;
      } else if (parsed && typeof parsed === 'object') {
        records = [parsed];
      } else {
        throw new Error("Неверный формат JSON. Ожидался массив или объект с массивом 'records'.");
      }

      if (clearBeforeImport) {
        const confirmClear = confirm(`Вы действительно хотите удалить ВСЕ данные из коллекции "${selectedCol}" перед импортом? Это действие необратимо.`);
        if (!confirmClear) {
          addLog("Импорт отменен пользователем (очистка отклонена).");
          setLoading(false);
          return;
        }

        addLog(`Начало очистки коллекции "${selectedCol}"...`);
        const querySnapshot = await getDocs(collection(db, selectedCol));
        let deletedCount = 0;

        if (!querySnapshot.empty) {
          let batch = writeBatch(db);
          let batchCount = 0;
          for (const docSnap of querySnapshot.docs) {
            batch.delete(docSnap.ref);
            batchCount++;
            deletedCount++;
            if (batchCount >= 500) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
              addLog(`Очищено документов: ${deletedCount}`);
            }
          }
          if (batchCount > 0) {
            await batch.commit();
            addLog(`Очищено документов: ${deletedCount}`);
          }
        } else {
          addLog("Коллекция пуста. Очистка не требуется.");
        }
        addLog(`Очистка завершена. Удалено документов: ${deletedCount}`);
      }

      addLog(`Запись ${records.length} документов в "${selectedCol}"...`);

      let batch = writeBatch(db);
      let count = 0;
      let totalCount = 0;

      for (const item of records) {
        const id = item.id || crypto.randomUUID();
        const itemToSave = { ...item, id };
        batch.set(doc(collection(db, selectedCol), id), itemToSave);
        count++;
        totalCount++;

        if (count >= 400) {
          await batch.commit();
          setProgress(Math.round((totalCount / records.length) * 100));
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setProgress(100);
      addLog(`Успешно импортировано документов: ${totalCount}`);
      addLog(`Готово!`);

      setTimeout(() => {
        onDone();
      }, 2000);

    } catch (e: any) {
      alert("Ошибка при импорте: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl shadow border border-gray-200 p-8 m-8 max-w-4xl mx-auto w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Импорт данных</h2>

      {!loading && (
        <div className="flex border-b border-gray-200 mb-6 w-full max-w-lg font-sans">
          <button
            onClick={() => setImportMode('backup')}
            className={`flex-1 py-2 text-center font-medium text-sm border-b-2 transition-all ${
              importMode === 'backup'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Импорт бэкапа (11 файлов)
          </button>
          <button
            onClick={() => setImportMode('single')}
            className={`flex-1 py-2 text-center font-medium text-sm border-b-2 transition-all ${
              importMode === 'single'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Произвольный JSON
          </button>
        </div>
      )}

      {loading ? (
        <div className="w-full max-w-md font-sans">
          <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center mt-2 text-sm text-gray-600">{progress}% завершено</p>
          <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 max-h-48 overflow-auto font-mono flex flex-col gap-1">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg font-sans">
          {importMode === 'backup' ? (
            <div>
              <p className="text-gray-500 mb-6 text-center text-sm">
                Пожалуйста, выделите 11 JSON-файлов (manifest.json, students.json и т.д.) и перетащите их сюда.
              </p>
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Нажмите для загрузки</span> или перетащите файлы
                  </p>
                  <p className="text-xs text-gray-500">11 файлов JSON</p>
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept=".json"
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files) handleFilesBackup(e.target.files);
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Целевая коллекция</label>
                <select
                  value={selectedCol}
                  onChange={(e) => setSelectedCol(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 animate-none"
                >
                  {TARGET_COLLECTIONS.map(col => (
                    <option key={col.value} value={col.value}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <input
                  type="checkbox"
                  id="clear-checkbox"
                  checked={clearBeforeImport}
                  onChange={(e) => setClearBeforeImport(e.target.checked)}
                  className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="clear-checkbox" className="text-sm font-medium text-amber-950 cursor-pointer select-none">
                  Очистить коллекцию перед импортом
                </label>
              </div>

              <div>
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-1 text-sm text-gray-600">
                      <span className="font-semibold">Выберите файл</span>
                    </p>
                    <p className="text-xs text-gray-500">Произвольный JSON формата {"{records: [...]}"}</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".json"
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSingleFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
