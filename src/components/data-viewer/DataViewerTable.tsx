"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Inbox,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataViewerConfig, DataViewerTableSelectionProps } from "./types";
import { DataViewerPagination } from "./DataViewerPagination";
import { useState, useMemo } from "react";

interface DataViewerTableProps<TRecord> {
  config: DataViewerConfig<TRecord>;
  data: TRecord[];
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  /** When true, parent owns pagination (server-side); table won't slice rows. */
  manualPagination?: boolean;
  /** Server-driven total page count. Required when {@link manualPagination} is true. */
  manualPageCount?: number;
  /** Server-driven total row count after filters. */
  manualRowCount?: number;
  /** Indicates a background fetch is in flight. */
  isFetching?: boolean;
  /** Parent-owned selection (cross-page). Required when {@link DataViewerConfig.enableRowSelection} is true. */
  selection?: DataViewerTableSelectionProps;
}

export function DataViewerTable<TRecord>({
  config,
  data,
  pagination,
  onPaginationChange,
  manualPagination = false,
  manualPageCount,
  manualRowCount,
  isFetching = false,
  selection,
}: DataViewerTableProps<TRecord>) {
  const [sorting, setSorting] = useState<SortingState>(config.defaultSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { actions } = config;
  const hasRowActions = !!(actions.view || actions.edit || actions.delete);

  const columns = useMemo<ColumnDef<TRecord, unknown>[]>(() => {
    const cols: ColumnDef<TRecord, unknown>[] = [];

    if (config.enableRowSelection && selection) {
      const sel = selection;
      cols.push({
        id: "_select",
        header: () => {
          const pageIds = sel.pageRowIds;
          const allSelected = pageIds.length > 0 && pageIds.every((id) => sel.selectedIds.has(id));
          const someSelected = pageIds.some((id) => sel.selectedIds.has(id)) && !allSelected;
          return (
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={() => sel.onToggleSelectPage()}
              aria-label="Select all on page"
            />
          );
        },
        cell: ({ row, table }) => {
          const pageIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
          return (
            <div
              className="flex items-center justify-center py-0.5"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                sel.onToggleRow(row.id, Math.max(0, pageIndex), e);
              }}
            >
              <Checkbox
                checked={sel.selectedIds.has(row.id)}
                className="pointer-events-none"
                aria-label="Select row"
              />
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      });
    }

    cols.push(...config.columns);

    if (hasRowActions) {
      cols.push({
        id: "_actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions record={row.original} config={config} />,
      });
    }

    return cols;
  }, [config, hasRowActions, selection]);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => config.getRowId(row),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true as const,
          pageCount: Math.max(1, manualPageCount ?? 1),
          rowCount: manualRowCount ?? data.length,
        }
      : { getPaginationRowModel: getPaginationRowModel() }),
    onPaginationChange,
    state: { sorting, columnFilters, pagination },
  });

  const totalCount = manualPagination
    ? (manualRowCount ?? data.length)
    : table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "overflow-hidden rounded-box border border-base-content/[0.08] bg-base-100 shadow-md shadow-black/15 transition-opacity",
          isFetching && "opacity-70",
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex w-full items-center gap-1.5 text-left font-medium hover:opacity-80"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="inline-flex shrink-0 text-muted-foreground">
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="size-4" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="size-4" />
                          ) : (
                            <ArrowUpDown className="size-4 opacity-50" />
                          )}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selection?.selectedIds.has(row.id) ? "selected" : undefined}
                  className="group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-base-200/60">
                      <Inbox className="size-6 text-muted-foreground/40" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-base-content">
                        No {config.labels.plural.toLowerCase()} found
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try adjusting your search or filters.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sticky pagination footer */}
      <div className="sticky bottom-0 z-10 rounded-b-box border-t border-base-content/[0.08] bg-base-100/95 px-1 py-3 backdrop-blur-md">
        <DataViewerPagination
          pagination={pagination}
          pageCount={table.getPageCount()}
          filteredTotal={totalCount}
          onPaginationChange={onPaginationChange}
        />
      </div>
    </div>
  );
}

/* ── Per-row actions ──────────────────────────────────────────────────── */

function RowActions<TRecord>({
  record,
  config,
}: {
  record: TRecord;
  config: DataViewerConfig<TRecord>;
}) {
  const { actions } = config;
  return (
    <div className="flex items-center justify-end gap-1">
      {/* Inline quick actions — visible on row hover */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {actions.view && (
          <button
            type="button"
            onClick={() => actions.view!.handler(record)}
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "gap-1 border-base-content/15 text-primary hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <Eye className="size-3" />
            {actions.view.label}
          </button>
        )}
        {actions.edit && (
          <button
            type="button"
            onClick={() => actions.edit!.handler(record)}
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "gap-1 border-base-content/15 hover:border-base-content/25",
            )}
          >
            <Pencil className="size-3" />
            {actions.edit.label}
          </button>
        )}
      </div>

      {/* ⋯ overflow menu — always available for delete + fallback */}
      {(actions.delete || (actions.view && actions.edit)) && (
        <DropdownMenu>
          <DropdownMenuTrigger className="btn btn-ghost btn-square btn-sm border-0 shadow-none opacity-0 transition-opacity group-hover:opacity-100">
            <span className="sr-only">More actions</span>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              {actions.view && (
                <DropdownMenuItem onClick={() => actions.view!.handler(record)}>
                  <Eye className="size-4 text-muted-foreground" />
                  {actions.view.label}
                </DropdownMenuItem>
              )}
              {actions.edit && (
                <DropdownMenuItem onClick={() => actions.edit!.handler(record)}>
                  <Pencil className="size-4 text-muted-foreground" />
                  {actions.edit.label}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            {actions.delete && (actions.view || actions.edit) && <DropdownMenuSeparator />}
            {actions.delete && (
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  nativeButton
                  onClick={() => actions.delete!.handler(record)}
                >
                  <Trash2 className="size-4" />
                  {actions.delete.label}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
