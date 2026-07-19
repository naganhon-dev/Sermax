import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SheetData, CellValue } from '../types';
import { HyperFormula, CellError } from 'hyperformula';
import { parseMerges, getExcludedCells, indexToA1 } from '../lib/gridUtils';
import { Cell } from './Cell';
import { useEvent } from '../lib/useEvent';

interface GridProps {
  sheet: SheetData;
  hf: HyperFormula | null;
  hfVersion: number;
  sheetMatrix: CellValue[][];
  onCellEdit: (row: number, col: number, value: string) => void;
  targetRowIdx?: number;
}

const ROW_HEIGHT = 25;
const OVERSCAN_ROWS = 10;
const OVERSCAN_COLS = 5;

export default function Grid({ sheet, hf, hfVersion, sheetMatrix, onCellEdit, targetRowIdx }: GridProps) {
  const sheetId = useMemo(() => hf ? hf.getSheetId(sheet.name) : undefined, [hf, sheet.name]);
  
  const [activeCell, setActiveCell] = useState<{ row: number, col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Scroll state for virtualization
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 600 });

  useEffect(() => {
    if (targetRowIdx !== undefined && targetRowIdx !== null) {
      setActiveCell({ row: targetRowIdx, col: 0 });
      setTimeout(() => {
        if (gridContainerRef.current) {
          const targetScrollTop = targetRowIdx * ROW_HEIGHT;
          gridContainerRef.current.scrollTo({ top: targetScrollTop - viewportSize.height / 2, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [targetRowIdx]);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    setScrollLeft(el.scrollLeft);
  }, []);

  const mergesMap = useMemo(() => parseMerges(sheet.merges || []), [sheet.merges]);
  const excludedCells = useMemo(() => getExcludedCells(sheet.merges || []), [sheet.merges]);

  const dims = useMemo(() => {
    if (sheetId === undefined || !hf) return { width: 0, height: 0 };
    return hf.getSheetDimensions(sheetId);
  }, [hf, hfVersion, sheetId]);

  const rowsCount = Math.max(dims.height, sheetMatrix.length, 100);
  const colsCount = Math.max(dims.width, (sheetMatrix[0] && sheetMatrix[0].length) || 0, 26);

  // Pre-calculate column widths
  const colWidths = useMemo(() => {
    const widths: number[] = [];
    for (let c = 0; c < colsCount; c++) {
      const colA1 = indexToA1(0, c).replace(/[0-9]/g, '');
      const widthRaw = sheet.colWidths?.[colA1] || 15;
      widths.push(Math.max(50, widthRaw * 7.5));
    }
    return widths;
  }, [sheet.colWidths, colsCount]);

  const colOffsets = useMemo(() => {
    const offsets = [0];
    let sum = 0;
    for (let i = 0; i < colWidths.length; i++) {
      sum += colWidths[i];
      offsets.push(sum);
    }
    return offsets;
  }, [colWidths]);

  // Determine visible rows
  const startRowRaw = Math.floor(scrollTop / ROW_HEIGHT);
  const startRow = Math.max(0, startRowRaw - OVERSCAN_ROWS);
  const endRowRaw = Math.ceil((scrollTop + viewportSize.height) / ROW_HEIGHT);
  const endRow = Math.min(rowsCount, endRowRaw + OVERSCAN_ROWS);

  // Determine visible cols
  let startColRaw = 0;
  while (startColRaw < colOffsets.length - 1 && colOffsets[startColRaw + 1] < scrollLeft) {
    startColRaw++;
  }
  const startCol = Math.max(0, startColRaw - OVERSCAN_COLS);

  let endColRaw = startColRaw;
  while (endColRaw < colOffsets.length - 1 && colOffsets[endColRaw] < scrollLeft + viewportSize.width) {
    endColRaw++;
  }
  const endCol = Math.min(colsCount, endColRaw + OVERSCAN_COLS);

  // Adjust bounds for merges: if any visible cell is part of a merge, ensure the starting cell of that merge is rendered
  let adjustedStartRow = startRow;
  let adjustedStartCol = startCol;
  
  // A simple pass over visible merges could be enough, but since mergesMap is keyed by "row,col", 
  // we just expand bounds based on all merges. This is fast enough if merges < 1000.
  // A robust way: check every excluded cell in the viewport, and if it's excluded, find its parent merge.
  // Actually, we can just find all merges that intersect the viewport.
  if (sheet.merges && sheet.merges.length > 0) {
    Object.entries(mergesMap).forEach(([key, merge]) => {
      const [mr, mc] = key.split(',').map(Number);
      // Check intersection
      const mergeEndRow = mr + merge.rowSpan - 1;
      const mergeEndCol = mc + merge.colSpan - 1;
      if (!(mergeEndRow < startRow || mr >= endRow || mergeEndCol < startCol || mc >= endCol)) {
        if (mr < adjustedStartRow) adjustedStartRow = mr;
        if (mc < adjustedStartCol) adjustedStartCol = mc;
      }
    });
  }

  const topSpacerHeight = adjustedStartRow * ROW_HEIGHT;
  const bottomSpacerHeight = (rowsCount - endRow) * ROW_HEIGHT;

  const leftSpacerWidth = colOffsets[adjustedStartCol];
  const rightSpacerWidth = colOffsets[colsCount] - colOffsets[endCol];

  // Callbacks
  const startEdit = useEvent((row: number, col: number) => {
    const raw = sheetMatrix[row]?.[col];
    let val = '';
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'object' && 'f' in raw) val = raw.f;
      else val = String(raw);
    }
    setEditValue(val);
    setIsEditing(true);
  });

  const saveEdit = useEvent(() => {
    if (activeCell && isEditing) {
      let finalValue = editValue.trim();
      const dateMatchRU = finalValue.match(/^(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}:\d{2}))?$/);
      if (dateMatchRU) {
        const [_, d, m, y, time] = dateMatchRU;
        finalValue = time ? `${y}-${m}-${d} ${time}` : `${y}-${m}-${d}`;
      }
      onCellEdit(activeCell.row, activeCell.col, finalValue);
    }
    setIsEditing(false);
  });

  const setCell = useEvent((row: number, col: number) => {
    setActiveCell({ row, col });
  });

  const handleSetEditValue = useEvent((val: string) => {
    setEditValue(val);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    if (isEditing) {
      if (e.key === 'Enter') {
        saveEdit();
        setActiveCell({ row: activeCell.row + 1, col: activeCell.col });
        e.preventDefault();
      } else if (e.key === 'Tab') {
        saveEdit();
        setActiveCell({ row: activeCell.row, col: activeCell.col + 1 });
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    } else {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setActiveCell({ row: Math.min(activeCell.row + 1, rowsCount - 1), col: activeCell.col });
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setActiveCell({ row: Math.max(activeCell.row - 1, 0), col: activeCell.col });
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        setActiveCell({ row: activeCell.row, col: Math.min(activeCell.col + 1, colsCount - 1) });
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        setActiveCell({ row: activeCell.row, col: Math.max(activeCell.col - 1, 0) });
        e.preventDefault();
      } else if (e.key === 'F2') {
        startEdit(activeCell.row, activeCell.col);
        e.preventDefault();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsEditing(true);
        setEditValue(e.key);
        e.preventDefault();
      }
    }
  };

  let formulaBarValue = '';
  if (activeCell) {
    if (isEditing) {
      formulaBarValue = editValue;
    } else {
      const raw = sheetMatrix[activeCell.row]?.[activeCell.col];
      if (raw !== null && raw !== undefined) {
        formulaBarValue = typeof raw === 'object' && 'f' in raw ? raw.f : String(raw);
      }
    }
  }

  const visibleCols = [];
  for (let c = adjustedStartCol; c < endCol; c++) {
    visibleCols.push(c);
  }

  const visibleRows = [];
  for (let r = adjustedStartRow; r < endRow; r++) {
    visibleRows.push(r);
  }

  if (sheetId === undefined) return null;

  return (
    <div className="flex flex-col h-full bg-white outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Formula Bar */}
      <div className="flex items-center border-b border-slate-200 bg-white px-2 py-1 shrink-0">
        <div className="w-12 text-center text-xs font-mono font-bold text-slate-500 border-r border-slate-200">
          {activeCell ? indexToA1(activeCell.row, activeCell.col) : ''}
        </div>
        <div className="px-3 italic text-slate-300 text-xs select-none">fx</div>
        <input 
          type="text" 
          className="flex-1 px-2 py-1 text-sm font-mono focus:outline-none"
          spellCheck="false"
          value={formulaBarValue}
          onChange={(e) => {
            if (!isEditing && activeCell) setIsEditing(true);
            setEditValue(e.target.value);
          }}
          onFocus={() => {
            if (activeCell && !isEditing) startEdit(activeCell.row, activeCell.col);
          }}
        />
      </div>

      {/* Grid Container */}
      <div 
        className="flex-1 overflow-auto bg-white relative" 
        ref={gridContainerRef}
        onScroll={handleScroll}
      >
        <table className="border-collapse border-slate-300 table-fixed text-[12px] bg-white">
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
            <tr>
              <th className="w-10 border-b border-r border-slate-300 bg-slate-100 sticky left-0 z-30"></th>
              {leftSpacerWidth > 0 && <th style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, padding: 0, border: 0 }}></th>}
              {visibleCols.map(c => {
                const colA1 = indexToA1(0, c).replace(/[0-9]/g, '');
                const pxWidth = colWidths[c];
                return (
                  <th key={c} className="border-b border-r border-slate-300 p-1 font-semibold text-slate-600 select-none bg-slate-100" style={{ width: pxWidth, minWidth: pxWidth }}>
                    {colA1}
                  </th>
                );
              })}
              {rightSpacerWidth > 0 && <th style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, padding: 0, border: 0 }}></th>}
            </tr>
          </thead>
          <tbody>
            {topSpacerHeight > 0 && (
              <tr style={{ height: topSpacerHeight }}>
                <td className="sticky left-0 bg-slate-100 border-r border-slate-200" style={{ height: topSpacerHeight, padding: 0, borderBottom: 0 }}></td>
                <td colSpan={visibleCols.length + 2} style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}

            {visibleRows.map(r => {
              const isRowActive = activeCell?.row === r;
              return (
                <tr key={r} id={`grid-row-${r}`} className={`group ${isRowActive ? 'bg-blue-50/50' : 'hover:bg-blue-50'}`} style={{ height: ROW_HEIGHT }}>
                  <td className="border-b border-r border-slate-200 bg-slate-100 text-center text-[10px] text-slate-400 select-none sticky left-0 z-10 group-hover:bg-slate-200" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                    {r + 1}
                  </td>
                  {leftSpacerWidth > 0 && <td style={{ padding: 0, border: 0 }}></td>}
                  {visibleCols.map(c => {
                    const cellKey = `${r},${c}`;
                    if (excludedCells.has(cellKey)) return null;
                    const merge = mergesMap[cellKey];
                    const isActive = activeCell?.row === r && activeCell?.col === c;
                    
                    return (
                      <Cell
                        key={c}
                        r={r}
                        c={c}
                        sheetId={sheetId}
                        hf={hf}
                        hfVersion={hfVersion}
                        rawVal={sheetMatrix[r]?.[c]}
                        rowSpan={merge?.rowSpan}
                        colSpan={merge?.colSpan}
                        isActive={isActive}
                        isEditing={isActive && isEditing}
                        editValue={isActive ? editValue : ''}
                        setEditValue={handleSetEditValue}
                        saveEdit={saveEdit}
                        startEdit={startEdit}
                        setActiveCell={setCell}
                      />
                    );
                  })}
                  {rightSpacerWidth > 0 && <td style={{ padding: 0, border: 0 }}></td>}
                </tr>
              );
            })}

            {bottomSpacerHeight > 0 && (
              <tr style={{ height: bottomSpacerHeight }}>
                <td className="sticky left-0 bg-slate-100 border-r border-slate-200" style={{ height: bottomSpacerHeight, padding: 0, borderBottom: 0 }}></td>
                <td colSpan={visibleCols.length + 2} style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
