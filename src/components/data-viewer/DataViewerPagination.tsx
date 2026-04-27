"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface DataViewerPaginationProps {
  pagination: PaginationState;
  pageCount: number;
  /** Total rows after filtering — used for "Showing X–Y of Z" display */
  filteredTotal: number;
  onPaginationChange: (updater: Updater<PaginationState>) => void;
  /** Renders to the left of the “Showing …” range (e.g. page size selector). */
  leading?: ReactNode;
}

export function DataViewerPagination({
  pagination,
  pageCount,
  filteredTotal,
  onPaginationChange,
  leading,
}: DataViewerPaginationProps) {
  const safeCount = Math.max(1, pageCount);
  const canPrev = pagination.pageIndex > 0;
  const canNext = pagination.pageIndex < safeCount - 1;

  const go = (index: number) =>
    onPaginationChange((prev) => ({ ...prev, pageIndex: Math.max(0, Math.min(safeCount - 1, index)) }));

  // Page numbers to show (max 5, centred around current page)
  const pageNumbers: number[] = [];
  const total = safeCount;
  if (total <= 7) {
    for (let i = 0; i < total; i++) pageNumbers.push(i);
  } else {
    const cur = pagination.pageIndex;
    let start = Math.max(0, cur - 2);
    const end = Math.min(total - 1, start + 4);
    start = Math.max(0, end - 4);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
  }

  // Range display: "Showing 1–25 of 84"
  const from = filteredTotal === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredTotal);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
        {leading ? <div className="flex shrink-0 flex-wrap items-center gap-2">{leading}</div> : null}
        <p className="text-sm text-muted-foreground">
          {filteredTotal === 0 ? (
            "No results"
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-base-content">{from.toLocaleString()}–{to.toLocaleString()}</span>
              {" of "}
              <span className="font-medium text-base-content">{filteredTotal.toLocaleString()}</span>
            </>
          )}
        </p>
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* First */}
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          onClick={() => go(0)}
          disabled={!canPrev}
          aria-label="First page"
        >
          <ChevronsLeft className="size-4" />
        </Button>

        {/* Prev */}
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          onClick={() => go(pagination.pageIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {/* Page numbers */}
        {pageNumbers.map((p) => (
          <Button
            key={p}
            variant={p === pagination.pageIndex ? "default" : "outline"}
            size="icon-sm"
            type="button"
            onClick={() => go(p)}
            aria-label={`Page ${p + 1}`}
            aria-current={p === pagination.pageIndex ? "page" : undefined}
            className="min-w-[2rem] text-xs"
          >
            {p + 1}
          </Button>
        ))}

        {/* Next */}
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          onClick={() => go(pagination.pageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>

        {/* Last */}
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          onClick={() => go(safeCount - 1)}
          disabled={!canNext}
          aria-label="Last page"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
