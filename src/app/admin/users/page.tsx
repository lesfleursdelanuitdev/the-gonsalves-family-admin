"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Shield, User } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminUsers, type AdminUsersListResponse } from "@/hooks/useAdminUsers";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";

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
  globalFilterColumnId: "name",
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
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminUsers({
    q: search.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users & access</h1>
        <p className="text-muted-foreground">
          Tree owners, maintainers, contributors, and account management.
        </p>
      </div>
      <DataViewer
        config={configWithActions}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-users-view"
        globalFilter={search}
        onGlobalFilterChange={setSearch}
      />
    </div>
  );
}
