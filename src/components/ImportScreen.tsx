import { useState } from 'react';
import { doc, writeBatch, collection, setDoc, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TwoFactorAdminSection from './TwoFactorAdminSection';

const TARGET_COMMENT_STUDENT_IDS = [
  'e0739f7d-103f-4d5c-bd52-013263e81e8d',
  '71cfc7df-6695-4a9f-b316-65078e29f22c',
  '27acbef1-659a-48e3-8b65-66fb05b731e0',
  'e66d4b75-8237-49a0-88b3-4860d30aafc7',
  'be726518-cb02-4af7-82fa-fb69a08a9ae1',
  '396e00f6-9ea0-4f09-9aed-c328de5b6f9b',
  '9ee359ac-d165-49d2-9cab-ea28f0d4c719',
  'da37b298-49de-4b72-ba5b-1474ddb49e97',
  '3b4ed312-326c-43be-8517-1025c6742edd',
  '24730185-6243-49b9-b7d4-6d77615bae9a',
  '9dc61651-04c5-4eed-9f10-62c83249d931',
  '34aaa07f-fa8b-402e-991c-038ef9976390',
  '5335c369-bbb3-422c-9a11-bf845f6e29eb',
  '103d2e78-8bfd-47b4-8914-0a997ad5be85',
  'cd8e6875-3a7a-472b-8852-4e10ab136833',
  'c19c16d2-79b3-4694-84c6-37f88293298e',
  '137e95bf-b7ee-46e8-8bbe-438f7bf29abe',
  '46303e05-d00e-40e8-a3e1-3581005189ea',
  '506d5f61-de29-4c3b-9a1e-ff52d83d5b3c',
  '79c7f86c-d030-47a9-9e4e-20e28f7b8d15'
];

const FILE_NAMES = [
  'manifest.json', 'students.json', 'graduates.json', 'blacklist.json', 
  'webinars.json', 'activities.json', 'calls.json', 'call_scores.json', 
  'os_reviews.json', 'amg.json', 'archive.json'
];

const TARGET_COLLECTIONS = [
  { value: 'students', label: 'students (Студенты)' },
  { value: 'graduates', label: 'graduates (Выпускники)' },
  { value: 'blacklist', label: 'blacklist (Черный список)' },
  { value: 'leads', label: 'leads (Лиды)' },
  { value: 'calls', label: 'calls (Созвоны)' },
  { value: 'call_groups', label: 'call_groups (Группы созвонов)' },
  { value: 'call_scores', label: 'call_scores (Оценки созвонов)' },
  { value: 'call_categories', label: 'call_categories (Категории созвонов)' },
  { value: 'os_reviews', label: 'os_reviews (Отзывы ОС)' },
  { value: 'activities', label: 'activities (Активности)' },
  { value: 'webinar_events', label: 'webinar_events (Вебинары)' },
  { value: 'webinar_themes', label: 'webinar_themes (Темы вебинаров)' },
  { value: 'amg_entries', label: 'amg_entries (AMG записи)' },
  { value: 'amg_meta', label: 'amg_meta (AMG мета)' },
  { value: 'archive', label: 'archive (Архив)' },
  { value: 'logs', label: 'logs (Логи)' },
  { value: 'trash', label: 'trash (Корзина)' }
];

export default function ImportScreen({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'backup' | 'single' | 'clear'>('backup');
  const [selectedCol, setSelectedCol] = useState('students');
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  const addLog = (msg: string) => setLog(l => [...l, msg]);

  const isTargetDuplicate = (val: any): boolean => {
    if (!val) return false;

    // 1. If string
    if (typeof val === 'string') {
      if (val === '2026-08-06T09:29:10.055981Z') return true;
      if (val.startsWith('2026-08-06T09:29:10')) return true;
    }

    // 2. If object (Timestamp or generic date object)
    if (typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        try {
          const d = val.toDate();
          if (d instanceof Date && !isNaN(d.getTime())) {
            const iso = d.toISOString();
            if (iso.startsWith('2026-08-06T09:29:10')) return true;
          }
        } catch (e) {}
      }

      let seconds: number | null = null;
      if (val.seconds !== undefined) {
        seconds = Number(val.seconds);
      } else if (val._seconds !== undefined) {
        seconds = Number(val._seconds);
      }

      if (seconds !== null) {
        if (seconds === 1786008550) return true;
        try {
          const d = new Date(seconds * 1000);
          const iso = d.toISOString();
          if (iso.startsWith('2026-08-06T09:29:10')) return true;
        } catch (e) {}
      }

      // Fallback for custom objects or direct dates
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const iso = d.toISOString();
          if (iso.startsWith('2026-08-06T09:29:10')) return true;
        }
      } catch (e) {}
    }

    return false;
  };

  const handleTargetedCleanup = async () => {
    try {
      // Fetch documents first to analyze
      const querySnapshot = await getDocs(collection(db, 'students'));
      
      const duplicates = querySnapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        const val = data.created_at || data.createdAt;
        return isTargetDuplicate(val);
      });

      if (duplicates.length === 0) {
        alert("Поиск завершен. Найдено 0 документов, соответствующих условию. Очистка не требуется.");
        return;
      }

      // Ask for confirmation showing the exact count
      const confirmed = confirm(
        `Найдено документов для удаления: ${duplicates.length} (ожидалось 123).\n\n` +
        `Вы действительно хотите удалить эти документы? Это действие необратимо и сотрет только старую дублирующую партию.`
      );

      if (!confirmed) {
        return;
      }

      // Switch to progress logger screen
      setLoading(true);
      setProgress(0);
      setLog([]);
      addLog("Запуск точечной очистки дубликатов...");
      addLog(`Начало удаления ${duplicates.length} документов...`);

      let batch = writeBatch(db);
      let batchCount = 0;
      let deletedCount = 0;

      for (const docSnap of duplicates) {
        batch.delete(docSnap.ref);
        batchCount++;
        deletedCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          setProgress(Math.round((deletedCount / duplicates.length) * 100));
          addLog(`Удалено: ${deletedCount}/${duplicates.length}`);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      setProgress(100);
      addLog(`Точечная очистка успешно завершена! Удалено документов: ${deletedCount}`);
      
      setTimeout(() => {
        onDone();
      }, 2500);

    } catch (e: any) {
      alert("Ошибка при точечной очистке: " + e.message);
      setLoading(false);
    }
  };

  const handleTargetedCallsCleanup = async () => {
    try {
      // Fetch documents first to analyze
      const querySnapshot = await getDocs(collection(db, 'calls'));
      
      const targetDocs = querySnapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        return data.is_group === true;
      });

      if (targetDocs.length === 0) {
        alert("Поиск завершен. Найдено 0 документов, соответствующих условию. Очистка не требуется.");
        return;
      }

      // Ask for confirmation showing the exact count
      const confirmed = confirm(
        `Найдено плоских групповых созвонов для удаления: ${targetDocs.length} (ожидалось 601).\n\n` +
        `Вы действительно хотите удалить эти документы? Это действие необратимо и сотрет только плоские групповые записи с is_group === true. Индивидуальные созвоны не пострадают.`
      );

      if (!confirmed) {
        return;
      }

      // Switch to progress logger screen
      setLoading(true);
      setProgress(0);
      setLog([]);
      addLog("Запуск точечного удаления плоских групповых созвонов...");
      addLog(`Начало удаления ${targetDocs.length} документов...`);

      let batch = writeBatch(db);
      let batchCount = 0;
      let deletedCount = 0;

      for (const docSnap of targetDocs) {
        batch.delete(docSnap.ref);
        batchCount++;
        deletedCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          setProgress(Math.round((deletedCount / targetDocs.length) * 100));
          addLog(`Удалено: ${deletedCount}/${targetDocs.length}`);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      setProgress(100);
      addLog(`Точечная очистка групповых созвонов успешно завершена! Удалено документов: ${deletedCount}`);
      
      setTimeout(() => {
        onDone();
      }, 2500);

    } catch (e: any) {
      alert("Ошибка при точечной очистке созвонов: " + e.message);
      setLoading(false);
    }
  };

  const handleTargetedCommentUpdate = async () => {
    const totalCount = TARGET_COMMENT_STUDENT_IDS.length;
    const confirmed = confirm(
      `Запуск добавления пометки ("Спец условия: +2 созвона (Эксперт)") для ${totalCount} карточек студентов из списка ID.\n\n` +
      `КРИТИЧНО: Будет выполнено MERGE-обновление (изменяется ТОЛЬКО поле "Комментарий", остальные поля и статусы НЕ затронутся).\n\n` +
      `Вы действительно хотите продолжить?`
    );

    if (!confirmed) return;

    setLoading(true);
    setProgress(0);
    setLog([]);
    addLog("=== НАЧАЛО ТОЧЕЧНОГО ОБНОВЛЕНИЯ КОММЕНТАРИЕВ (20 карточек) ===");
    addLog(`Запрошена обработка ${totalCount} карточек по списку ID...`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let processed = 0;

    const NOTE = "Спец условия: +2 созвона (Эксперт)";

    try {
      for (const studentId of TARGET_COMMENT_STUDENT_IDS) {
        processed++;
        const docRef = doc(db, 'students', studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const fio = String(data['ФИО'] || data.fio || data.fio_student || 'Без ФИО').trim();
          const existingComment = String(data['Комментарий'] || data.comment || '').trim();

          if (existingComment.includes(NOTE)) {
            addLog(`[УЖЕ ЕСТЬ] ID: ${studentId} | ФИО: ${fio} — пометка уже присутствует.`);
            updatedCount++;
          } else {
            const newComment = existingComment ? `${existingComment}\n${NOTE}` : NOTE;
            // setDoc with { merge: true } updates ONLY the specified 'Комментарий' field
            await setDoc(docRef, { 'Комментарий': newComment }, { merge: true });
            addLog(`[ОБНОВЛЕНО] ID: ${studentId} | ФИО: ${fio} | Комментарий: "${newComment}"`);
            updatedCount++;
          }
        } else {
          addLog(`[НЕ НАЙДЕНО] ID: ${studentId} — карточка отсутствует в коллекции students.`);
          notFoundCount++;
        }

        setProgress(Math.round((processed / totalCount) * 100));
      }

      setProgress(100);
      const summaryMsg = `Обновлено ${updatedCount} карточек из ${totalCount}. Не найдено: ${notFoundCount}.`;
      addLog(`=== ИТОГ: ${summaryMsg} ===`);
      alert(summaryMsg);

    } catch (e: any) {
      console.error(e);
      alert("Ошибка при точечном обновлении комментариев: " + e.message);
    }
  };

  const handleClearAllData = async () => {
    if (clearConfirmText.trim() !== 'УДАЛИТЬ') {
      alert('Пожалуйста, введите слово "УДАЛИТЬ" для подтверждения.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setLog([]);

    const collectionsToClean = [
      'students',
      'calls',
      'amg_entries',
      'amg_meta',
      'call_scores',
      'os_reviews',
      'activities',
      'webinar_events',
      'webinar_themes',
      'archive',
      'logs',
      'trash',
      'graduates',
      'blacklist',
      'leads',
      'call_groups',
      'call_categories'
    ];

    let totalDeleted = 0;

    try {
      for (let i = 0; i < collectionsToClean.length; i++) {
        const colName = collectionsToClean[i];
        addLog(`Очистка коллекции: ${colName}...`);
        
        let deletedInCol = 0;
        const querySnapshot = await getDocs(collection(db, colName));

        if (!querySnapshot.empty) {
          let batch = writeBatch(db);
          let batchCount = 0;

          for (const docSnap of querySnapshot.docs) {
            if (colName === 'archive') {
              try {
                const chunksSnap = await getDocs(collection(db, 'archive', docSnap.id, 'chunks'));
                for (const chunkSnap of chunksSnap.docs) {
                  batch.delete(chunkSnap.ref);
                  batchCount++;
                  deletedInCol++;
                  if (batchCount >= 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                  }
                }
              } catch (e) {
                // ignore
              }
            }

            batch.delete(docSnap.ref);
            batchCount++;
            deletedInCol++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        }

        totalDeleted += deletedInCol;
        addLog(`  -> Удалено документов в ${colName}: ${deletedInCol}`);
        setProgress(Math.round(((i + 1) / collectionsToClean.length) * 100));
      }

      addLog(`=== ВСЕ ДАННЫЕ УСПЕШНО УДАЛЕНЫ! Всего удалено документов: ${totalDeleted} ===`);
      setProgress(100);

      setTimeout(() => {
        onDone();
      }, 2500);

    } catch (e: any) {
      alert('Ошибка при очистке данных: ' + e.message);
      setLoading(false);
    }
  };

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
          <button
            onClick={() => setImportMode('clear')}
            className={`flex-1 py-2 text-center font-medium text-sm border-b-2 transition-all ${
              importMode === 'clear'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Очистка базы
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
          <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 max-h-64 overflow-auto font-mono flex flex-col gap-1">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {progress === 100 && (
            <button
              type="button"
              onClick={() => setLoading(false)}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-semibold text-xs transition-all cursor-pointer shadow-sm"
            >
              Закрыть лог и вернуться к настройкам
            </button>
          )}
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
          ) : importMode === 'single' ? (
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
          ) : (
            <div className="flex flex-col gap-6">
              {/* Управление 2FA */}
              <TwoFactorAdminSection />

              {/* Точечная очистка */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 shadow-sm">
                <h3 className="font-bold text-base text-amber-800 mb-1">Точечная очистка: удаление дубликатов</h3>
                <p className="text-xs text-amber-700 leading-relaxed mb-4">
                  Эта функция найдет и удалит в коллекции <code className="bg-amber-100 px-1 py-0.5 rounded">students</code> только те документы, у которых поле <code className="bg-amber-100 px-1 py-0.5 rounded">created_at</code> строго равно <code className="bg-amber-100 px-1 py-0.5 rounded">"2026-08-06T09:29:10.055981Z"</code> (устаревшая партия из 123 карточек). Актуальные данные с другими датами затронуты не будут.
                </p>
                <button
                  type="button"
                  onClick={handleTargetedCleanup}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-amber-200 cursor-pointer"
                >
                  Найти и удалить дубликаты (123 карточки)
                </button>
              </div>

              {/* Точечная очистка групповых созвонов */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 shadow-sm">
                <h3 className="font-bold text-base text-amber-800 mb-1">Точечная очистка: плоские групповые созвоны</h3>
                <p className="text-xs text-amber-700 leading-relaxed mb-4">
                  Эта функция найдет и удалит в коллекции <code className="bg-amber-100 px-1 py-0.5 rounded">calls</code> только те документы, у которых поле <code className="bg-amber-100 px-1 py-0.5 rounded">is_group</code> строго равно <code className="bg-amber-100 px-1 py-0.5 rounded">true</code> (ожидается 601 запись). Индивидуальные созвоны затронуты не будут.
                </p>
                <button
                  type="button"
                  onClick={handleTargetedCallsCleanup}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-amber-200 cursor-pointer"
                >
                  Найти и удалить плоские групповые (601 запись)
                </button>
              </div>

              {/* Точечное обновление комментариев (20 карточек) */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-900 shadow-sm">
                <h3 className="font-bold text-base text-blue-800 mb-1">Точечное обновление: спец условия для 20 карточек</h3>
                <p className="text-xs text-blue-700 leading-relaxed mb-4">
                  Эта функция добавит пометку <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-semibold">"Спец условия: +2 созвона (Эксперт)"</code> в поле <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-semibold">Комментарий</code> у 20 карточек студентов по их ID из списка. Выполняется частичное MERGE-обновление (статусы и остальные поля останутся нетронутыми).
                </p>
                <button
                  type="button"
                  onClick={handleTargetedCommentUpdate}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-blue-200 cursor-pointer"
                >
                  Добавить пометку спец условий (20 карточек)
                </button>
              </div>

              <div className="h-px bg-gray-200 my-1" />

              {/* Полная очистка */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-900 shadow-sm">
                <h3 className="font-bold text-base text-red-800 mb-1">Полная очистка всех данных Firestore</h3>
                <p className="text-xs text-red-700 leading-relaxed mb-4">
                  Это действие удалит абсолютно все данные во всех коллекциях (<code className="bg-red-100 px-1 py-0.5 rounded">students</code>, <code className="bg-red-100 px-1 py-0.5 rounded">calls</code>, <code className="bg-red-100 px-1 py-0.5 rounded">amg_entries</code>, <code className="bg-red-100 px-1 py-0.5 rounded">archive</code> и др.). Убедитесь, что вы предварительно сделали экспорт бэкапа!
                </p>

                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-xs font-semibold text-gray-700">
                    Для подтверждения введите слово <span className="text-red-600 font-bold">УДАЛИТЬ</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="УДАЛИТЬ"
                    value={clearConfirmText}
                    onChange={(e) => setClearConfirmText(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm uppercase font-mono tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-800"
                  />
                </div>

                <button
                  type="button"
                  disabled={clearConfirmText.trim() !== 'УДАЛИТЬ'}
                  onClick={handleClearAllData}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${
                    clearConfirmText.trim() === 'УДАЛИТЬ'
                      ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-red-200'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Очистить все данные в базе
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
