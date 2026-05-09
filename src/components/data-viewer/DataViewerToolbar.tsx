"use client";

import { BarChart3, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewMode, DataViewerActions } from "./types";

interface DataViewerToolbarProps<TRecord> {
  labels: { singular: string; plural: string };
  actions: DataViewerActions<TRecord>;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Filtered row count (after search/filter applied) */
  filteredCount: number;
  /** Total unfiltered count — when different from filteredCount, shows "X of Y" */
  totalCount: number;
  /** @deprecated — search now lives in FilterPanel; prop kept for compat but unused */
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  showSearch?: boolean;
  /** When true, list / card / statistics are one join group (statistics = in-page analytics). */
  showStatisticsToggle?: boolean;
}

export function DataViewerToolbar<TRecord>({
  labels,
  actions,
  viewMode,
  onViewModeChange,
  filteredCount,
  totalCount,
  showStatisticsToggle = false,
}: DataViewerToolbarProps<TRecord>) {
  const isFiltered = filteredCount !== totalCount;
  const statsMode = viewMode === "statistics";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        {statsMode ? (
          <>
            <span className="font-semibold text-base-content">Statistics</span>
            {" — "}
            {labels.plural}
          </>
        ) : isFiltered ? (
          <>
            <span className="font-semibold text-base-content">{filteredCount.toLocaleString()}</span>
            {" of "}
            <span className="font-semibold text-base-content">{totalCount.toLocaleString()}</span>
          </>
        ) : (
          <span className="font-semibold text-base-content">{totalCount.toLocaleString()}</span>
        )}
        {!statsMode ? (
          <>
            {" "}
            {filteredCount === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()}
          </>
        ) : null}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div
          className="join rounded-box border border-primary/25 bg-base-200/50 shadow-sm shadow-black/10"
          role="tablist"
          aria-label="Data view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "table"}
            onClick={() => onViewModeChange("table")}
            className={cn(
              "join-item inline-flex h-8 min-h-8 shrink-0 items-center justify-center border-0 px-2.5 text-sm font-medium transition-none sm:px-3",
              viewMode === "table"
                ? "bg-primary text-primary-content shadow-sm hover:bg-primary hover:text-primary-content"
                : "bg-transparent text-primary hover:bg-transparent hover:text-primary",
            )}
            aria-label="Table view"
            title="Table view"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "cards"}
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "join-item inline-flex h-8 min-h-8 shrink-0 items-center justify-center border-0 px-2.5 text-sm font-medium transition-none sm:px-3",
              viewMode === "cards"
                ? "bg-primary text-primary-content shadow-sm hover:bg-primary hover:text-primary-content"
                : "bg-transparent text-primary hover:bg-transparent hover:text-primary",
            )}
            aria-label="Card view"
            title="Card view"
          >
            <LayoutGrid className="size-4" />
          </button>
          {showStatisticsToggle ? (
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "statistics"}
              onClick={() => onViewModeChange("statistics")}
              className={cn(
                "join-item inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1 border-0 px-2.5 text-sm font-medium transition-none sm:px-3",
                viewMode === "statistics"
                  ? "bg-primary text-primary-content shadow-sm hover:bg-primary hover:text-primary-content"
                  : "bg-transparent text-primary hover:bg-transparent hover:text-primary",
              )}
              aria-label="Statistics view"
              title="Statistics for this list"
            >
              <BarChart3 className="size-4 shrink-0" aria-hidden />
              Statistics
            </button>
          ) : null}
        </div>

        {actions.add && viewMode !== "statistics" ? (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-sm shadow-primary/25 ring-1 ring-primary/30"
            onClick={() => actions.add?.handler()}
          >
            <Plus className="size-4" />
            {actions.add.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
