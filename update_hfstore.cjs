const fs = require('fs');
let content = fs.readFileSync('src/lib/hfStore.ts', 'utf8');

// replace Record<string, CellValue[][]> with Record<string, RowData[]>
content = content.replace(/Record<string, CellValue\[\]\[\]>/g, 'Record<string, RowData[]>');

// replace "const matrix: CellValue[][] = [];" with "const matrix: RowData[] = [];"
content = content.replace(/const matrix: CellValue\[\]\[\] = \[\];/g, 'const matrix: RowData[] = [];');

// Add import RowData
content = content.replace(/import \{ SheetData, ChunkData, CellValue \} from '\.\.\/types';/, "import { SheetData, ChunkData, CellValue, RowData } from '../types';\nimport { getCellsFromRow } from './gridUtils';");

// Update how HF is initialized to handle RowData
content = content.replace(/const hfData = allMatrices\[sheet\.id\]\.map\(row => \n\s*row\.map/g, "const hfData = allMatrices[sheet.id].map(row => \n                 getCellsFromRow(row).map");

// Update how cell assignment is done.
// From:
// if (!sheetMatricesRef.current[sheetId][row]) {
//   sheetMatricesRef.current[sheetId][row] = [];
// }
// sheetMatricesRef.current[sheetId][row][col] = cellObj;
// To:
// let rowData = sheetMatricesRef.current[sheetId][row];
// if (!rowData) { rowData = []; sheetMatricesRef.current[sheetId][row] = rowData; }
// if (!Array.isArray(rowData)) {
//    rowData.c[col] = cellObj;
// } else {
//    rowData[col] = cellObj;
// }
const replacementAssignment = `
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
`;
content = content.replace(/if \(!sheetMatricesRef\.current\[sheetId\]\[row\]\) \{[\s\S]*?sheetMatricesRef\.current\[sheetId\]\[row\]\[col\] = cellObj;/, replacementAssignment);

// Fix chunk parsing
const chunkParsingRepl = `
                        if (sheetIdHf !== undefined) {
                          const cells = getCellsFromRow(parsed[i]);
                          const rowHfData = cells.map((c: any) => (c && typeof c === 'object' && 'f' in c) ? c.f : c);
`;
content = content.replace(/if \(sheetIdHf !== undefined\) \{\n\s*const rowHfData = parsed\[i\]\.map/g, chunkParsingRepl);

fs.writeFileSync('src/lib/hfStore.ts', content);
