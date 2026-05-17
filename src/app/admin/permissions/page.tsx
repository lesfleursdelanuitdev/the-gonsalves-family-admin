"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { useAdminPermissions, useDeletePermission, type AdminPermissionItem } from "@/hooks/useAdminPermissions";
import { ApiError } from "@/lib/infra/api";

function buildConfig(onDelete: (row: AdminPermissionItem) => void): DataViewerConfig<AdminPermissionItem> {
  return {
    id: "permissions",
    labels: { singular: "Permission", plural: "Permissions" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "entity", header: "Entity", enableSorting: true },
      {
        accessorKey: "action",
        header: "Allows",
        enableSorting: true,
        cell: ({ row }) => ((row.getValue("action") as string) === "update" ? "edit" : (row.getValue("action") as string)),
      },
      { accessorKey: "scope", header: "Scope", enableSorting: true },
      { accessorKey: "description", header: "Description" },
      { accessorKey: "roleUsageCount", header: "Used by roles", enableSorting: true },
      {
        accessorKey: "isSystem",
        header: "Kind",
        cell: ({ row }) => ((row.getValue("isSystem") as boolean) ? "System" : "Custom"),
      },
    ],
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.entity}</CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {record.action === "update" ? "edit" : record.action}:{record.scope}
          </p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{record.description || "No description provided."}</p>
          <p>{record.roleUsageCount} role assignment(s)</p>
          <p>{record.isSystem ? "System permission" : "Custom permission"}</p>
        </CardContent>
        <CardActionFooter onDelete={record.isSystem ? undefined : () => onDelete(record)} />
      </Card>
    ),
    actions: {
      add: { label: "Add permission", handler: () => {} },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { draft, applied, queryOpts, updateDraft, apply, clear } = useAdminListQFilters();
  const { data, isLoading, isError, error, refetch } = useAdminPermissions(queryOpts);
  const deletePermission = useDeletePermission();

  const rows = useMemo(() => data?.permissions ?? [], [data]);
  const loadErrorMessage = useMemo(() => {
    if (!isError) return null;
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Could not load permissions.";
  }, [error, isError]);

  const onDeletePermission = useCallback(async (row: AdminPermissionItem) => {
    if (row.isSystem) {
      toast.error("System permissions for existing entities cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete permission ${row.entity}:${row.action}:${row.scope}?`)) return;
    try {
      await deletePermission.mutateAsync(row.id);
      toast.success("Permission deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete permission.");
    }
  }, [deletePermission]);

  const config = useMemo(() => {
    const base = buildConfig(onDeletePermission);
    return {
      ...base,
      actions: {
        ...base.actions,
        add: { label: "Add permission", handler: () => router.push("/admin/permissions/new") },
      },
    } satisfies DataViewerConfig<AdminPermissionItem>;
  }, [onDeletePermission, router]);

  return (
    <AdminListPageShell
      title="Permissions"
      description="Central catalog of authorization permissions and what each one allows."
      filters={
        <FilterPanel onApply={apply} onClear={clear} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="permissions-filter-q">Search permissions</Label>
            <Input
              id="permissions-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Entity, action, scope, or description"
            />
          </div>
        </FilterPanel>
      }
    >
      <div className="space-y-4">
        {loadErrorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Could not load permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{loadErrorMessage}</p>
              <Button variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <DataViewer
          config={config}
          data={rows}
          isLoading={isLoading}
          viewModeKey="admin-permissions-view"
          skipClientGlobalFilter
          paginationResetKey={applied.q}
          totalCount={data?.total}
        />
      </div>
    </AdminListPageShell>
  );
}
