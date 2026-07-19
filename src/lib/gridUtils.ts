export function parseMerges(merges: string[]) {
  const map: Record<string, { rowSpan: number, colSpan: number }> = {};
  merges.forEach(m => {
    // A1:B2 -> ...
    const [start, end] = m.split(':');
    if (!start || !end) return;
    const { row: r1, col: c1 } = a1ToIndex(start);
    const { row: r2, col: c2 } = a1ToIndex(end);
    map[`${r1},${c1}`] = { rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 };
  });
  return map;
}

export function getExcludedCells(merges: string[]) {
  const set = new Set<string>();
  merges.forEach(m => {
    const [start, end] = m.split(':');
    if (!start || !end) return;
    const { row: r1, col: c1 } = a1ToIndex(start);
    const { row: r2, col: c2 } = a1ToIndex(end);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        set.add(`${r},${c}`);
      }
    }
  });
  return set;
}

export function a1ToIndex(a1: string) {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: 0, col: 0 };
  const colStr = match[1];
  const row = parseInt(match[2], 10) - 1;
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { row, col: col - 1 };
}

export function indexToA1(row: number, col: number) {
  let dividend = col + 1;
  let colName = '';
  let modulo;
  while (dividend > 0) {
    modulo = (dividend - 1) % 26;
    colName = String.fromCharCode(65 + modulo) + colName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return `${colName}${row + 1}`;
}

import { RowData, CellValue } from '../types';

export function getCellsFromRow(row: RowData | undefined): CellValue[] {
  if (!row) return [];
  if (Array.isArray(row)) return row;
  return row.c || [];
}

export function getRowStyleIndex(row: RowData | undefined): number | undefined {
  if (!row || Array.isArray(row)) return undefined;
  return row.rs;
}

export function getCellValueAndStyle(row: RowData | undefined, colIndex: number): { value: CellValue, styleIndex?: number, rowStyleIndex?: number } {
  const rowStyleIndex = getRowStyleIndex(row);
  const cells = getCellsFromRow(row);
  const rawCell = cells[colIndex];
  
  let value: CellValue = null;
  let styleIndex = rowStyleIndex;
  
  if (rawCell !== null && rawCell !== undefined) {
    if (typeof rawCell === 'object' && !Array.isArray(rawCell) && 's' in rawCell) {
       styleIndex = rawCell.s;
       // We can extract just the value part to keep it simple, or return the rawCell
    }
    value = rawCell;
  }
  return { value, styleIndex, rowStyleIndex };
}
