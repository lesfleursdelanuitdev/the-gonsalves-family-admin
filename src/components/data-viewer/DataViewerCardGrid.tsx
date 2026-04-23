"use client";

import type { PaginationState, Updater } from "@tanstack/react-table";
import type { DataViewerConfig } from "./types";
import { DataViewerPagination } from "./DataViewerPagination";

interface DataViewerCardGridProps<TRecord> {
  config: DataViewerConfig<TRecord>;
  /** Rows for the current page (pre-sliced by parent) */
  data: TRecord[];
  /** Total rows after global search (for empty state) */
  filteredTotal: number;
  pagination: PaginationState;
  pageCount: number;
  onPaginationChange: (updater: Updater<PaginationState>) => void;
}

export function DataViewerCardGrid<TRecord>({
  config,
  data,
  filteredTotal,
  pagination,
  pageCount,
  onPaginationChange,
}: DataViewerCardGridProps<TRecord>) {
  const { actions, getRowId, renderCard, labels } = config;

  return (
    <div className="space-y-3">
      {filteredTotal === 0 ? (
        <div className="flex h-28 items-center justify-center rounded-box border border-dashed border-base-content/12 bg-base-content/[0.025] text-sm text-base-content/45">
          No {labels.plural.toLowerCase()} found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((record) => {
            const id = getRowId(record);
            return (
              <div key={id}>
                {renderCard({
                  record,
                  onView: actions.view
                    ? () => actions.view!.handler(record)
                    : undefined,
                  onEdit: actions.edit
                    ? () => actions.edit!.handler(record)
                    : undefined,
                  onDelete: actions.delete
                    ? () => actions.delete!.handler(record)
                    : undefined,
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <DataViewerPagination
          pagination={pagination}
          pageCount={pageCount}
          onPaginationChange={onPaginationChange}
        />
      </div>
    </div>
  );
}
