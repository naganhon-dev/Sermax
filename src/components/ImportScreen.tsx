import { useState } from 'react';
import { doc, writeBatch, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const FILE_NAMES = [
  'manifest.json', 'students.json', 'graduates.json', 'blacklist.json', 
  'webinars.json', 'activities.json', 'calls.json', 'call_scores.json', 
  'os_reviews.json', 'amg.json', 'archive.json'
];

export default function ImportScreen({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const handleFiles = async (files: FileList) => {
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

      const addLog = (msg: string) => setLog(l => [...l, msg]);

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
      // archive.json might contain an array of sheets or an object with sheets
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
      alert("Error importing: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl shadow border border-gray-200 p-8 m-8">
      <h2 className="text-2xl font-semibold mb-4">Импорт данных</h2>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Пожалуйста, выделите 11 JSON-файлов (manifest.json, students.json и т.д.) и перетащите их сюда.
      </p>

      {loading ? (
        <div className="w-full max-w-md">
          <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center mt-2 text-sm text-gray-600">{progress}% завершено</p>
          <div className="mt-4 text-xs text-gray-500 max-h-32 overflow-auto">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full max-w-lg h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Нажмите для загрузки</span> или перетащите файлы</p>
            <p className="text-xs text-gray-500">11 файлов JSON</p>
          </div>
          <input 
            type="file" 
            multiple 
            accept=".json"
            className="hidden" 
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
            }}
          />
        </label>
      )}
    </div>
  );
}
