"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTE_LINKED_LIST_VISIBLE_MAX } from "@ligneous/gedcom-events";
import { cn } from "@/lib/utils";

type PaginatedNoteLinkListProps<T> = {
  items: T[];
  /** Defaults to `NOTE_LINKED_LIST_VISIBLE_MAX` (5). */
  pageSize?: number;
  itemKey: (item: T, globalIndex: number) => string;
  /** Stacked full-width rows (e.g. note editor sidebar). */
  variant?: "rows" | "chips";
  className?: string;
  renderItem: (item: T) => ReactNode;
};

export function PaginatedNoteLinkList<T>({
  items,
  pageSize = NOTE_LINKED_LIST_VISIBLE_MAX,
  itemKey,
  variant = "rows",
  className,
  renderItem,
}: PaginatedNoteLinkListProps<T>) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount, total]);

  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const slice = items.slice(start, start + pageSize);
  const showPager = total > pageSize;
  const rangeEnd = total === 0 ? 0 : Math.min(start + pageSize, total);

  const pager = showPager ? (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-content/10 pt-2 text-xs text-muted-foreground">
      <span aria-live="polite">
        {total === 0 ? "0" : `${start + 1}–${rangeEnd}`} of {total}
      </span>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  ) : null;

  if (variant === "chips") {
    return (
      <div className={cn("space-y-2", className)}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {slice.map((item, i) => (
            <li
              key={itemKey(item, start + i)}
              className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-200/50 px-2.5 py-1 text-sm"
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
        {pager}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {slice.map((item, i) => (
        <div key={itemKey(item, start + i)}>{renderItem(item)}</div>
      ))}
      {pager}
    </div>
  );
}
