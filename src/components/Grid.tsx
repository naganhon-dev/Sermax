import { useState, useMemo, useRef, useEffect } from 'react';
import { SheetData, CellValue } from '../types';
import { HyperFormula, CellError } from 'hyperformula';
import { parseMerges, getExcludedCells, indexToA1 } from '../lib/gridUtils';

interface GridProps {
  sheet: SheetData;
  hf: HyperFormula;
  hfVersion: number;
  sheetMatrix: CellValue[][];
  onCellEdit: (row: number, col: number, value: string) => void;
}

export default function Grid({ sheet, hf, hfVersion, sheetMatrix, onCellEdit }: GridProps) {
  const sheetId = useMemo(() => hf.getSheetId(sheet.name), [hf, sheet.name]);
  
  const [activeCell, setActiveCell] = useState<{ row: number, col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const mergesMap = useMemo(() => parseMerges(sheet.merges || []), [sheet.merges]);
  const excludedCells = useMemo(() => getExcludedCells(sheet.merges || []), [sheet.merges]);

  // Determine grid dimensions
  const dims = useMemo(() => {
    if (sheetId === undefined) return { width: 0, height: 0 };
    return hf.getSheetDimensions(sheetId);
  }, [hf, hfVersion, sheetId]);

  // Ensure at least some default dimensions
  const rowsCount = Math.max(dims.height, sheetMatrix.length, 100);
  const colsCount = Math.max(dims.width, (sheetMatrix[0] && sheetMatrix[0].length) || 0, 26);

  const startEdit = (row: number, col: number) => {
    const raw = sheetMatrix[row]?.[col];
    let val = '';
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'object' && 'f' in raw) {
        val = raw.f;
      } else {
        val = String(raw);
      }
    }
    setEditValue(val);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (activeCell && isEditing) {
      onCellEdit(activeCell.row, activeCell.col, editValue);
    }
    setIsEditing(false);
  };

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
      // Navigation
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
        // Start typing
        setIsEditing(true);
        setEditValue(e.key);
        e.preventDefault();
      }
    }
  };

  // Render Formula Bar value
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
            if (!isEditing && activeCell) {
               setIsEditing(true);
            }
            setEditValue(e.target.value);
          }}
          onFocus={() => {
            if (activeCell && !isEditing) startEdit(activeCell.row, activeCell.col);
          }}
          onBlur={() => {
            // Keep editing open or save? Usually clicking outside formula bar saves
          }}
        />
      </div>

      {/* Grid Container */}
      <div 
        className="flex-1 overflow-auto bg-white" 
        ref={gridContainerRef}
      >
        <table className="w-full border-collapse border-slate-300 table-fixed text-[12px]">
          <thead className="sticky top-0 z-20 shadow-sm bg-slate-100">
            <tr>
              <th className="w-10 border-b border-r border-slate-300 bg-slate-100"></th>
              {Array.from({ length: colsCount }).map((_, c) => {
                const colA1 = indexToA1(0, c).replace(/[0-9]/g, '');
                const widthRaw = sheet.colWidths?.[colA1] || 15;
                const pxWidth = Math.max(50, widthRaw * 7.5);
                return (
                  <th key={c} className="border-b border-r border-slate-300 p-1 font-semibold text-slate-600 select-none bg-slate-100" style={{ width: pxWidth, minWidth: pxWidth }}>
                    {colA1}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, r) => {
              const isRowActive = activeCell?.row === r;
              return (
                <tr key={r} className="hover:bg-blue-50 group">
                  <td className="border-b border-r border-slate-200 bg-slate-100 text-center text-[10px] text-slate-400 select-none sticky left-0 z-10 group-hover:bg-slate-200">
                    {r + 1}
                  </td>
                  {Array.from({ length: colsCount }).map((_, c) => {
                    const cellKey = `${r},${c}`;
                    if (excludedCells.has(cellKey)) return null;

                    const merge = mergesMap[cellKey];
                    const isActive = isRowActive && activeCell?.col === c;
                    
                    let displayValue = '';
                    if (sheetId !== undefined) {
                      const hfVal = hf.getCellValue({ sheet: sheetId, col: c, row: r });
                      if (hfVal instanceof CellError) {
                        displayValue = hfVal.message; // e.g., #REF!
                      } else if (hfVal !== null && hfVal !== undefined) {
                        if (typeof hfVal === 'number') {
                          displayValue = Number.isInteger(hfVal) ? hfVal.toString() : parseFloat(hfVal.toFixed(4)).toString();
                        } else {
                          displayValue = String(hfVal);
                        }
                      }
                    }

                    const rawVal = sheetMatrix[r]?.[c];
                    const isNumber = !isNaN(Number(displayValue)) && displayValue !== '';
                    const isFormula = rawVal && typeof rawVal === 'object' && 'f' in rawVal;

                    return (
                      <td 
                        key={c}
                        rowSpan={merge?.rowSpan || 1}
                        colSpan={merge?.colSpan || 1}
                        className={`border-b border-r border-slate-200 p-1 truncate relative ${isActive ? 'ring-2 ring-blue-500 ring-inset ring-opacity-100 z-10 bg-blue-50' : ''} ${isNumber ? 'font-mono' : ''} ${isFormula && !isActive ? 'bg-blue-50/30' : ''}`}
                        onClick={() => {
                          if (isActive && !isEditing) {
                            startEdit(r, c);
                          } else {
                            if (isEditing) saveEdit();
                            setActiveCell({ row: r, col: c });
                          }
                        }}
                        onDoubleClick={() => {
                          if (!isEditing) startEdit(r, c);
                        }}
                      >
                        {isActive && isEditing ? (
                          <input 
                            ref={inputRef}
                            type="text"
                            className="absolute inset-0 w-full h-full px-1 outline-none font-sans text-sm m-0 bg-white"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit()}
                          />
                        ) : (
                          <span className={`${displayValue.startsWith('#') ? 'text-red-500 font-bold' : 'text-slate-700'}`}>
                            {displayValue}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
