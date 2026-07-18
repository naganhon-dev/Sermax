import { useState } from 'react';
import { ImportManifest, ImportTabFile, CellValue } from '../types';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../firebase';

export default function ImportScreen({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: FileList) => {
    setLoading(true);
    setProgress(0);

    try {
      const fileMap = new Map<string, File>();
      for (let i = 0; i < files.length; i++) {
        fileMap.set(files[i].name, files[i]);
      }

      const manifestFile = fileMap.get('manifest.json');
      if (!manifestFile) throw new Error("manifest.json not found");

      const manifest: ImportManifest = JSON.parse(await manifestFile.text());
      let totalOps = 1; // manifest
      
      const tabDataList: ImportTabFile[] = [];
      for (const tabId of manifest.order) {
        const file = fileMap.get(`${tabId}.json`);
        if (file) {
          const tabData: ImportTabFile = JSON.parse(await file.text());
          tabDataList.push(tabData);
          totalOps += 1; // tab doc
          for (const sheet of tabData.sheets) {
            totalOps += 1; // sheet doc
            totalOps += Math.ceil(sheet.rows.length / 100); // chunks
          }
        }
      }

      let currentOp = 0;
      
      for (let tIndex = 0; tIndex < tabDataList.length; tIndex++) {
        const tab = tabDataList[tIndex];
        const tabRef = doc(db, 'tabs', tab.tabId);
        
        // Write tab
        let batch = writeBatch(db);
        batch.set(tabRef, { name: tab.tabName, order: tIndex });
        
        let batchSize = 1;

        for (let sIndex = 0; sIndex < tab.sheets.length; sIndex++) {
          const sheet = tab.sheets[sIndex];
          const sheetRef = doc(db, `tabs/${tab.tabId}/sheets`, sheet.id);
          
          const chunkCount = Math.ceil(sheet.rows.length / 100);
          
          batch.set(sheetRef, {
            name: sheet.name,
            hidden: sheet.hidden || false,
            order: sIndex,
            merges: sheet.merges || [],
            colWidths: sheet.colWidths || {},
            chunkCount
          });
          batchSize++;

          for (let c = 0; c < chunkCount; c++) {
            const start = c * 100;
            const end = start + 100;
            const chunkRows = sheet.rows.slice(start, end);
            
            const chunkRef = doc(db, `tabs/${tab.tabId}/sheets/${sheet.id}/chunks`, c.toString());
            batch.set(chunkRef, { start, data: JSON.stringify(chunkRows) });
            batchSize++;

            if (batchSize >= 400) {
              await batch.commit();
              currentOp += batchSize;
              setProgress(Math.round((currentOp / totalOps) * 100));
              batch = writeBatch(db);
              batchSize = 0;
            }
          }
        }
        
        if (batchSize > 0) {
          await batch.commit();
          currentOp += batchSize;
          setProgress(Math.round((currentOp / totalOps) * 100));
        }
      }

      onDone();

    } catch (e: any) {
      alert("Error importing: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl shadow border border-gray-200 p-8 m-8">
      <h2 className="text-2xl font-semibold mb-4">Импорт данных</h2>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        В базе данных нет вкладок. Пожалуйста, выделите 9 JSON-файлов (manifest.json и 8 файлов вкладок) и перетащите их сюда.
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
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full max-w-lg h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Нажмите для загрузки</span> или перетащите файлы</p>
            <p className="text-xs text-gray-500">JSON файлы импорта</p>
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
