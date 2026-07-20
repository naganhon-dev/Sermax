import { useState, useCallback } from 'react';

function isEmpty(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

function parseDateVal(val: any): number | null {
  if (!val) return null;
  const str = String(val).trim();
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    const parts = str.split('.');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date.getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function isNumberVal(val: any): boolean {
  if (typeof val === 'number') return !isNaN(val);
  if (!val) return false;
  const str = String(val).trim();
  const stripped = str.replace(/[+\s()\-]/g, '');
  if (stripped.length > 0 && /^\d+$/.test(stripped)) {
    return true;
  }
  if (str.length > 0 && /^-?\d+(\.\d+)?$/.test(str)) {
    return true;
  }
  return false;
}

function parseNumberVal(val: any): number {
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const stripped = str.replace(/[+\s()\-]/g, '');
  if (stripped.length > 0 && /^\d+$/.test(stripped)) {
    return Number(stripped);
  }
  return Number(str) || 0;
}

export function compare(a: any, b: any, field: string, direction: 'asc' | 'desc'): number {
  const aVal = a[field];
  const bVal = b[field];

  const isAEmpty = isEmpty(aVal);
  const isBEmpty = isEmpty(bVal);

  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1; // Always push empty to the end
  if (isBEmpty) return -1; // Always push empty to the end

  let result = 0;
  const dateA = parseDateVal(aVal);
  const dateB = parseDateVal(bVal);

  if (dateA !== null && dateB !== null) {
    result = dateA - dateB;
  } else if (isNumberVal(aVal) && isNumberVal(bVal)) {
    result = parseNumberVal(aVal) - parseNumberVal(bVal);
  } else {
    const strA = String(aVal).trim();
    const strB = String(bVal).trim();
    result = strA.localeCompare(strB, 'ru');
  }

  return direction === 'asc' ? result : -result;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface UseSortResult<T> {
  sortField: string | null;
  sortDirection: SortDirection;
  handleSort: (field: string) => void;
  sortData: (data: T[]) => T[];
  renderSortIcon: (field: string) => string;
}

export function useSort<T extends Record<string, any>>(): UseSortResult<T> {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback((field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    }
  }, [sortField, sortDirection]);

  const renderSortIcon = useCallback((field: string) => {
    if (sortField !== field || !sortDirection) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }, [sortField, sortDirection]);

  const sortData = useCallback((data: T[]): T[] => {
    if (!sortField || !sortDirection) return data;
    return [...data].sort((a, b) => compare(a, b, sortField, sortDirection));
  }, [sortField, sortDirection]);

  return {
    sortField,
    sortDirection,
    handleSort,
    sortData,
    renderSortIcon
  };
}
