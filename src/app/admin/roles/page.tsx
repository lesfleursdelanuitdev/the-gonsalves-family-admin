"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/infra/api";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import {
  useAdminRoles,
  useDeleteRole,
  type AdminRoleListItem,
} from "@/hooks/useAdminRoles";

function buildConfig(
  onView: (id: string) => void,
  onEdit: (row: AdminRoleListItem) => void,
  onDelete: (row: AdminRoleListItem) => void,
): DataViewerConfig<AdminRoleListItem> {
  return {
    id: "roles",
    labels: { singular: "Role", plural: "Roles" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "name", header: "Name", enableSorting: true },
      { accessorKey: "key", header: "Key", enableSorting: true },
      { accessorKey: "scope", header: "Scope", enableSorting: true },
      { accessorKey: "permissionCount", header: "Permissions", enableSorting: true },
      { accessorKey: "assignmentCount", header: "Assignments", enableSorting: true },
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
            <Shield className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.name}</CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{record.key}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{record.scope} scope</p>
          <p>
            {record.permissionCount} permission(s) · {record.assignmentCount} assignment(s)
          </p>
          <p>{record.isSystem ? "System role" : "Custom role"}</p>
        </CardContent>
        <CardActionFooter
          onView={() => onView(record.id)}
          onEdit={() => onEdit(record)}
          onDelete={record.isSystem ? undefined : () => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      add: { label: "Create role", handler: () => {} },
      view: { label: "Open", handler: (r) => onView(r.id) },
      edit: { label: "Edit", handler: onEdit },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminRolesPage() {
  const router = useRouter();
  const { draft, applied, queryOpts, updateDraft, apply, clear } = useAdminListQFilters();
  const { data, isLoading, isError, error, refetch } = useAdminRoles(queryOpts);
  const deleteRole = useDeleteRole();

  const rows = useMemo(() => data?.roles ?? [], [data]);
  const loadErrorMessage = useMemo(() => {
    if (!isError) return null;
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Could not load roles.";
  }, [error, isError]);

  const onCreateRole = useCallback(() => {
    router.push("/admin/roles/new");
  }, [router]);

  const onEditRole = useCallback((row: AdminRoleListItem) => {
    router.push(`/admin/roles/${row.id}`);
  }, [router]);

  const onDeleteRole = useCallback(async (row: AdminRoleListItem) => {
    if (!window.confirm(`Delete role "${row.name}"?`)) return;
    try {
      await deleteRole.mutateAsync(row.id);
      toast.success(`Deleted role ${row.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete role.");
    }
  }, [deleteRole]);

  const config = useMemo(() => {
    const base = buildConfig((id) => router.push(`/admin/roles/${id}`), onEditRole, onDeleteRole);
    return {
      ...base,
      actions: {
        ...base.actions,
        add: { label: "Create role", handler: onCreateRole },
      },
    } satisfies DataViewerConfig<AdminRoleListItem>;
  }, [onCreateRole, onDeleteRole, onEditRole, router]);

  return (
    <AdminListPageShell
      title="Roles"
      description="Database-managed role bundles with permission-based authorization."
      filters={
        <FilterPanel onApply={apply} onClear={clear} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="roles-filter-q">Search roles</Label>
            <Input
              id="roles-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name or key"
            />
          </div>
        </FilterPanel>
      }
    >
      {loadErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Could not load roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadErrorMessage}</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <div>
        <DataViewer
          config={config}
          data={rows}
          isLoading={isLoading}
          viewModeKey="admin-roles-view"
          skipClientGlobalFilter
          paginationResetKey={applied.q}
          totalCount={data?.total}
        />
      </div>
    </AdminListPageShell>
  );
}

