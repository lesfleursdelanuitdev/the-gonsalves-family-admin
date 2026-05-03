"use client";

import type { MouseEvent } from "react";
import { Inbox } from "lucide-react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import type { DataViewerConfig } from "./types";
import { DataViewerPagination } from "./DataViewerPagination";
import { cn } from "@/lib/utils";
import type { DataViewerTableSelectionProps } from "./types";
import { Checkbox } from "@/components/ui/checkbox";

interface DataViewerCardGridProps<TRecord> {
  config: DataViewerConfig<TRecord>;
  /** Rows for the current page (pre-sliced by parent) */
  data: TRecord[];
  /** Total rows after global search (for empty state and pagination) */
  filteredTotal: number;
  pagination: PaginationState;
  pageCount: number;
  onPaginationChange: (updater: Updater<PaginationState>) => void;
  /** Visual hint that a background fetch is in flight. */
  isFetching?: boolean;
  selection?: Pick<DataViewerTableSelectionProps, "selectedIds" | "onToggleRow">;
}

export function DataViewerCardGrid<TRecord>({
  config,
  data,
  filteredTotal,
  pagination,
  pageCount,
  onPaginationChange,
  isFetching = false,
  selection,
}: DataViewerCardGridProps<TRecord>) {
  const { actions, getRowId, renderCard, labels } = config;

  return (
    <div className="space-y-3">
      {filteredTotal === 0 ? (
        /* ── Illustrated empty state ── */
        <div className="flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-base-content/12 bg-base-content/[0.025] py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-base-200/60">
            <Inbox className="size-7 text-muted-foreground/40" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-base-content">
              No {labels.plural.toLowerCase()} found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity",
            isFetching && "opacity-80",
          )}
        >
          {data.map((record, pageIndex) => {
            const id = getRowId(record);
            const isSelected = selection?.selectedIds.has(id) ?? false;
            return (
              <div
                key={id}
                className={cn(
                  "relative h-full min-h-0 rounded-box",
                  selection && isSelected && "ring-2 ring-primary/80 ring-offset-2 ring-offset-base-100",
                )}
              >
                {selection ? (
                  <div
                    className="absolute left-2 top-2 z-10 flex size-9 items-center justify-center rounded-md border border-base-content/10 bg-base-100/95 shadow-sm backdrop-blur-sm"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      selection.onToggleRow(id, pageIndex, e as unknown as MouseEvent);
                    }}
                    role="presentation"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                      aria-label="Select row"
                    />
                  </div>
                ) : null}
                <div className="relative z-0 h-full min-h-0">
                  {renderCard({
                    record,
                    onView: actions.view ? () => actions.view!.handler(record) : undefined,
                    onEdit: actions.edit ? () => actions.edit!.handler(record) : undefined,
                    onDelete: actions.delete ? () => actions.delete!.handler(record) : undefined,
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky pagination footer */}
      <div className="sticky bottom-0 z-10 border-t border-base-content/[0.08] bg-base-100/95 px-1 py-3 backdrop-blur-md">
        <DataViewerPagination
          pagination={pagination}
          pageCount={pageCount}
          filteredTotal={filteredTotal}
          onPaginationChange={onPaginationChange}
        />
      </div>
    </div>
  );
}
