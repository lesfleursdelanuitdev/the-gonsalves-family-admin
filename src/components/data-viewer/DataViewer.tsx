"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { toast } from "sonner";
import type { PaginationState, Updater } from "@tanstack/react-table";
import type { DataViewerProps, DataViewerSelectionChangeDetail, ViewMode } from "./types";
import { DATA_VIEWER_PAGE_SIZE } from "./constants";
import { filterRowsByGlobalSearch } from "./filterRows";
import { DataViewerToolbar } from "./DataViewerToolbar";
import { DataViewerTable } from "./DataViewerTable";
import { DataViewerCardGrid } from "./DataViewerCardGrid";
import { DataViewerSelectionBar } from "./DataViewerSelectionBar";
import { DataViewerBulkDeleteDialog } from "./DataViewerBulkDeleteDialog";
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
  serverPagination = false,
  pagination: controlledPagination,
  onPaginationChange: controlledOnPaginationChange,
  pageCount: controlledPageCount,
  isFetching = false,
  selectedRowIds: controlledSelectedRowIds,
  onSelectedRowIdsChange: controlledOnSelectedRowIdsChange,
  onSelectionDetailChange,
  batchApplyKey,
  onBulkDeleteFinished,
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
      skipClientGlobalFilter || serverPagination
        ? data
        : filterRowsByGlobalSearch(data, config.globalFilterColumnId, filter),
    [data, config.globalFilterColumnId, filter, skipClientGlobalFilter, serverPagination],
  );

  const [internalPagination, setInternalPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: DATA_VIEWER_PAGE_SIZE,
  }));

  const pagination = controlledPagination ?? internalPagination;

  const setPagination = useCallback(
    (updater: Updater<PaginationState>) => {
      if (controlledOnPaginationChange) {
        controlledOnPaginationChange(updater);
        return;
      }
      setInternalPagination((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [controlledOnPaginationChange],
  );

  useEffect(() => {
    if (controlledPagination) return;
    setInternalPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, paginationResetKey, controlledPagination]);

  const computedPageCount = serverPagination
    ? Math.max(1, controlledPageCount ?? 1)
    : Math.max(1, Math.ceil(filteredData.length / pagination.pageSize) || 1);

  useEffect(() => {
    if (controlledPagination) return;
    if (pagination.pageIndex >= computedPageCount) {
      setInternalPagination((p) => ({ ...p, pageIndex: Math.max(0, computedPageCount - 1) }));
    }
  }, [computedPageCount, pagination.pageIndex, controlledPagination]);

  const onPaginationChange = setPagination;

  /** Rows on the current page (matches table body and card grid). */
  const pageData = useMemo(() => {
    if (serverPagination) return filteredData;
    const { pageIndex, pageSize } = pagination;
    const start = pageIndex * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, pagination, serverPagination]);

  const pageRowIds = useMemo(() => pageData.map((row) => config.getRowId(row)), [pageData, config]);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(() => new Set());
  const selectionControlled =
    controlledSelectedRowIds != null && controlledOnSelectedRowIdsChange != null;
  const selectedIds = selectionControlled ? controlledSelectedRowIds! : internalSelectedIds;

  const setSelectedIds = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      if (selectionControlled) {
        controlledOnSelectedRowIdsChange!(updater(controlledSelectedRowIds!));
      } else {
        setInternalSelectedIds((prev) => updater(prev));
      }
    },
    [selectionControlled, controlledOnSelectedRowIdsChange, controlledSelectedRowIds],
  );

  const selectionAnchorRef = useRef<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const bulkDeleteIdsRef = useRef<string[]>([]);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ completed: number; total: number } | null>(null);
  const batchApplyKeyRef = useRef(batchApplyKey);

  const emitSelectionDetail = useCallback(
    (detail: DataViewerSelectionChangeDetail<TRecord>) => {
      onSelectionDetailChange?.(detail);
    },
    [onSelectionDetailChange],
  );

  const selectionResetRef = useRef({ setSelectedIds, emitSelectionDetail });
  selectionResetRef.current = { setSelectedIds, emitSelectionDetail };

  const handleClearSelection = useCallback(() => {
    setSelectedIds(() => new Set());
    selectionAnchorRef.current = null;
    emitSelectionDetail({ selectedIds: new Set(), kind: "clear" });
  }, [setSelectedIds, emitSelectionDetail]);

  useEffect(() => {
    if (batchApplyKey === undefined) return;
    if (batchApplyKeyRef.current === batchApplyKey) return;
    batchApplyKeyRef.current = batchApplyKey;
    handleClearSelection();
  }, [batchApplyKey, handleClearSelection]);

  const handleToggleRow = useCallback(
    (rowId: string, pageIndex: number, event: MouseEvent) => {
      const orderedIds = pageRowIds;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        let kind: "toggle" | "range" = "toggle";
        let affected: TRecord[] | undefined;
        let anchorUpdate: number | null | "keep" = "keep";

        if (event.shiftKey && selectionAnchorRef.current != null) {
          kind = "range";
          const a = Math.min(selectionAnchorRef.current, pageIndex);
          const b = Math.max(selectionAnchorRef.current, pageIndex);
          affected = [];
          for (let i = a; i <= b; i++) {
            const id = orderedIds[i];
            if (id) next.add(id);
            if (pageData[i]) affected.push(pageData[i]!);
          }
        } else {
          if (next.has(rowId)) next.delete(rowId);
          else next.add(rowId);
          anchorUpdate = pageIndex;
          affected = pageData[pageIndex] != null ? [pageData[pageIndex]!] : [];
        }

        queueMicrotask(() => {
          if (anchorUpdate !== "keep") {
            selectionAnchorRef.current = anchorUpdate;
          }
          emitSelectionDetail({ selectedIds: next, kind, affectedRecords: affected });
        });
        return next;
      });
    },
    [pageRowIds, pageData, setSelectedIds, emitSelectionDetail],
  );

  const handleToggleSelectPage = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = pageRowIds;
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      queueMicrotask(() => {
        selectionAnchorRef.current = allSelected ? null : 0;
        emitSelectionDetail({
          selectedIds: next,
          kind: "page",
          affectedRecords: pageData,
        });
      });
      return next;
    });
  }, [pageRowIds, pageData, setSelectedIds, emitSelectionDetail]);

  useEffect(() => {
    if (!config.enableRowSelection) return;
    if (paginationResetKey === undefined) return;
    const { setSelectedIds: setSel, emitSelectionDetail: emit } = selectionResetRef.current;
    setSel(() => new Set());
    selectionAnchorRef.current = null;
    emit({ selectedIds: new Set(), kind: "clear" });
  }, [paginationResetKey, config.enableRowSelection]);

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
  const filteredCount = serverPagination ? (totalCount ?? data.length) : filteredData.length;
  const cardFilteredTotal = serverPagination ? (totalCount ?? data.length) : filteredData.length;

  const selectionEnabled = !!config.enableRowSelection;
  const selectedCount = selectedIds.size;

  const bulkDeleteOne = config.actions.delete?.bulkDeleteOne;
  const bulkDeleteMany =
    config.actions.delete?.bulkDeleteIds ?? config.actions.delete?.bulkHandler ?? null;
  const canBulkDelete =
    selectionEnabled && !!config.actions.delete && (!!bulkDeleteOne || !!bulkDeleteMany);

  const openBulkDeleteDialog = () => {
    bulkDeleteIdsRef.current = Array.from(selectedIds);
    setBulkDeleteCount(bulkDeleteIdsRef.current.length);
    setBulkDeleteProgress(null);
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    const ids = [...bulkDeleteIdsRef.current];
    if (ids.length === 0) return;

    if (bulkDeleteOne) {
      const errors: string[] = [];
      setBulkDeleteProgress({ completed: 0, total: ids.length });
      for (let i = 0; i < ids.length; i++) {
        try {
          await bulkDeleteOne(ids[i]!);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
        setBulkDeleteProgress({ completed: i + 1, total: ids.length });
      }
      if (errors.length > 0) {
        const ok = ids.length - errors.length;
        if (ok > 0) {
          toast.error(`Deleted ${ok} of ${ids.length}. ${errors.slice(0, 2).join(" · ")}`);
        } else {
          throw new Error(errors[0] ?? "Delete failed");
        }
      } else {
        toast.success(
          `Deleted ${ids.length} ${ids.length === 1 ? config.labels.singular.toLowerCase() : config.labels.plural.toLowerCase()}.`,
        );
      }
      await onBulkDeleteFinished?.();
    } else if (bulkDeleteMany) {
      setBulkDeleteProgress(null);
      await bulkDeleteMany(ids);
    }
    setBulkDeleteProgress(null);
    handleClearSelection();
  };

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

      {selectionEnabled ? (
        <DataViewerSelectionBar
          selectedCount={selectedCount}
          pageRowIds={pageRowIds}
          selectedIds={selectedIds}
          actions={config.actions}
          onClear={handleClearSelection}
          onToggleSelectPage={handleToggleSelectPage}
          onBulkDelete={canBulkDelete ? openBulkDeleteDialog : undefined}
        />
      ) : null}

      <DataViewerBulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        pluralEntityLabel={config.labels.plural.toLowerCase()}
        selectedCount={bulkDeleteCount}
        deleteProgress={bulkDeleteProgress}
        onConfirm={confirmBulkDelete}
      />

      {viewMode === "table" ? (
        <DataViewerTable
          config={config}
          data={filteredData}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          manualPagination={serverPagination}
          manualPageCount={serverPagination ? computedPageCount : undefined}
          manualRowCount={serverPagination ? (totalCount ?? data.length) : undefined}
          isFetching={isFetching}
          selection={
            selectionEnabled
              ? {
                  selectedIds,
                  onToggleRow: handleToggleRow,
                  onToggleSelectPage: handleToggleSelectPage,
                  pageRowIds,
                }
              : undefined
          }
        />
      ) : (
        <DataViewerCardGrid
          config={config}
          data={pageData}
          filteredTotal={cardFilteredTotal}
          pagination={pagination}
          pageCount={computedPageCount}
          onPaginationChange={onPaginationChange}
          isFetching={isFetching}
          selection={
            selectionEnabled
              ? {
                  selectedIds,
                  onToggleRow: handleToggleRow,
                }
              : undefined
          }
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
