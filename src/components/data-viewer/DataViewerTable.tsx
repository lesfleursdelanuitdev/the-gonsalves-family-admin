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
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
  const [sorting, setSorting] = useState<SortingState>(
    config.defaultSorting ?? []
  );
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
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(!!checked)
            }
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
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
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
      <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-100 app-light:bg-base-content/[0.065] shadow-md shadow-black/15">
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
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
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
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No {config.labels.plural.toLowerCase()} found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: selection info + pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {config.enableRowSelection && selectedCount > 0 && (
            <>
              <span>
                {selectedCount} of {totalCount} selected
              </span>
              {actions.delete?.bulkHandler && (
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="size-3" />
                  Delete selected
                </Button>
              )}
            </>
          )}
        </div>
        <DataViewerPagination
          pagination={pagination}
          pageCount={table.getPageCount()}
          onPaginationChange={onPaginationChange}
        />
      </div>
    </div>
  );
}

/* ── Per-row actions dropdown ─────────────────────────────────── */

function RowActions<TRecord>({
  record,
  config,
}: {
  record: TRecord;
  config: DataViewerConfig<TRecord>;
}) {
  const { actions } = config;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="btn btn-ghost btn-square btn-sm border-0 shadow-none">
        <span className="sr-only">Open menu</span>
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
        {actions.delete && (actions.view || actions.edit) && (
          <DropdownMenuSeparator />
        )}
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
  );
}
