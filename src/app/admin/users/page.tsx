"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Shield, User } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminUsers, type AdminUsersListResponse } from "@/hooks/useAdminUsers";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";

interface UserRow {
  id: string;
  username: string;
  email: string;
  name: string;
  role: "owner" | "maintainer" | "contributor" | "none";
  isActive: boolean;
}

const roleIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: ShieldCheck,
  maintainer: Shield,
  contributor: User,
  none: User,
};

function mapApiToRows(api: AdminUsersListResponse): UserRow[] {
  return (api?.users ?? []).map(({ user, role }) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name ?? "",
    role: (role === "owner" || role === "maintainer" || role === "contributor" ? role : "none") as UserRow["role"],
    isActive: user.isActive,
  }));
}

const config: DataViewerConfig<UserRow> = {
  id: "users",
  labels: { singular: "User", plural: "Users" },
  getRowId: (row) => row.id,
  enableRowSelection: false,
  columns: [
    { accessorKey: "username", header: "Username", enableSorting: true },
    { accessorKey: "name", header: "Name", enableSorting: true },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <span className="capitalize">{(row.getValue("role") as string) || "—"}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const active = row.getValue("isActive") as boolean;
        return (
          <span className={active ? "text-green-600" : "text-muted-foreground"}>
            {active ? "Active" : "Inactive"}
          </span>
        );
      },
    },
  ],
  renderCard: ({ record, onView, onEdit, onDelete }) => {
    const RoleIcon = roleIcon[record.role] ?? User;
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <RoleIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{record.name || record.username}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">@{record.username}</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>{record.email}</p>
          <p className="capitalize">{(record.role === "none" ? "—" : record.role)} · {record.isActive ? "Active" : "Inactive"}</p>
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </Card>
    );
  },
  actions: {
    add: { label: "Add user", handler: () => {} },
    view: { label: "View", handler: () => {} },
    edit: { label: "Edit", handler: () => {} },
    delete: { label: "Delete", handler: (r) => alert(`Delete: ${r.name || r.username}`) },
  },
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminUsers(queryOpts);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const configWithActions = useMemo<DataViewerConfig<UserRow>>(
    () => ({
      ...config,
      actions: {
        ...config.actions,
        add: {
          label: "Add user",
          handler: () => router.push("/admin/users/new"),
        },
        view: {
          label: "View",
          handler: (r) => router.push(`/admin/users/${r.id}`),
        },
        edit: {
          label: "Edit",
          handler: (r) => router.push(`/admin/users/${r.id}/edit`),
        },
      },
    }),
    [router]
  );

  return (
    <AdminListPageShell
      title="Users & access"
      description="Tree owners, maintainers, contributors, and account management."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={clearFilters}
          activeFilterCount={adminListQActiveFilterCount(applied)}
        >
          <div className="space-y-2">
            <Label htmlFor="users-filter-q">Search users</Label>
            <Input
              id="users-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Username, email, or display name"
            />
            <p className="text-xs text-muted-foreground">
              Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={configWithActions}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-users-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
