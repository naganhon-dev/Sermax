import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SheetData, ChunkData, CellValue, RowData } from '../types';
import { getCellsFromRow } from './gridUtils';
import { HyperFormula } from 'hyperformula';
import ruRU from 'hyperformula/i18n/languages/ruRU';

HyperFormula.registerLanguage('ru', ruRU);


type Action = { sheetId: string; changes: {r: number, c: number, oldVal: any, newVal: any}[] };
const undoStack: Action[] = [];
const redoStack: Action[] = [];

export function useTabEngine(tabId: string) {

  const [sheets, setSheets] = useState<SheetData[]>([]);

  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  
  const hfRef = useRef<HyperFormula | null>(null);
  const [hfVersion, setHfVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sheetMatricesRef = useRef<Record<string, RowData[]>>({});
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

        const allMatrices: Record<string, RowData[]> = {};
        const hashes: Record<string, Record<string, string>> = {};
        
        for (const sheet of sData) {
          const matrix: RowData[] = [];
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
                 getCellsFromRow(row).map(cell => {
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
                          const cells = getCellsFromRow(parsed[i]);
                          const rowHfData = cells.map((c: any) => (c && typeof c === 'object' && 'f' in c) ? c.f : c);
((c: any) => (c && typeof c === 'object' && 'f' in c) ? c.f : c);
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

  
  const batchUpdate = async (sheetId: string, sheetName: string, updates: {r: number, c: number, v: any}[], saveHistory = true) => {
    if (!hfRef.current) return;
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;

    const action: Action = { sheetId, changes: [] };
    
    // Group updates by chunk
    const chunkUpdates: Record<number, any[]> = {};
    let changed = false;

    for (const u of updates) {
       const oldVal = sheetMatricesRef.current[sheetId]?.[u.r]?.[u.c] || null;
       action.changes.push({ r: u.r, c: u.c, oldVal, newVal: u.v });
       
       hfRef.current.setCellContents({ sheet: hfSheetId, col: u.c, row: u.r }, [[u.v]]);
       changed = true;

       let rowData = sheetMatricesRef.current[sheetId][u.r];
       if (!rowData) {
         rowData = [];
         sheetMatricesRef.current[sheetId][u.r] = rowData;
       }
       
       let cellObj: CellValue = u.v;
       if (typeof u.v === 'string' && u.v.startsWith('=')) {
          cellObj = { f: u.v, v: hfRef.current.getCellValue({ sheet: hfSheetId, col: u.c, row: u.r }) };
       }
       
       const oldCells = Array.isArray(rowData) ? rowData : (rowData.c || []);
       const oldCell = oldCells[u.c];
       if (oldCell && typeof oldCell === 'object' && !Array.isArray(oldCell) && 's' in oldCell) {
          if (typeof cellObj !== 'object' || cellObj === null) {
             cellObj = { v: cellObj, s: oldCell.s };
          } else {
             cellObj.s = oldCell.s;
          }
       }
       
       if (!Array.isArray(rowData)) {
         if (!rowData.c) rowData.c = [];
         rowData.c[u.c] = cellObj;
       } else {
         rowData[u.c] = cellObj;
       }

       const chunkIndex = Math.floor(u.r / 100);
       chunkUpdates[chunkIndex] = chunkUpdates[chunkIndex] || sheetMatricesRef.current[sheetId].slice(chunkIndex * 100, chunkIndex * 100 + 100);
    }
    
    if (changed) setHfVersion(v => v + 1);
    
    if (saveHistory && action.changes.length > 0) {
      undoStack.push(action);
      redoStack.length = 0; // clear redo
    }

    // Save to firebase
    for (const chunkIdxStr of Object.keys(chunkUpdates)) {
       const chunkData = chunkUpdates[chunkIdxStr as any];
       for(let i=0; i<chunkData.length; i++) {
          if(!chunkData[i]) chunkData[i] = [];
       }
       const dataStr = JSON.stringify(chunkData);
       if (!chunkHashesRef.current[sheetId]) chunkHashesRef.current[sheetId] = {};
       chunkHashesRef.current[sheetId][chunkIdxStr] = dataStr;
       const chunkRef = doc(db, `tabs/${tabId}/sheets/${sheetId}/chunks`, chunkIdxStr);
       updateDoc(chunkRef, { data: dataStr }).catch(console.error);
    }
  };

  const undo = () => {
    const action = undoStack.pop();
    if (!action) return;
    const sheetInfo = sheets.find(s => s.id === action.sheetId);
    if (!sheetInfo) return;
    const revertUpdates = action.changes.map(c => ({r: c.r, c: c.c, v: c.oldVal}));
    redoStack.push(action);
    batchUpdate(action.sheetId, sheetInfo.name, revertUpdates, false);
  };

  const redo = () => {
    const action = redoStack.pop();
    if (!action) return;
    const sheetInfo = sheets.find(s => s.id === action.sheetId);
    if (!sheetInfo) return;
    const reapplyUpdates = action.changes.map(c => ({r: c.r, c: c.c, v: c.newVal}));
    undoStack.push(action);
    batchUpdate(action.sheetId, sheetInfo.name, reapplyUpdates, false);
  };

  const updateCell = async (sheetId: string, sheetName: string, row: number, col: number, value: any) => {
    if (!hfRef.current) return;
    
    const hfSheetId = hfRef.current.getSheetId(sheetName);
    if (hfSheetId === undefined) return;
    hfRef.current.setCellContents({ sheet: hfSheetId, col, row }, [[value]]);
    setHfVersion(v => v + 1);

    
    let rowData = sheetMatricesRef.current[sheetId][row];
    if (!rowData) {
      rowData = [];
      sheetMatricesRef.current[sheetId][row] = rowData;
    }
    
    let cellObj: CellValue = value;
    if (typeof value === 'string' && value.startsWith('=')) {
       cellObj = { f: value, v: hfRef.current.getCellValue({ sheet: hfSheetId, col, row }) };
    }
    
    // Preserve style if cell had one
    const oldCells = Array.isArray(rowData) ? rowData : (rowData.c || []);
    const oldCell = oldCells[col];
    if (oldCell && typeof oldCell === 'object' && !Array.isArray(oldCell) && 's' in oldCell) {
       if (typeof cellObj !== 'object' || cellObj === null) {
          cellObj = { v: cellObj, s: oldCell.s };
       } else {
          cellObj.s = oldCell.s;
       }
    }
    
    if (!Array.isArray(rowData)) {
      if (!rowData.c) rowData.c = [];
      rowData.c[col] = cellObj;
    } else {
      rowData[col] = cellObj;
    }


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

  return { sheets, loading, isCalculating, error, hf: hfRef.current, hfVersion, sheetMatrices: sheetMatricesRef.current, updateCell, batchUpdate, undo, redo, addRow };
}
