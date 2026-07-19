import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { SheetData, RowData, CellValue } from '../types';
import { HyperFormula } from 'hyperformula';
import { Cell } from './Cell';
import { parseMerges, getExcludedCells, indexToA1, getCellValueAndStyle } from '../lib/gridUtils';
import { useEvent } from '../lib/useEvent';

interface GridProps {
  sheet: SheetData;
  hf: HyperFormula | null;
  hfVersion: number;
  sheetMatrix: RowData[];
  onCellEdit: (row: number, col: number, value: any) => void;
  targetRowIdx?: number | null;
  onCellsEdit?: (updates: {r: number, c: number, v: any}[]) => void;
  undo?: () => void;
  redo?: () => void;
}

export default function Grid({ sheet, hf, hfVersion, sheetMatrix, onCellEdit, targetRowIdx, onCellsEdit, undo, redo }: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeCell, setActiveCell] = useState<{ row: number, col: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ row: number, col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number, col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const ROW_HEIGHT = 25;
  const DEFAULT_COL_WIDTH = 100;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (targetRowIdx !== undefined && targetRowIdx !== null && containerRef.current) {
      containerRef.current.scrollTop = targetRowIdx * ROW_HEIGHT;
      setActiveCell({ row: targetRowIdx, col: 0 });
      setSelectionStart({ row: targetRowIdx, col: 0 });
      setSelectionEnd({ row: targetRowIdx, col: 0 });
    }
  }, [targetRowIdx]);

  const merges = useMemo(() => parseMerges(sheet.merges || []), [sheet.merges]);
  const excludedCells = useMemo(() => getExcludedCells(sheet.merges || []), [sheet.merges]);

  const rowsCount = Math.max(Math.ceil(dims.height / ROW_HEIGHT), sheetMatrix.length, 100);
  let colsCount = 26;
  for(let r = 0; r < sheetMatrix.length; r++) {
    const row = sheetMatrix[r];
    const cells = row ? (Array.isArray(row) ? row : row.c) : [];
    if (cells && cells.length > colsCount) colsCount = cells.length;
  }
  colsCount = Math.max(Math.ceil(dims.width / DEFAULT_COL_WIDTH), colsCount);

  const getColWidth = useCallback((colIdx: number) => {
    const colA1 = indexToA1(0, colIdx).replace(/[0-9]/g, '');
    return sheet.colWidths?.[colA1] || DEFAULT_COL_WIDTH;
  }, [sheet.colWidths]);

  const colOffsets = useMemo(() => {
    const offsets = [0];
    let current = 0;
    for (let i = 0; i < colsCount; i++) {
      current += getColWidth(i);
      offsets.push(current);
    }
    return offsets;
  }, [colsCount, getColWidth]);

  const findVisibleCols = useCallback(() => {
    let startCol = 0;
    while (startCol < colOffsets.length - 1 && colOffsets[startCol + 1] < scrollLeft - 500) {
      startCol++;
    }
    let endCol = startCol;
    while (endCol < colOffsets.length - 1 && colOffsets[endCol] < scrollLeft + dims.width + 500) {
      endCol++;
    }
    return { startCol, endCol };
  }, [colOffsets, scrollLeft, dims.width]);

  const visibleRowStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 10);
  const visibleRowEnd = Math.min(rowsCount - 1, Math.ceil((scrollTop + dims.height) / ROW_HEIGHT) + 10);
  const { startCol: visibleColStart, endCol: visibleColEnd } = findVisibleCols();

  const handleScroll = useEvent((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  });

  const selectionBounds = useMemo(() => {
    if (!activeCell) return null;
    let r1 = activeCell.row;
    let c1 = activeCell.col;
    let r2 = activeCell.row;
    let c2 = activeCell.col;
    
    if (selectionStart && selectionEnd) {
      r1 = Math.min(selectionStart.row, selectionEnd.row);
      r2 = Math.max(selectionStart.row, selectionEnd.row);
      c1 = Math.min(selectionStart.col, selectionEnd.col);
      c2 = Math.max(selectionStart.col, selectionEnd.col);
    }
    return { r1, c1, r2, c2 };
  }, [activeCell, selectionStart, selectionEnd]);

  const isCellSelected = useCallback((r: number, c: number) => {
    if (!selectionBounds) return false;
    return r >= selectionBounds.r1 && r <= selectionBounds.r2 && c >= selectionBounds.c1 && c <= selectionBounds.c2;
  }, [selectionBounds]);

  const saveEdit = useEvent(() => {
    if (activeCell && isEditing) {
      onCellEdit(activeCell.row, activeCell.col, editValue);
      setIsEditing(false);
      containerRef.current?.focus();
    }
  });

  const handlePointerDown = useEvent((e: React.PointerEvent, r: number, c: number) => {
    if (e.shiftKey && activeCell) {
       setSelectionStart(activeCell);
       setSelectionEnd({row: r, col: c});
       e.preventDefault();
    } else {
       setActiveCell({row: r, col: c});
       setSelectionStart({row: r, col: c});
       setSelectionEnd({row: r, col: c});
       setIsSelecting(true);
       if (isEditing) saveEdit();
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  });

  const handlePointerEnter = useEvent((e: React.PointerEvent, r: number, c: number) => {
    if (isSelecting) {
       setSelectionEnd({row: r, col: c});
    }
  });

  const handlePointerUp = useEvent(() => {
    setIsSelecting(false);
  });

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerUp]);

  const startEdit = useEvent((r: number, c: number) => {
    const { value } = getCellValueAndStyle(sheetMatrix[r], c);
    let raw = value;
    if (raw && typeof raw === 'object' && 'f' in raw) raw = raw.f;
    else if (raw && typeof raw === 'object' && 'v' in raw) raw = String(raw.v);
    else raw = raw !== null && raw !== undefined ? String(raw) : '';
    
    setEditValue(String(raw));
    setIsEditing(true);
  });

  const setCell = useEvent((row: number, col: number) => {
    setActiveCell({ row, col });
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
  });

  const copyToClipboard = useEvent(async (cut = false) => {
    if (!selectionBounds) return;
    const { r1, r2, c1, c2 } = selectionBounds;
    const rows = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) {
        const { value } = getCellValueAndStyle(sheetMatrix[r], c);
        let text = '';
        if (value !== null && value !== undefined) {
           if (typeof value === 'object' && 'f' in value) text = value.f;
           else if (typeof value === 'object' && 'v' in value) text = String(value.v);
           else text = String(value);
        }
        if (text.includes('\t') || text.includes('\n')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        row.push(text);
      }
      rows.push(row.join('\t'));
    }
    await navigator.clipboard.writeText(rows.join('\n'));
    if (cut) {
       if (onCellsEdit) {
         const updates = [];
         for (let r = r1; r <= r2; r++) {
           for (let c = c1; c <= c2; c++) {
             updates.push({r, c, v: null});
           }
         }
         onCellsEdit(updates);
       } else {
         for (let r = r1; r <= r2; r++) {
           for (let c = c1; c <= c2; c++) {
             onCellEdit(r, c, null);
           }
         }
       }
    }
  });

  const pasteFromClipboard = useEvent(async () => {
    if (!activeCell) return;
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n').map(r => r.split('\t'));
      
      const updates: {r: number, c: number, v: string}[] = [];
      for(let i=0; i<rows.length; i++) {
        for(let j=0; j<rows[i].length; j++) {
           let val = rows[i][j];
           if (val.startsWith('"') && val.endsWith('"')) {
             val = val.slice(1, -1).replace(/""/g, '"');
           }
           updates.push({r: activeCell.row + i, c: activeCell.col + j, v: val});
        }
      }
      if (onCellsEdit) onCellsEdit(updates);
      else updates.forEach(u => onCellEdit(u.r, u.c, u.v));

    } catch(err) {}
  });

  const handleKeyDown = useEvent((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') { copyToClipboard(false); return; }
      if (e.key === 'x' || e.key === 'X') { copyToClipboard(true); return; }
      if (e.key === 'v' || e.key === 'V') { pasteFromClipboard(); return; }
      if (e.key === 'z' || e.key === 'Z') { e.shiftKey ? redo?.() : undo?.(); return; }
      if (e.key === 'y' || e.key === 'Y') { redo?.(); return; }
    }
    if (isEditing) {
      if (e.key === 'Enter') {
        saveEdit();
        if (activeCell) setCell(activeCell.row + 1, activeCell.col);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        containerRef.current?.focus();
      }
      return;
    }
    if (!activeCell) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectionBounds) {
        if (onCellsEdit) {
           const updates = [];
           for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
             for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
               updates.push({r, c, v: null});
             }
           }
           onCellsEdit(updates);
        } else {
           for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
             for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
               onCellEdit(r, c, null);
             }
           }
        }
      } else {
        onCellEdit(activeCell.row, activeCell.col, null);
      }
      e.preventDefault();
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEdit(activeCell.row, activeCell.col);
      setEditValue(e.key);
      e.preventDefault();
      return;
    }
    if (e.key === 'F2' || e.key === 'Enter') {
      startEdit(activeCell.row, activeCell.col);
      e.preventDefault();
      return;
    }
    let r = activeCell.row;
    let c = activeCell.col;
    if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
    if (e.key === 'ArrowDown') r = Math.min(rowsCount - 1, r + 1);
    if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
    if (e.key === 'ArrowRight') c = Math.min(colsCount - 1, c + 1);

    if (r !== activeCell.row || c !== activeCell.col) {
      if (e.shiftKey) {
         setSelectionEnd({row: r, col: c});
         setActiveCell({row: r, col: c});
      } else {
         setCell(r, c);
      }
      e.preventDefault();
    }
  });

  const visibleRows = [];
  for (let r = visibleRowStart; r <= visibleRowEnd; r++) visibleRows.push(r);
  const visibleCols = [];
  for (let c = visibleColStart; c <= visibleColEnd; c++) visibleCols.push(c);

  const topSpacerHeight = visibleRowStart * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (rowsCount - visibleRowEnd - 1) * ROW_HEIGHT);
  const leftSpacerWidth = colOffsets[visibleColStart];
  const rightSpacerWidth = Math.max(0, colOffsets[colsCount] - colOffsets[visibleColEnd + 1]);

  let formulaBarValue = '';
  if (activeCell) {
      const { value } = getCellValueAndStyle(sheetMatrix[activeCell.row], activeCell.col);
      let raw = value;
      if (raw && typeof raw === 'object' && 'f' in raw) raw = raw.f;
      else if (raw && typeof raw === 'object' && 'v' in raw) raw = String(raw.v);
      else raw = raw !== null && raw !== undefined ? String(raw) : '';
      formulaBarValue = String(raw);
  }

  const sheetId = sheet.name ? hf?.getSheetId(sheet.name) : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex items-center gap-2 p-2 border-b border-slate-200 bg-slate-50 text-sm">
        <div className="w-16 h-8 flex items-center justify-center bg-white border border-slate-300 rounded font-mono text-slate-600">
          {activeCell ? indexToA1(activeCell.row, activeCell.col) : ''}
        </div>
        <div className="flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-3 text-slate-400 bg-slate-100 border-r border-slate-300 italic font-serif">fx</div>
          <input 
            type="text" 
            className="flex-1 px-2 h-8 outline-none"
            value={isEditing ? editValue : formulaBarValue}
            onChange={(e) => {
              if (isEditing) setEditValue(e.target.value);
            }}
            readOnly={!isEditing}
            onClick={() => {
              if (!isEditing && activeCell) startEdit(activeCell.row, activeCell.col);
            }}
          />
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-auto outline-none"
        onScroll={handleScroll}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className="table-fixed border-collapse bg-white" style={{ minWidth: colOffsets[colsCount], minHeight: rowsCount * ROW_HEIGHT }}>
          <colgroup>
            <col style={{ width: 40 }} />
            {leftSpacerWidth > 0 && <col style={{ width: leftSpacerWidth }} />}
            {visibleCols.map(c => <col key={c} style={{ width: getColWidth(c) }} />)}
            {rightSpacerWidth > 0 && <col style={{ width: rightSpacerWidth }} />}
          </colgroup>
          <thead className="sticky top-0 z-20 shadow-sm bg-slate-100 text-slate-500 select-none text-xs">
            <tr style={{ height: 24 }}>
              <th className="border-r border-b border-slate-300 bg-slate-100"></th>
              {leftSpacerWidth > 0 && <th style={{ padding: 0, border: 0 }}></th>}
              {visibleCols.map(c => (
                <th key={c} className="border-r border-b border-slate-300 font-normal hover:bg-slate-200 cursor-pointer">
                  {indexToA1(0, c).replace(/[0-9]/g, '')}
                </th>
              ))}
              {rightSpacerWidth > 0 && <th style={{ padding: 0, border: 0 }}></th>}
            </tr>
          </thead>
          <tbody className="text-sm select-none">
            {topSpacerHeight > 0 && (
              <tr style={{ height: topSpacerHeight }}>
                <td className="sticky left-0 bg-slate-100 border-r border-b border-slate-300" style={{ height: topSpacerHeight, padding: 0 }}></td>
                <td colSpan={visibleCols.length + 2} style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}
            
            {visibleRows.map(r => {
              return (
                <tr key={r} style={{ height: ROW_HEIGHT }}>
                  <td className="sticky left-0 z-10 bg-slate-100 text-slate-500 border-r border-b border-slate-300 text-xs text-center w-10">
                    {r + 1}
                  </td>
                  {leftSpacerWidth > 0 && <td style={{ padding: 0, border: 0 }}></td>}
                  {visibleCols.map(c => {
                    if (excludedCells.has(`${r},${c}`)) return null;
                    const merge = merges[`${r},${c}`];
                    const { value, styleIndex } = getCellValueAndStyle(sheetMatrix[r], c);
                    const cellStyle = styleIndex !== undefined ? sheet.styles?.[styleIndex] : undefined;
                    const isSelected = isCellSelected(r, c);
                    const isActive = activeCell?.row === r && activeCell?.col === c;

                    return (
                      <Cell
                        key={c}
                        r={r}
                        c={c}
                        sheetId={sheetId}
                        hf={hf}
                        hfVersion={hfVersion}
                        rawVal={value}
                        cellStyle={cellStyle}
                        rowSpan={merge?.rowSpan}
                        colSpan={merge?.colSpan}
                        isActive={isActive}
                        isSelected={isSelected}
                        isEditing={isActive && isEditing}
                        editValue={isActive ? editValue : ''}
                        setEditValue={setEditValue}
                        saveEdit={saveEdit}
                        startEdit={startEdit}
                        setActiveCell={setCell}
                        onPointerDown={(e) => handlePointerDown(e, r, c)}
                        onPointerEnter={(e) => handlePointerEnter(e, r, c)}
                      />
                    );
                  })}
                  {rightSpacerWidth > 0 && <td style={{ padding: 0, border: 0 }}></td>}
                </tr>
              );
            })}

            {bottomSpacerHeight > 0 && (
              <tr style={{ height: bottomSpacerHeight }}>
                <td className="sticky left-0 bg-slate-100 border-r border-slate-300" style={{ height: bottomSpacerHeight, padding: 0, borderBottom: 0 }}></td>
                <td colSpan={visibleCols.length + 2} style={{ padding: 0, border: 0 }}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
