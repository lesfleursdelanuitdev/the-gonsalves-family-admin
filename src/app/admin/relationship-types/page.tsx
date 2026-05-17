"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
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
  useAdminRelationshipTypes,
  useDeleteRelationshipType,
  type AdminRelationshipType,
} from "@/hooks/useAdminRelationshipTypes";
import { ApiError } from "@/lib/infra/api";

interface RelationshipTypeRow {
  id: string;
  key: string;
  label: string;
  scope: "Global" | "Tree";
  isSymmetric: boolean;
  roleCount: number;
  rolesSummary: string;
  description: string | null;
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: RelationshipTypeRow) => void,
): DataViewerConfig<RelationshipTypeRow> {
  return {
    id: "relationship-types",
    labels: { singular: "Relationship type", plural: "Relationship types" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "label", header: "Label", enableSorting: true },
      { accessorKey: "key", header: "Key", enableSorting: true },
      { accessorKey: "scope", header: "Scope", enableSorting: true },
      {
        accessorKey: "isSymmetric",
        header: "Directionality",
        enableSorting: true,
        cell: ({ row }) => ((row.getValue("isSymmetric") as boolean) ? "Symmetric" : "Directional"),
      },
      { accessorKey: "roleCount", header: "Roles", enableSorting: true },
      { accessorKey: "rolesSummary", header: "Role labels", enableSorting: false },
    ],
    renderCard: ({ record, onDelete: _onDelete }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.label}</CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{record.key}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{record.scope} scope</p>
          <p>{record.isSymmetric ? "Symmetric relationship" : "Directional relationship"}</p>
          <p>{record.roleCount} role(s): {record.rolesSummary || "None configured"}</p>
          {record.description ? <p className="pt-1 italic">{record.description}</p> : null}
        </CardContent>
        <CardActionFooter onDelete={() => onDelete(record)} />
      </Card>
    ),
    actions: {
      add: { label: "New type", handler: () => router.push("/admin/relationship-types/new") },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

function mapRelationshipTypeToRow(item: AdminRelationshipType): RelationshipTypeRow {
  return {
    id: item.id,
    key: item.key,
    label: item.label,
    scope: item.treeId ? "Tree" : "Global",
    isSymmetric: item.isSymmetric,
    roleCount: item.roles.length,
    rolesSummary: item.roles.map((role) => role.label).join(", "),
    description: item.description,
  };
}

export default function AdminRelationshipTypesPage() {
  const router = useRouter();
  const { draft, applied, updateDraft, apply, clear } = useAdminListQFilters();
  const list = useAdminRelationshipTypes();
  const deleteType = useDeleteRelationshipType();

  const rows = useMemo(() => (list.data?.relationshipTypes ?? []).map(mapRelationshipTypeToRow), [list.data]);
  const filteredRows = useMemo(() => {
    const q = applied.q.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q) ||
        row.rolesSummary.toLowerCase().includes(q),
    );
  }, [applied.q, rows]);

  const onDelete = useCallback(
    async (row: RelationshipTypeRow) => {
      if (!window.confirm(`Delete relationship type "${row.label}"? This cannot be undone.`)) return;
      try {
        await deleteType.mutateAsync(row.id);
        toast.success(`Deleted "${row.label}".`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Could not delete relationship type.");
      }
    },
    [deleteType],
  );

  const config = useMemo(() => buildConfig(router, onDelete), [router, onDelete]);

  const loadErrorMessage = useMemo(() => {
    if (!list.isError) return null;
    if (list.error instanceof ApiError) return list.error.message;
    if (list.error instanceof Error && list.error.message.trim()) return list.error.message;
    return "Could not load relationship types.";
  }, [list.error, list.isError]);

  const setupMessage = list.data?.schemaReady === false ? (list.data.setupMessage ?? null) : null;

  return (
    <AdminListPageShell
      title="Relationship types"
      description="Manage relationship definitions and roles used by rich individual relationships."
      filters={
        <FilterPanel onApply={apply} onClear={clear} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="relationship-types-filter-q">Search relationship types</Label>
            <Input
              id="relationship-types-filter-q"
              value={draft.q}
              onChange={(event) => updateDraft("q", event.target.value)}
              placeholder="Label, key, or role…"
            />
          </div>
        </FilterPanel>
      }
    >
      {loadErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Could not load relationship types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadErrorMessage}</p>
            <Button variant="outline" onClick={() => void list.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}
      {setupMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relationship schema not applied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{setupMessage}</p>
            <p className="text-xs text-muted-foreground">
              Once migrations run, refresh this page to load and manage relationship types.
            </p>
          </CardContent>
        </Card>
      ) : null}
      <DataViewer
        config={config}
        data={filteredRows}
        isLoading={list.isLoading}
        viewModeKey="admin-relationship-types-view"
        totalCount={rows.length}
      />
    </AdminListPageShell>
  );
}
