"use client";

import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { RoleEditForm } from "@/components/admin/roles/RoleEditForm";

export default function AdminRoleNewPage() {
  return (
    <AdminListPageShell
      title="Create role"
      description="Create a role with a friendly name, key, and permission assignments."
    >
      <RoleEditForm mode="create" />
    </AdminListPageShell>
  );
}
