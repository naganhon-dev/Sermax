import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { ImportManifest, ImportTabFile, SheetData, ChunkData } from '../types';

export async function exportAllData() {
  try {
    const tabsSnap = await getDocs(query(collection(db, 'tabs'), orderBy('order')));
    const manifest: ImportManifest = { order: [] };
    const tabFiles: ImportTabFile[] = [];

    for (const tabDoc of tabsSnap.docs) {
      const tabId = tabDoc.id;
      const tabData = tabDoc.data();
      manifest.order.push(tabId);

      const tabFile: ImportTabFile = {
        tabId,
        tabName: tabData.name,
        sheets: []
      };

      const sheetsSnap = await getDocs(query(collection(db, `tabs/${tabId}/sheets`), orderBy('order')));
      for (const sheetDoc of sheetsSnap.docs) {
        const sheetId = sheetDoc.id;
        const sData = sheetDoc.data() as SheetData;
        
        const rows: any[][] = [];
        const chunksSnap = await getDocs(collection(db, `tabs/${tabId}/sheets/${sheetId}/chunks`));
        
        // sort chunks by id (which is their index 0, 1, 2)
        const chunks = chunksSnap.docs
          .map(d => ({ id: parseInt(d.id), ...d.data() } as ChunkData & { id: number }))
          .sort((a, b) => a.id - b.id);

        for (const chunk of chunks) {
          const parsed = JSON.parse(chunk.data);
          for (let i = 0; i < parsed.length; i++) {
            rows[chunk.start + i] = parsed[i];
          }
        }

        // fill undefined
        for(let i=0; i<rows.length; i++) {
           if(!rows[i]) rows[i] = [];
        }

        tabFile.sheets.push({
          id: sheetId,
          name: sData.name,
          hidden: sData.hidden,
          merges: sData.merges || [],
          colWidths: sData.colWidths || {},
          rows
        });
      }
      
      tabFiles.push(tabFile);
    }

    const exportData = {
      manifest,
      tabs: tabFiles
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_dashboard_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
  } catch (err) {
    console.error("Export failed", err);
    alert("Ошибка экспорта");
  }
}
