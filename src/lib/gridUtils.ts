export function a1ToIndex(a1: string): { row: number; col: number } {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: 0, col: 0 };
  const colStr = match[1];
  const rowStr = match[2];

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  
  return { col: col - 1, row: parseInt(rowStr, 10) - 1 };
}

export function indexToA1(row: number, col: number): string {
  let dividend = col + 1;
  let colName = '';
  let modulo;

  while (dividend > 0) {
    modulo = (dividend - 1) % 26;
    colName = String.fromCharCode(65 + modulo) + colName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return colName + (row + 1);
}

export function parseMerges(merges: string[]): Record<string, { rowSpan: number, colSpan: number }> {
  const map: Record<string, { rowSpan: number, colSpan: number }> = {};
  for (const m of merges) {
    const [start, end] = m.split(':');
    if (start && end) {
      const s = a1ToIndex(start);
      const e = a1ToIndex(end);
      map[`${s.row},${s.col}`] = {
        rowSpan: e.row - s.row + 1,
        colSpan: e.col - s.col + 1
      };
    }
  }
  return map;
}

export function getExcludedCells(merges: string[]): Set<string> {
  const excluded = new Set<string>();
  for (const m of merges) {
    const [start, end] = m.split(':');
    if (start && end) {
      const s = a1ToIndex(start);
      const e = a1ToIndex(end);
      for (let r = s.row; r <= e.row; r++) {
        for (let c = s.col; c <= e.col; c++) {
          if (r === s.row && c === s.col) continue; // skip the top-left cell
          excluded.add(`${r},${c}`);
        }
      }
    }
  }
  return excluded;
}
