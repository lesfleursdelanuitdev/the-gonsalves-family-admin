"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface DataViewerPaginationProps {
  pagination: PaginationState;
  pageCount: number;
  onPaginationChange: (updater: Updater<PaginationState>) => void;
}

export function DataViewerPagination({
  pagination,
  pageCount,
  onPaginationChange,
}: DataViewerPaginationProps) {
  const safeCount = Math.max(1, pageCount);
  const canPrev = pagination.pageIndex > 0;
  const canNext = pagination.pageIndex < safeCount - 1;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        type="button"
        onClick={() =>
          onPaginationChange((prev) => ({
            ...prev,
            pageIndex: Math.max(0, prev.pageIndex - 1),
          }))
        }
        disabled={!canPrev}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        Page {pagination.pageIndex + 1} of {safeCount}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        type="button"
        onClick={() =>
          onPaginationChange((prev) => ({
            ...prev,
            pageIndex: Math.min(safeCount - 1, prev.pageIndex + 1),
          }))
        }
        disabled={!canNext}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
