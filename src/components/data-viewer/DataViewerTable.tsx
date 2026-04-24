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
  type RowSelectionState,
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
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataViewerConfig } from "./types";
import { DataViewerPagination } from "./DataViewerPagination";
import { useState, useMemo, useCallback } from "react";

interface DataViewerTableProps<TRecord> {
  config: DataViewerConfig<TRecord>;
  data: TRecord[];
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
}

export function DataViewerTable<TRecord>({
  config,
  data,
  pagination,
  onPaginationChange,
}: DataViewerTableProps<TRecord>) {
  const [sorting, setSorting] = useState<SortingState>(config.defaultSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { actions } = config;
  const hasRowActions = !!(actions.view || actions.edit || actions.delete);

  const columns = useMemo<ColumnDef<TRecord, unknown>[]>(() => {
    const cols: ColumnDef<TRecord, unknown>[] = [];

    if (config.enableRowSelection) {
      cols.push({
        id: "_select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(!!checked)}
            aria-label="Select row"
          />
        ),
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
  }, [config, hasRowActions]);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => config.getRowId(row),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange,
    state: { sorting, columnFilters, rowSelection, pagination },
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const totalCount = table.getFilteredRowModel().rows.length;

  const handleBulkDelete = useCallback(() => {
    if (!actions.delete?.bulkHandler) return;
    const ids = table
      .getFilteredSelectedRowModel()
      .rows.map((r) => config.getRowId(r.original));
    actions.delete.bulkHandler(ids);
  }, [actions.delete, table, config]);

  return (
    <div className="space-y-3">
      {/* Bulk selection bar */}
      {config.enableRowSelection && selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-box bg-primary px-4 py-2.5 text-primary-content shadow-md shadow-primary/25">
          <span className="text-sm font-semibold">
            {selectedCount} of {totalCount} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {actions.delete?.bulkHandler && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 border border-white/20 bg-white/15 text-white hover:bg-white/25"
                onClick={handleBulkDelete}
              >
                <Trash2 className="size-3.5" />
                Delete selected
              </Button>
            )}
            <button
              type="button"
              onClick={() => table.toggleAllRowsSelected(false)}
              className="text-xs font-medium text-white/70 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-100 shadow-md shadow-black/15">
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
                  data-state={row.getIsSelected() ? "selected" : undefined}
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
