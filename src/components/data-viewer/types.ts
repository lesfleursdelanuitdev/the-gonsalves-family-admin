import type { MouseEvent } from "react";
import type { ColumnDef, PaginationState, SortingState, Updater } from "@tanstack/react-table";

export type ViewMode = "table" | "cards";

export interface DataViewerActions<TRecord> {
  add?: {
    label: string;
    handler: () => void;
  };
  view?: {
    label: string;
    handler: (record: TRecord) => void;
  };
  edit?: {
    label: string;
    handler: (record: TRecord) => void;
  };
  /** Opens a bulk flow (e.g. batch media editor). Receives all selected row ids across pages. */
  bulkEdit?: {
    label: string;
    handler: (ids: string[]) => void;
  };
  delete?: {
    label: string;
    handler: (record: TRecord) => void;
    /**
     * Deletes one row by id. When set, the DataViewer bulk-delete dialog runs deletes **sequentially**
     * and shows numeric progress. Prefer this over {@link bulkDeleteIds} for long bulk operations.
     */
    bulkDeleteOne?: (id: string) => void | Promise<void>;
    /**
     * Deletes every selected row id in one call. Used when {@link bulkDeleteOne} is omitted, or as a legacy hook.
     * When {@link bulkDeleteOne} is set, the viewer uses it for bulk delete instead of this.
     */
    bulkDeleteIds?: (ids: string[]) => void | Promise<void>;
    /** @deprecated Prefer {@link bulkDeleteIds} — same signature, same behavior in the UI. */
    bulkHandler?: (ids: string[]) => void | Promise<void>;
  };
}

/** For custom card layouts outside {@link DataViewerCardGrid} (the grid supplies its own checkbox when selection is on). */
export interface CardSelectionProps {
  isSelected: boolean;
  /** Toggle this card; `shiftKey` is read from the event for range selection. */
  onToggle: (event: MouseEvent) => void;
}

export interface CardRenderProps<TRecord> {
  record: TRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  selection?: CardSelectionProps;
}

export interface DataViewerConfig<TRecord> {
  /** Unique key for this entity (e.g. "individuals") */
  id: string;

  labels: {
    singular: string;
    plural: string;
  };

  /** Stable id for each row — used for keys, selection, and action routing */
  getRowId: (row: TRecord) => string;

  /** TanStack Table column defs (excluding auto-generated actions column) */
  columns: ColumnDef<TRecord, unknown>[];

  /**
   * Column id used for global filter.
   * NOTE: Search now lives inside FilterPanel per page.
   * This prop is kept for backward compatibility but the toolbar
   * no longer renders a search input — move search to your FilterPanel.
   * @deprecated Move search to your page's FilterPanel
   */
  globalFilterColumnId?: string;

  defaultSorting?: SortingState;

  /** Show row-selection checkboxes for bulk actions */
  enableRowSelection?: boolean;

  /** Render a single card for card view */
  renderCard: (props: CardRenderProps<TRecord>) => React.ReactNode;

  actions: DataViewerActions<TRecord>;
}

export interface DataViewerProps<TRecord> {
  config: DataViewerConfig<TRecord>;
  data: TRecord[];
  isLoading?: boolean;
  defaultViewMode?: ViewMode;
  /** Key for persisting view mode in localStorage */
  viewModeKey?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  /**
   * When true, the search box still updates `globalFilter` but rows are not
   * filtered client-side (server already narrowed the dataset).
   */
  skipClientGlobalFilter?: boolean;
  /**
   * When the server-backed result set changes (e.g. Apply on a filter panel),
   * reset table/card pagination even if the toolbar search string is unchanged.
   */
  paginationResetKey?: string;
  /**
   * Total unfiltered count from the server (used for "X of Y" result display).
   * If not provided, falls back to data.length.
   */
  totalCount?: number;
  /**
   * When true, `data` already represents the current server-paginated page; the viewer
   * skips client-side slicing and trusts {@link pagination} + {@link pageCount} from the
   * caller. Caller is responsible for refetching when pagination changes.
   */
  serverPagination?: boolean;
  /**
   * Controlled pagination state. Required when {@link serverPagination} is true; otherwise
   * the viewer manages pagination internally.
   */
  pagination?: PaginationState;
  /** Controlled pagination setter. Required alongside {@link pagination}. */
  onPaginationChange?: (updater: Updater<PaginationState>) => void;
  /** Server-driven page count (total pages) when {@link serverPagination} is true. */
  pageCount?: number;
  /** Indicates a background fetch is in flight (e.g. when paging on the server). */
  isFetching?: boolean;

  /**
   * Controlled row selection (Set of {@link DataViewerConfig.getRowId} values).
   * Pass both `selectedRowIds` and `onSelectedRowIdsChange`, or neither.
   */
  selectedRowIds?: Set<string>;
  onSelectedRowIdsChange?: (next: Set<string>) => void;
  /**
   * Notified after selection changes so pages can sync auxiliary state (e.g. per-row scope).
   */
  onSelectionDetailChange?: (detail: DataViewerSelectionChangeDetail<TRecord>) => void;

  /**
   * When this value changes, clears row selection (e.g. after a bulk-edit modal applies).
   */
  batchApplyKey?: number;

  /**
   * Called once after a sequential bulk delete ({@link DataViewerActions.delete.bulkDeleteOne}) finishes
   * without total failure — use to invalidate list queries (the viewer already shows toasts).
   */
  onBulkDeleteFinished?: () => void | Promise<void>;
}

/** Argument for {@link DataViewerProps.onSelectionDetailChange}. */
export type DataViewerSelectionChangeKind = "clear" | "page" | "toggle" | "range";

export interface DataViewerSelectionChangeDetail<TRecord> {
  selectedIds: Set<string>;
  kind: DataViewerSelectionChangeKind;
  /** Rows on the current page affected by the last action (for range: all rows in the span). */
  affectedRecords?: TRecord[];
}

/** Parent-owned row selection passed into {@link DataViewerTable}. */
export interface DataViewerTableSelectionProps {
  selectedIds: Set<string>;
  pageRowIds: string[];
  onToggleRow: (rowId: string, pageIndex: number, event: MouseEvent) => void;
  onToggleSelectPage: () => void;
}
