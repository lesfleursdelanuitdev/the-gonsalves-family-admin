"use client";

import { useCallback, useMemo, useState } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import type { MediaSummary } from "@ligneous/album-view";
import { AlbumMediaCard } from "@/components/admin/AlbumMediaGridSection";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

function summaryToListItem(m: MediaSummary): AdminMediaListItem {
  return {
    id: m.id,
    title: m.title,
    description: null,
    fileRef: m.fileRef,
    form: m.form,
    individualMedia: [],
    familyMedia: [],
    sourceMedia: [],
    eventMedia: [],
    appTags: [],
    albumLinks: [],
  };
}

/**
 * Paginated grid for a generated **media set** (album-style presentation) — same cards as curated album view.
 */
export function VirtualAlbumMediaGrid({
  items,
  albumIdForCardContext,
}: {
  items: MediaSummary[];
  /** Unused for links when manageable is false; pass placeholder for AlbumMediaCard. */
  albumIdForCardContext: string;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const pageItems = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return items.slice(start, start + pagination.pageSize);
  }, [items, pagination.pageIndex, pagination.pageSize]);

  const onPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const pageSizeSelectId = `virtual-album-page-size-${albumIdForCardContext}`;

  if (total === 0) {
    return (
      <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-box border border-dashed border-base-content/15 bg-base-100/40 px-4 py-8 text-center text-sm text-muted-foreground">
        <p>No images in this set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {pageItems.map((m) => (
          <AlbumMediaCard
            key={m.id}
            media={summaryToListItem(m)}
            albumId={albumIdForCardContext}
            manageable={false}
            removing={false}
            onRemove={() => {}}
          />
        ))}
      </div>
      <div className="sticky bottom-0 z-[1] border-t border-base-content/[0.08] bg-base-100/95 px-0 py-3 backdrop-blur-md">
        <DataViewerPagination
          pagination={pagination}
          pageCount={pageCount}
          filteredTotal={total}
          onPaginationChange={onPaginationChange}
          leading={
            <>
              <Label htmlFor={pageSizeSelectId} className="shrink-0 text-sm text-muted-foreground">
                Per page
              </Label>
              <select
                id={pageSizeSelectId}
                className={cn(selectClassName, "w-auto min-w-[5.5rem]")}
                value={pagination.pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const nextSize = PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])
                    ? n
                    : DEFAULT_PAGE_SIZE;
                  setPagination({ pageIndex: 0, pageSize: nextSize });
                }}
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </>
          }
        />
      </div>
    </div>
  );
}

export function VirtualAlbumMediaGridLoading() {
  return (
    <div className="flex min-h-[10rem] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-6 animate-spin shrink-0" aria-hidden />
      Loading…
    </div>
  );
}
