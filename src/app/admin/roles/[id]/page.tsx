"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { RoleEditForm } from "@/components/admin/roles/RoleEditForm";

export default function AdminRoleDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const roleId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  return (
    <AdminListPageShell
      title="Role"
      description="View and edit role configuration, permissions, and assignments."
    >
      <RoleEditForm mode="edit" roleId={roleId} />
    </AdminListPageShell>
  );
}
