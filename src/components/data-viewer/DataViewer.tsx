"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import type { DataViewerProps, ViewMode } from "./types";
import { DATA_VIEWER_PAGE_SIZE } from "./constants";
import { filterRowsByGlobalSearch } from "./filterRows";
import { DataViewerToolbar } from "./DataViewerToolbar";
import { DataViewerTable } from "./DataViewerTable";
import { DataViewerCardGrid } from "./DataViewerCardGrid";
import {
  APP_SETTINGS_CHANGED_EVENT,
  DATA_VIEWER_MOBILE_MEDIA,
  readDataViewerGlobalDefault,
  readPreferTableOnMobile,
} from "@/lib/settings/app-user-settings";

function readStoredViewMode(key: string): ViewMode | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(key);
  return v === "table" || v === "cards" ? v : null;
}

function resolveAmbientViewMode(defaultViewMode: ViewMode, isMobile: boolean): ViewMode {
  if (isMobile && !readPreferTableOnMobile()) return "cards";
  return readDataViewerGlobalDefault() ?? defaultViewMode;
}

function resolveViewMode(
  viewModeKey: string | undefined,
  defaultViewMode: ViewMode,
  isMobile: boolean,
): ViewMode {
  if (viewModeKey) {
    const stored = readStoredViewMode(viewModeKey);
    if (stored) return stored;
  }
  return resolveAmbientViewMode(defaultViewMode, isMobile);
}

export function DataViewer<TRecord>({
  config,
  data,
  isLoading,
  defaultViewMode = "table",
  viewModeKey,
  globalFilter: controlledFilter,
  onGlobalFilterChange: controlledFilterChange,
  skipClientGlobalFilter = false,
  paginationResetKey,
  totalCount,
}: DataViewerProps<TRecord>) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultViewMode;
    return resolveViewMode(
      viewModeKey,
      defaultViewMode,
      window.matchMedia(DATA_VIEWER_MOBILE_MEDIA).matches,
    );
  });

  useEffect(() => {
    const mq = window.matchMedia(DATA_VIEWER_MOBILE_MEDIA);
    const apply = () => setViewMode(resolveViewMode(viewModeKey, defaultViewMode, mq.matches));
    apply();
    mq.addEventListener("change", apply);
    const onSettings = () => setViewMode(resolveViewMode(viewModeKey, defaultViewMode, mq.matches));
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onSettings);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onSettings);
    };
  }, [viewModeKey, defaultViewMode]);

  const [internalFilter, setInternalFilter] = useState("");
  const filter = controlledFilter ?? internalFilter;
  const setFilter = controlledFilterChange ?? setInternalFilter;

  const filteredData = useMemo(
    () =>
      skipClientGlobalFilter
        ? data
        : filterRowsByGlobalSearch(data, config.globalFilterColumnId, filter),
    [data, config.globalFilterColumnId, filter, skipClientGlobalFilter],
  );

  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: DATA_VIEWER_PAGE_SIZE,
  }));

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, paginationResetKey]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize) || 1);

  useEffect(() => {
    if (pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }));
    }
  }, [pageCount, pagination.pageIndex]);

  const onPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setPagination((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  }, []);

  const paginatedCardData = useMemo(() => {
    const { pageIndex, pageSize } = pagination;
    const start = pageIndex * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, pagination]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (viewModeKey) localStorage.setItem(viewModeKey, mode);
    },
    [viewModeKey],
  );

  if (isLoading) {
    return <DataViewerSkeleton viewMode={viewMode} />;
  }

  // Counts for toolbar
  const resolvedTotal = totalCount ?? data.length;
  const filteredCount = filteredData.length;

  return (
    <div className="space-y-4">
      <DataViewerToolbar
        labels={config.labels}
        actions={config.actions}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        filteredCount={filteredCount}
        totalCount={resolvedTotal}
        // Legacy props kept for compat — not rendered
        globalFilter={filter}
        onGlobalFilterChange={setFilter}
        showSearch={false}
      />

      {viewMode === "table" ? (
        <DataViewerTable
          config={config}
          data={filteredData}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
        />
      ) : (
        <DataViewerCardGrid
          config={config}
          data={paginatedCardData}
          filteredTotal={filteredData.length}
          pagination={pagination}
          pageCount={pageCount}
          onPaginationChange={onPaginationChange}
        />
      )}
    </div>
  );
}

function DataViewerSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "table") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 animate-pulse rounded-md bg-base-300/40" />
          <div className="ml-auto h-8 w-20 animate-pulse rounded-lg bg-base-300/40" />
        </div>
        <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-100 shadow-md shadow-black/15">
          <div className="h-10 border-b border-base-content/[0.06] bg-base-content/[0.03]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-12 items-center gap-4 border-b border-base-content/[0.05] px-4">
              <div className="h-4 w-24 animate-pulse rounded bg-base-300/40" />
              <div className="h-4 w-32 animate-pulse rounded bg-base-300/40" />
              <div className="h-4 w-20 animate-pulse rounded bg-base-300/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-32 animate-pulse rounded-md bg-base-300/40" />
        <div className="ml-auto h-8 w-20 animate-pulse rounded-lg bg-base-300/40" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-box border border-base-content/[0.06] bg-base-content/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
