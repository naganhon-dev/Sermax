import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { TabData, SheetData, CellValue } from '../types';

export interface GlobalData {
  [tabId: string]: {
    tab: TabData;
    sheets: {
      [sheetId: string]: {
        sheet: SheetData;
        matrix: CellValue[][];
      }
    }
  }
}

export function useGlobalData() {
  const [data, setData] = useState<GlobalData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const state: GlobalData = {};

    const triggerUpdate = () => {
      setData({ ...state });
    };

    const tabsUnsub = onSnapshot(query(collection(db, 'tabs'), orderBy('order')), (tabsSnap) => {
      tabsSnap.docs.forEach(tabDoc => {
        const tabId = tabDoc.id;
        if (!state[tabId]) {
          state[tabId] = { tab: { id: tabId, ...tabDoc.data() } as TabData, sheets: {} };
          
          const sheetsUnsub = onSnapshot(query(collection(db, `tabs/${tabId}/sheets`), orderBy('order')), (sheetsSnap) => {
            sheetsSnap.docs.forEach(sheetDoc => {
              const sheetId = sheetDoc.id;
              const sheetData = { id: sheetId, ...sheetDoc.data() } as SheetData;
              
              if (!state[tabId].sheets[sheetId]) {
                state[tabId].sheets[sheetId] = { sheet: sheetData, matrix: [] };
                
                // Subscribe to chunks
                const chunkCount = sheetData.chunkCount || 0;
                let chunksMap = new Map<string, any>();
                
                for (let i = 0; i < chunkCount; i++) {
                  const chunkUnsub = onSnapshot(doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, i.toString()), (chunkSnap) => {
                    if (chunkSnap.exists()) {
                      chunksMap.set(i.toString(), chunkSnap.data());
                    } else {
                      chunksMap.set(i.toString(), { data: '[]' });
                    }
                    
                    if (chunksMap.size === chunkCount) {
                      const allRows: CellValue[][] = [];
                      for (let j = 0; j < chunkCount; j++) {
                        const chunk = chunksMap.get(j.toString());
                        if (chunk) {
                          allRows.push(...JSON.parse(chunk.data));
                        }
                      }
                      state[tabId].sheets[sheetId].matrix = allRows;
                      triggerUpdate();
                    }
                  });
                  unsubs.push(chunkUnsub);
                }
                if (chunkCount === 0) {
                  triggerUpdate();
                }
              } else {
                state[tabId].sheets[sheetId].sheet = sheetData;
                triggerUpdate();
              }
            });
          });
          unsubs.push(sheetsUnsub);
        } else {
          state[tabId].tab = { id: tabId, ...tabDoc.data() } as TabData;
          triggerUpdate();
        }
      });
      setLoading(false);
    });
    unsubs.push(tabsUnsub);

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  return { data, loading };
}
