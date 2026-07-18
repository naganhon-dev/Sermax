import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SheetData, ChunkData, CellValue } from '../types';
import { HyperFormula } from 'hyperformula';
import ruRU from 'hyperformula/i18n/languages/ruRU';

HyperFormula.registerLanguage('ru', ruRU);

export function useTabEngine(tabId: string) {
  const [sheets, setSheets] = useState<SheetData[]>([]);

  const [loading, setLoading] = useState(true);
  const hfRef = useRef<HyperFormula | null>(null);
  const [hfVersion, setHfVersion] = useState(0); // trigger re-renders
  const [error, setError] = useState<string | null>(null);

  // Store raw matrix per sheet to diff remote changes or to render
  const sheetMatricesRef = useRef<Record<string, CellValue[][]>>({});

  useEffect(() => {
    if (!tabId) return;
    setLoading(true);
    let unsubChunks: (() => void)[] = [];

    const init = async () => {
      try {
        const qSheets = query(collection(db, `tabs/${tabId}/sheets`), orderBy('order'));
        const snapSheets = await getDocs(qSheets);
        const sData: SheetData[] = [];
        snapSheets.forEach(d => sData.push({ id: d.id, ...d.data() } as SheetData));
        setSheets(sData);

        // Fetch all chunks for all sheets initially
        const allMatrices: Record<string, CellValue[][]> = {};
        
        for (const sheet of sData) {
          const matrix: CellValue[][] = [];
          for (let c = 0; c < sheet.chunkCount; c++) {
            const snap = await getDocs(query(collection(db, `tabs/${tabId}/sheets/${sheet.id}/chunks`)));
            snap.forEach(chunkDoc => {
               const chunk = chunkDoc.data() as ChunkData;
               const parsed = JSON.parse(chunk.data);
               // Ensure matrix accommodates this chunk
               for(let i = 0; i < parsed.length; i++) {
                 matrix[chunk.start + i] = parsed[i];
               }
            });
          }
          // fill undefined rows with empty arrays
          for(let i=0; i<matrix.length; i++) {
            if (!matrix[i]) matrix[i] = [];
          }
          allMatrices[sheet.id] = matrix;
        }

        sheetMatricesRef.current = allMatrices;

        // Initialize HyperFormula
        const hf = HyperFormula.buildEmpty({
          licenseKey: 'gpl-v3',
          dateFormats: ['DD.MM.YYYY', 'YYYY-MM-DD', 'YYYY-MM-DD hh:mm'],
          localeLang: 'ru'
        });

        // Add sheets and data to HF
        for (const sheet of sData) {
          hf.addSheet(sheet.name);
          const sheetId = hf.getSheetId(sheet.name);
          if (sheetId !== undefined) {
             const hfData = allMatrices[sheet.id].map(row => 
               row.map(cell => {
                 if (cell && typeof cell === 'object' && 'f' in cell) {
                   return cell.f; // Pass formula to HF
                 }
                 return cell; // primitive
               })
             );
             hf.setSheetContent(sheetId, hfData);
          }
        }
        
        hfRef.current = hf;
        setHfVersion(v => v + 1);

        // Setup real-time listeners for chunks
        for (const sheet of sData) {
           unsubChunks.push(
             onSnapshot(collection(db, `tabs/${tabId}/sheets/${sheet.id}/chunks`), (snapshot) => {
               let changed = false;
               snapshot.docChanges().forEach(change => {
                 if (change.type === 'modified' || change.type === 'added') {
                    const chunk = change.doc.data() as ChunkData;
                    const parsed = JSON.parse(chunk.data);
                    const sheetIdHf = hfRef.current?.getSheetId(sheet.name);
                    
                    if (sheetIdHf !== undefined) {
                      for (let i = 0; i < parsed.length; i++) {
                        const rowIndex = chunk.start + i;
                        if (!sheetMatricesRef.current[sheet.id][rowIndex]) {
                           sheetMatricesRef.current[sheet.id][rowIndex] = [];
                        }
                        // Avoid complete sheet reload, just update local ref
                        sheetMatricesRef.current[sheet.id][rowIndex] = parsed[i];
                        
                        const rowHfData = parsed[i].map((c: any) => (c && typeof c === 'object' && 'f' in c) ? c.f : c);
                        for(let col = 0; col < rowHfData.length; col++) {
                           hfRef.current?.setCellContents({ sheet: sheetIdHf, col, row: rowIndex }, [[rowHfData[col]]]);
                        }
                      }
                      changed = true;
                    }
                 }
               });
               if (changed) setHfVersion(v => v + 1);
             })
           );
        }
        setLoading(false);
      } catch(err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      unsubChunks.forEach(u => u());
    };
  }, [tabId]);

  const updateCell = async (sheetId: string, sheetName: string, row: number, col: number, value: any) => {
    if (!hfRef.current) return;
    
    // 1. Update HF
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;
    hfRef.current.setCellContents({ sheet: hfSheetId, col, row }, [[value]]);
    setHfVersion(v => v + 1); // trigger re-render

    // 2. Update local matrix
    if (!sheetMatricesRef.current[sheetId][row]) {
      sheetMatricesRef.current[sheetId][row] = [];
    }
    
    // Store as formula object or primitive
    let cellObj: CellValue = value;
    if (typeof value === 'string' && value.startsWith('=')) {
       cellObj = { f: value, v: hfRef.current.getCellValue({ sheet: hfSheetId, col, row }) };
    }
    sheetMatricesRef.current[sheetId][row][col] = cellObj;

    // 3. Update chunk in Firestore
    const chunkIndex = Math.floor(row / 100);
    const chunkStart = chunkIndex * 100;
    const chunkData = sheetMatricesRef.current[sheetId].slice(chunkStart, chunkStart + 100);
    for(let i=0; i<chunkData.length; i++) {
       if(!chunkData[i]) chunkData[i] = [];
    }
    
    try {
      const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, chunkIndex.toString());
      await updateDoc(chunkRef, { data: JSON.stringify(chunkData) });
    } catch(err) {
      console.error("Failed to save chunk", err);
    }
  };

  const addRow = async (sheetId: string, sheetName: string) => {
    if (!hfRef.current) return;
    
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;

    // determine current length
    const currentRows = sheetMatricesRef.current[sheetId] || [];
    const newRowIndex = currentRows.length;
    
    // update HF
    hfRef.current.setCellContents({ sheet: hfSheetId, col: 0, row: newRowIndex }, [['']]);
    setHfVersion(v => v + 1);

    // update local
    if (!sheetMatricesRef.current[sheetId]) {
      sheetMatricesRef.current[sheetId] = [];
    }
    sheetMatricesRef.current[sheetId][newRowIndex] = [];

    // save chunk
    const chunkIndex = Math.floor(newRowIndex / 100);
    const chunkStart = chunkIndex * 100;
    const chunkData = sheetMatricesRef.current[sheetId].slice(chunkStart, chunkStart + 100);
    for(let i=0; i<chunkData.length; i++) {
       if(!chunkData[i]) chunkData[i] = [];
    }
    
    try {
      const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, chunkIndex.toString());
      await updateDoc(chunkRef, { data: JSON.stringify(chunkData) });
      
      // Update chunkCount on sheet if necessary
      const currentSheet = sheets.find(s => s.id === sheetId);
      if (currentSheet && chunkIndex >= currentSheet.chunkCount) {
         await updateDoc(doc(db, `tabs/${tabId}/sheets`, sheetId), { chunkCount: chunkIndex + 1 });
      }
    } catch(err) {
      console.error("Failed to save new row chunk", err);
    }
  };

  return { sheets, loading, error, hf: hfRef.current, hfVersion, sheetMatrices: sheetMatricesRef.current, updateCell, addRow };
}
