import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number; // current filtered item count
  grandTotal?: number; // unfiltered database count
}

export default function Pagination({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  grandTotal = 0,
}: PaginationProps) {
  // Generate pages to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('…');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('…');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const isFiltered = grandTotal > 0 && totalItems < grandTotal;

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between select-none">
      {/* Left section: Counter */}
      <div className="text-xs text-gray-500 flex flex-col gap-1">
        <div>
          {isFiltered ? (
            <span className="text-blue-600 font-medium">
              Найдено {totalItems} из {grandTotal}
            </span>
          ) : (
            <span>Всего записей: {totalItems}</span>
          )}
          {totalItems > 0 && (
            <span className="ml-2 text-gray-400">
              (Показано {startIndex}–{endIndex})
            </span>
          )}
        </div>
        
        {/* Performance warning for "Все" */}
        {pageSize === -1 && totalItems > 400 && (
          <div className="flex items-center gap-1.5 text-amber-600 mt-1 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200 w-fit">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Отображение всех записей ({totalItems}) может замедлить работу.</span>
          </div>
        )}
      </div>

      {/* Middle section: Navigation */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Назад"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageNumbers.map((p, idx) => {
            if (p === '…') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2.5 py-1 text-xs text-gray-400">
                  …
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                onClick={() => setCurrentPage(Number(p))}
                className={`min-w-[28px] h-7 px-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Вперед"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right section: Page size */}
      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="text-gray-400">Строк на странице:</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {[
            { label: '50', value: 50 },
            { label: '100', value: 100 },
            { label: '250', value: 250 },
            { label: 'Все', value: -1 },
          ].map((opt) => {
            const isActive = pageSize === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => setPageSize(opt.value)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  isActive
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
