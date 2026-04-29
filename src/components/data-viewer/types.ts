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
  delete?: {
    label: string;
    handler: (record: TRecord) => void;
    bulkHandler?: (ids: string[]) => void;
  };
}

export interface CardRenderProps<TRecord> {
  record: TRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
}
