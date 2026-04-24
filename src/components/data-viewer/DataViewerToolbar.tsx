"use client";

import { LayoutGrid, List, Plus } from "lucide-react";
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
}

export function DataViewerToolbar<TRecord>({
  labels,
  actions,
  viewMode,
  onViewModeChange,
  filteredCount,
  totalCount,
}: DataViewerToolbarProps<TRecord>) {
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Result count — replaces the search bar; search lives in FilterPanel */}
      <p className="text-sm text-muted-foreground">
        {isFiltered ? (
          <>
            <span className="font-semibold text-base-content">{filteredCount.toLocaleString()}</span>
            {" of "}
            <span className="font-semibold text-base-content">{totalCount.toLocaleString()}</span>
          </>
        ) : (
          <span className="font-semibold text-base-content">{totalCount.toLocaleString()}</span>
        )}
        {" "}
        {filteredCount === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* View mode toggle */}
        <div className="join rounded-box border border-primary/25 bg-base-200/50 shadow-sm shadow-black/10">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={cn(
              "join-item btn btn-sm border-0",
              viewMode === "table"
                ? "btn-primary text-primary-content shadow-sm"
                : "btn-ghost bg-transparent text-primary hover:bg-primary/15 hover:text-primary",
            )}
            aria-label="Table view"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={cn(
              "join-item btn btn-sm border-0",
              viewMode === "cards"
                ? "btn-primary text-primary-content shadow-sm"
                : "btn-ghost bg-transparent text-primary hover:bg-primary/15 hover:text-primary",
            )}
            aria-label="Card view"
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>

        {/* Add action */}
        {actions.add && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-sm shadow-primary/25 ring-1 ring-primary/30"
            onClick={() => actions.add?.handler()}
          >
            <Plus className="size-4" />
            {actions.add.label}
          </Button>
        )}
      </div>
    </div>
  );
}
