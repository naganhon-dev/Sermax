import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, orderBy, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TabData, SheetData, ChunkData, CellValue } from '../types';

export function useTabs() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tabs'), orderBy('order'));
    const unsub = onSnapshot(q, (snapshot) => {
      const t: TabData[] = [];
      snapshot.forEach(d => t.push({ id: d.id, ...d.data() } as TabData));
      setTabs(t);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { tabs, loading };
}

export function useTabSheets(tabId: string) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabId) {
      setSheets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, `tabs/${tabId}/sheets`), orderBy('order'));
    const unsub = onSnapshot(q, (snapshot) => {
      const s: SheetData[] = [];
      snapshot.forEach(d => s.push({ id: d.id, ...d.data() } as SheetData));
      setSheets(s);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return unsub;
  }, [tabId]);

  return { sheets, loading };
}

export function useSheetData(tabId: string, sheetId: string, chunkCount: number) {
  const [rows, setRows] = useState<CellValue[][] | null>(null);

  useEffect(() => {
    if (!tabId || !sheetId || chunkCount === 0) {
      setRows(null);
      return;
    }
    
    // Subscribe to all chunks
    const unsubscribes: (() => void)[] = [];
    let chunksMap = new Map<string, ChunkData>();
    let loadedChunks = 0;

    for (let i = 0; i < chunkCount; i++) {
      const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, i.toString());
      const unsub = onSnapshot(chunkRef, (snap) => {
        if (snap.exists()) {
          const chunkData = snap.data() as ChunkData;
          chunksMap.set(i.toString(), chunkData);
        } else {
          chunksMap.set(i.toString(), { start: i * 100, data: '[]' });
        }
        
        loadedChunks++;
        // If all chunks are loaded at least once or updated
        if (chunksMap.size === chunkCount) {
          // Rebuild rows
          const allRows: CellValue[][] = [];
          for (let j = 0; j < chunkCount; j++) {
            const chunk = chunksMap.get(j.toString());
            if (chunk) {
              const parsed = JSON.parse(chunk.data);
              allRows.push(...parsed);
            }
          }
          setRows(allRows);
        }
      });
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach(u => u());
    };
  }, [tabId, sheetId, chunkCount]);

  return rows;
}
