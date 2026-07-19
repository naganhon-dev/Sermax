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
  const [isCalculating, setIsCalculating] = useState(false);
  
  const hfRef = useRef<HyperFormula | null>(null);
  const [hfVersion, setHfVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sheetMatricesRef = useRef<Record<string, CellValue[][]>>({});
  const chunkHashesRef = useRef<Record<string, Record<string, string>>>({}); // tabId_sheetId -> chunkId -> hash

  useEffect(() => {
    if (!tabId) return;
    setLoading(true);
    let unsubChunks: (() => void)[] = [];
    let isMounted = true;

    const init = async () => {
      try {
        const qSheets = query(collection(db, `tabs/${tabId}/sheets`), orderBy('order'));
        const snapSheets = await getDocs(qSheets);
        const sData: SheetData[] = [];
        snapSheets.forEach(d => sData.push({ id: d.id, ...d.data() } as SheetData));
        if (!isMounted) return;
        setSheets(sData);

        const allMatrices: Record<string, CellValue[][]> = {};
        const hashes: Record<string, Record<string, string>> = {};
        
        for (const sheet of sData) {
          const matrix: CellValue[][] = [];
          hashes[sheet.id] = {};
          for (let c = 0; c < sheet.chunkCount; c++) {
            const snap = await getDocs(query(collection(db, `tabs/${tabId}/sheets/${sheet.id}/chunks`)));
            snap.forEach(chunkDoc => {
               const chunk = chunkDoc.data() as ChunkData;
               hashes[sheet.id][chunkDoc.id] = chunk.data;
               const parsed = JSON.parse(chunk.data);
               for(let i = 0; i < parsed.length; i++) {
                 matrix[chunk.start + i] = parsed[i];
               }
            });
          }
          for(let i=0; i<matrix.length; i++) {
            if (!matrix[i]) matrix[i] = [];
          }
          allMatrices[sheet.id] = matrix;
        }

        if (!isMounted) return;
        sheetMatricesRef.current = allMatrices;
        chunkHashesRef.current = hashes;
        setLoading(false); // UI can render now with raw cached values

        setIsCalculating(true);
        // Defer HF initialization to not block the main thread immediately
        setTimeout(() => {
          if (!isMounted) return;
          const hf = HyperFormula.buildEmpty({
            licenseKey: 'gpl-v3',
            dateFormats: ['DD.MM.YYYY', 'YYYY-MM-DD', 'YYYY-MM-DD hh:mm'],
            localeLang: 'ru'
          });

          for (const sheet of sData) {
            hf.addSheet(sheet.name);
            const sheetId = hf.getSheetId(sheet.name);
            if (sheetId !== undefined) {
               const hfData = allMatrices[sheet.id].map(row => 
                 row.map(cell => {
                   if (cell && typeof cell === 'object' && 'f' in cell) {
                     return cell.f;
                   }
                   return cell;
                 })
               );
               hf.setSheetContent(sheetId, hfData);
            }
          }
          
          hfRef.current = hf;
          setHfVersion(v => v + 1);
          setIsCalculating(false);

          // Setup real-time listeners for chunks after HF is ready
          for (const sheet of sData) {
             unsubChunks.push(
               onSnapshot(collection(db, `tabs/${tabId}/sheets/${sheet.id}/chunks`), (snapshot) => {
                 let changed = false;
                 snapshot.docChanges().forEach(change => {
                   if (change.type === 'modified' || change.type === 'added') {
                      const chunk = change.doc.data() as ChunkData;
                      
                      // Skip if this change matches our local state (we wrote it)
                      if (chunkHashesRef.current[sheet.id]?.[change.doc.id] === chunk.data) {
                        return;
                      }
                      
                      // Update hash
                      if (!chunkHashesRef.current[sheet.id]) chunkHashesRef.current[sheet.id] = {};
                      chunkHashesRef.current[sheet.id][change.doc.id] = chunk.data;

                      const parsed = JSON.parse(chunk.data);
                      const sheetIdHf = hfRef.current?.getSheetId(sheet.name);
                      
                      for (let i = 0; i < parsed.length; i++) {
                        const rowIndex = chunk.start + i;
                        if (!sheetMatricesRef.current[sheet.id][rowIndex]) {
                           sheetMatricesRef.current[sheet.id][rowIndex] = [];
                        }
                        sheetMatricesRef.current[sheet.id][rowIndex] = parsed[i];
                        
                        if (sheetIdHf !== undefined) {
                          const rowHfData = parsed[i].map((c: any) => (c && typeof c === 'object' && 'f' in c) ? c.f : c);
                          for(let col = 0; col < rowHfData.length; col++) {
                             hfRef.current?.setCellContents({ sheet: sheetIdHf, col, row: rowIndex }, [[rowHfData[col]]]);
                          }
                          changed = true;
                        }
                      }
                   }
                 });
                 if (changed) setHfVersion(v => v + 1);
               })
             );
          }
        }, 50);

      } catch(err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      unsubChunks.forEach(u => u());
    };
  }, [tabId]);

  const updateCell = async (sheetId: string, sheetName: string, row: number, col: number, value: any) => {
    if (!hfRef.current) return;
    
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;
    hfRef.current.setCellContents({ sheet: hfSheetId, col, row }, [[value]]);
    setHfVersion(v => v + 1);

    if (!sheetMatricesRef.current[sheetId][row]) {
      sheetMatricesRef.current[sheetId][row] = [];
    }
    
    let cellObj: CellValue = value;
    if (typeof value === 'string' && value.startsWith('=')) {
       cellObj = { f: value, v: hfRef.current.getCellValue({ sheet: hfSheetId, col, row }) };
    }
    sheetMatricesRef.current[sheetId][row][col] = cellObj;

    const chunkIndex = Math.floor(row / 100);
    const chunkStart = chunkIndex * 100;
    const chunkData = sheetMatricesRef.current[sheetId].slice(chunkStart, chunkStart + 100);
    for(let i=0; i<chunkData.length; i++) {
       if(!chunkData[i]) chunkData[i] = [];
    }
    
    try {
      const dataStr = JSON.stringify(chunkData);
      // Pre-update hash to ignore local echo
      if (!chunkHashesRef.current[sheetId]) chunkHashesRef.current[sheetId] = {};
      chunkHashesRef.current[sheetId][chunkIndex.toString()] = dataStr;

      const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, chunkIndex.toString());
      await updateDoc(chunkRef, { data: dataStr });
    } catch(err) {
      console.error("Failed to save chunk", err);
    }
  };

  const addRow = async (sheetId: string, sheetName: string) => {
    if (!hfRef.current) return;
    
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;

    const currentRows = sheetMatricesRef.current[sheetId] || [];
    const newRowIndex = currentRows.length;
    
    hfRef.current.setCellContents({ sheet: hfSheetId, col: 0, row: newRowIndex }, [['']]);
    setHfVersion(v => v + 1);

    if (!sheetMatricesRef.current[sheetId]) {
      sheetMatricesRef.current[sheetId] = [];
    }
    sheetMatricesRef.current[sheetId][newRowIndex] = [];

    const chunkIndex = Math.floor(newRowIndex / 100);
    const chunkStart = chunkIndex * 100;
    const chunkData = sheetMatricesRef.current[sheetId].slice(chunkStart, chunkStart + 100);
    for(let i=0; i<chunkData.length; i++) {
       if(!chunkData[i]) chunkData[i] = [];
    }
    
    try {
      const dataStr = JSON.stringify(chunkData);
      if (!chunkHashesRef.current[sheetId]) chunkHashesRef.current[sheetId] = {};
      chunkHashesRef.current[sheetId][chunkIndex.toString()] = dataStr;

      const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, chunkIndex.toString());
      await updateDoc(chunkRef, { data: dataStr });
      
      const currentSheet = sheets.find(s => s.id === sheetId);
      if (currentSheet && chunkIndex >= currentSheet.chunkCount) {
         await updateDoc(doc(db, `tabs/${tabId}/sheets`, sheetId), { chunkCount: chunkIndex + 1 });
      }
    } catch(err) {
      console.error("Failed to save new row chunk", err);
    }
  };

  return { sheets, loading, isCalculating, error, hf: hfRef.current, hfVersion, sheetMatrices: sheetMatricesRef.current, updateCell, addRow };
}
