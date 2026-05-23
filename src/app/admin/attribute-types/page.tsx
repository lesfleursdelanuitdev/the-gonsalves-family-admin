"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import {
  useAdminAttributeTypes,
  useDeleteAttributeType,
  type AdminAttributeType,
} from "@/hooks/useAdminAttributeTypes";
import { ApiError } from "@/lib/infra/api";

const SCOPE_LABELS: Record<string, string> = { INDI: "Individual", FAM: "Family", BOTH: "Both" };

interface AttributeTypeRow {
  id: string;
  tag: string;
  label: string;
  ownerScope: string;
  isCustom: boolean;
  color: string;
  sortOrder: number;
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: AttributeTypeRow) => void,
): DataViewerConfig<AttributeTypeRow> {
  return {
    id: "attribute-types",
    labels: { singular: "Attribute type", plural: "Attribute types" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "color",
        header: "Color",
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="inline-block size-4 rounded-full border border-border"
            style={{ backgroundColor: row.getValue("color") as string }}
          />
        ),
      },
      { accessorKey: "tag", header: "Tag", enableSorting: true },
      { accessorKey: "label", header: "Label", enableSorting: true },
      {
        accessorKey: "ownerScope",
        header: "Scope",
        enableSorting: true,
        cell: ({ row }) => SCOPE_LABELS[row.getValue("ownerScope") as string] ?? row.getValue("ownerScope"),
      },
      {
        accessorKey: "isCustom",
        header: "Type",
        enableSorting: true,
        cell: ({ row }) =>
          row.getValue("isCustom") ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Custom
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Standard
            </span>
          ),
      },
      { accessorKey: "sortOrder", header: "Sort", enableSorting: true },
    ],
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-3.5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: record.color }}
            />
            <ClipboardList className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.label}</CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{record.tag}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{SCOPE_LABELS[record.ownerScope] ?? record.ownerScope} scope</p>
          <p>{record.isCustom ? "Custom type" : "Standard type"}</p>
        </CardContent>
        {record.isCustom ? (
          <CardActionFooter
            onEdit={() => router.push(`/admin/attribute-types/${record.id}/edit`)}
            onDelete={() => onDelete(record)}
          />
        ) : null}
      </Card>
    ),
    actions: {
      add: { label: "New custom type", handler: () => router.push("/admin/attribute-types/new") },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

function mapToRow(item: AdminAttributeType): AttributeTypeRow {
  return {
    id: item.id,
    tag: item.tag,
    label: item.label,
    ownerScope: item.ownerScope,
    isCustom: item.isCustom,
    color: item.color,
    sortOrder: item.sortOrder,
  };
}

export default function AdminAttributeTypesPage() {
  const router = useRouter();
  const { draft, applied, updateDraft, apply, clear } = useAdminListQFilters();
  const list = useAdminAttributeTypes();
  const deleteType = useDeleteAttributeType();

  const rows = useMemo(() => (list.data?.attributeTypes ?? []).map(mapToRow), [list.data]);
  const filteredRows = useMemo(() => {
    const q = applied.q.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.tag.toLowerCase().includes(q) ||
        row.label.toLowerCase().includes(q) ||
        SCOPE_LABELS[row.ownerScope]?.toLowerCase().includes(q),
    );
  }, [applied.q, rows]);

  const onDelete = useCallback(
    async (row: AttributeTypeRow) => {
      if (!row.isCustom) {
        toast.error("Standard attribute types cannot be deleted.");
        return;
      }
      if (!window.confirm(`Delete custom attribute type "${row.label}" (${row.tag})? This cannot be undone.`)) return;
      try {
        await deleteType.mutateAsync(row.id);
        toast.success(`Deleted "${row.label}".`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Could not delete attribute type.");
      }
    },
    [deleteType],
  );

  const config = useMemo(() => buildConfig(router, onDelete), [router, onDelete]);

  const loadErrorMessage = useMemo(() => {
    if (!list.isError) return null;
    if (list.error instanceof ApiError) return list.error.message;
    if (list.error instanceof Error && list.error.message.trim()) return list.error.message;
    return "Could not load attribute types.";
  }, [list.error, list.isError]);

  return (
    <AdminListPageShell
      title="Attribute types"
      description="Standard GEDCOM attribute tags (occupation, education, religion, etc.) and any custom attribute types defined for this tree."
      filters={
        <FilterPanel onApply={apply} onClear={clear} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="attribute-types-filter-q">Search attribute types</Label>
            <Input
              id="attribute-types-filter-q"
              value={draft.q}
              onChange={(event) => updateDraft("q", event.target.value)}
              placeholder="Tag, label, or scope…"
            />
          </div>
        </FilterPanel>
      }
    >
      {loadErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Could not load attribute types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadErrorMessage}</p>
            <Button variant="outline" onClick={() => void list.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <DataViewer
        config={config}
        data={filteredRows}
        isLoading={list.isLoading}
        viewModeKey="admin-attribute-types-view"
        totalCount={rows.length}
      />
    </AdminListPageShell>
  );
}
