import { useState, useEffect, useMemo } from 'react';

export interface UsePaginationResult<T> {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number; // -1 means "Все"
  setPageSize: (size: number) => void;
  paginatedData: T[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

export function usePagination<T>(
  data: T[],
  filterDeps: any[] = [],
  storageKey: string = 'app_page_size'
): UsePaginationResult<T> {
  // Retrieve initial page size from sessionStorage, default to 100
  const [pageSize, setPageSizeState] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && [50, 100, 250, -1].includes(parsed)) return parsed;
      }
    } catch (e) {}
    return 100;
  });

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filter/search dependencies change
  useEffect(() => {
    setCurrentPage(1);
  }, filterDeps);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    try {
      sessionStorage.setItem(storageKey, String(size));
    } catch (e) {}
    setCurrentPage(1);
  };

  const totalItems = data.length;
  const isAll = pageSize === -1;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize) || 1;

  // Ensure current page doesn't overshoot
  const activePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (isAll) return data;
    const startIndex = (activePage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, activePage, pageSize, isAll]);

  const startIndex = totalItems === 0 ? 0 : isAll ? 1 : (activePage - 1) * pageSize + 1;
  const endIndex = isAll ? totalItems : Math.min(activePage * pageSize, totalItems);

  return {
    currentPage: activePage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
  };
}
