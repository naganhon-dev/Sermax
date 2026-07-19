import { memo } from 'react';
import { CellValue } from '../types';
import { HyperFormula, CellError } from 'hyperformula';

interface CellProps {
  r: number;
  c: number;
  sheetId?: number;
  hf: HyperFormula | null;
  hfVersion: number; // to trigger re-render on HF updates
  rawVal: CellValue;
  rowSpan?: number;
  colSpan?: number;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (val: string) => void;
  saveEdit: () => void;
  startEdit: (r: number, c: number) => void;
  setActiveCell: (row: number, col: number) => void;
}

export const Cell = memo(({
  r, c, sheetId, hf, hfVersion, rawVal,
  rowSpan = 1, colSpan = 1,
  isActive, isEditing, editValue,
  setEditValue, saveEdit, startEdit, setActiveCell
}: CellProps) => {
  let displayValue = '';
  let isDateFormat = false;
  
  if (sheetId !== undefined && hf) {
    const hfVal = hf.getCellValue({ sheet: sheetId, col: c, row: r });
    const detailedType = hf.getCellValueDetailedType({ sheet: sheetId, col: c, row: r });
    
    if (hfVal instanceof CellError) {
      displayValue = hfVal.message || '#ERROR';
    } else if (hfVal !== null && hfVal !== undefined) {
      if (detailedType === 'NUMBER_DATE' || detailedType === 'NUMBER_DATETIME' || detailedType === 'NUMBER_TIME' || (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal))) {
        isDateFormat = true;
        if (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
           const match = rawVal.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/);
           if (match) {
             const [_, y, m, d, time] = match;
             displayValue = time ? `${d}.${m}.${y} ${time}` : `${d}.${m}.${y}`;
           } else {
             displayValue = String(hfVal);
           }
        } else if (typeof hfVal === 'number') {
           const days = Math.floor(hfVal);
           const fraction = hfVal - days;
           const date = new Date(Date.UTC(1899, 11, 30));
           date.setUTCDate(date.getUTCDate() + days);
           const d = String(date.getUTCDate()).padStart(2, '0');
           const m = String(date.getUTCMonth() + 1).padStart(2, '0');
           const y = date.getUTCFullYear();
           
           if (fraction > 0) {
             const totalSecs = Math.round(fraction * 86400);
             const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
             const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
             displayValue = `${d}.${m}.${y} ${hrs}:${mins}`;
           } else {
             displayValue = `${d}.${m}.${y}`;
           }
        } else {
           displayValue = String(hfVal);
        }
      } else if (typeof hfVal === 'number') {
        displayValue = Number.isInteger(hfVal) ? hfVal.toString() : parseFloat(hfVal.toFixed(4)).toString();
      } else {
        displayValue = String(hfVal);
      }
    }
  } else {
    if (rawVal !== null && rawVal !== undefined) {
      if (typeof rawVal === 'object' && rawVal !== null) {
        displayValue = String('v' in rawVal && rawVal.v !== undefined ? rawVal.v : ('f' in rawVal ? rawVal.f : rawVal));
      } else {
        displayValue = String(rawVal);
      }
    }
  }

  const isNumber = !isNaN(Number(displayValue)) && displayValue !== '' && !isDateFormat;
  const isFormula = rawVal && typeof rawVal === 'object' && 'f' in rawVal;

  return (
    <td 
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border-b border-r border-slate-200 p-1 truncate relative ${isActive ? 'ring-2 ring-blue-500 ring-inset ring-opacity-100 z-10 bg-blue-50' : ''} ${isNumber ? 'font-mono' : ''} ${isFormula && !isActive ? 'bg-blue-50/30' : ''}`}
      onClick={() => {
        if (isActive && !isEditing) {
          startEdit(r, c);
        } else {
          if (isEditing) saveEdit();
          setActiveCell(r, c);
        }
      }}
      onDoubleClick={() => {
        if (!isEditing) startEdit(r, c);
      }}
    >
      {isActive && isEditing ? (
        <input 
          autoFocus
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
});
