const fs = require('fs');
let content = fs.readFileSync('src/lib/hfStore.ts', 'utf8');

// Export undo/redo
content = content.replace(/export function useTabEngine\(tabId: string\) \{/, `
type Action = { sheetId: string; changes: {r: number, c: number, oldVal: any, newVal: any}[] };
const undoStack: Action[] = [];
const redoStack: Action[] = [];

export function useTabEngine(tabId: string) {
`);

const methods = `
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
       const chunkRef = doc(db, \`tabs/\${tabId}/sheets/\${sheetId}/chunks\`, chunkIdxStr);
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
`;
// Add methods
content = content.replace(/const updateCell = async /, methods + "\n  const updateCell = async ");

// Replace batch update return
content = content.replace(/updateCell, addRow \};/, "updateCell, batchUpdate, undo, redo, addRow };");

fs.writeFileSync('src/lib/hfStore.ts', content);
