"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdminPermissions, useCreatePermission } from "@/hooks/useAdminPermissions";
import { uiCreatePermissionActions } from "@/lib/authz/permissionDefinitions";
import { ApiError } from "@/lib/infra/api";

const COMMON_ENTITIES = [
  "individual",
  "family",
  "event",
  "note",
  "source",
  "place",
  "givenName",
  "lastName",
  "date",
  "openQuestion",
  "media",
  "album",
  "tag",
  "user",
  "role",
];

const SCOPE_OPTIONS = ["tree", "site", "user", "gedcom"] as const;

export default function AdminNewPermissionPage() {
  const router = useRouter();
  const createPermission = useCreatePermission();
  const existingPermissions = useAdminPermissions({ limit: 10_000, offset: 0 });

  const [entityMode, setEntityMode] = useState<"existing" | "custom">("existing");
  const [selectedEntity, setSelectedEntity] = useState(COMMON_ENTITIES[0]!);
  const [customEntity, setCustomEntity] = useState("");
  const [action, setAction] = useState("read");
  const [scope, setScope] = useState("tree");
  const [description, setDescription] = useState("");

  const entityOptions = useMemo(() => {
    const dynamic = (existingPermissions.data?.permissions ?? []).map((p) => p.entity);
    return Array.from(new Set([...COMMON_ENTITIES, ...dynamic])).sort((a, b) => a.localeCompare(b));
  }, [existingPermissions.data?.permissions]);

  const onCreatePermission = async () => {
    const entity = (entityMode === "custom" ? customEntity : selectedEntity).trim();
    if (!entity) {
      toast.error("Select or enter an entity.");
      return;
    }
    try {
      await createPermission.mutateAsync({
        entity,
        action,
        scope,
        description: description.trim() || undefined,
      });
      toast.success(`Added permission ${entity}:${action}:${scope}`);
      router.push("/admin/permissions");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create permission.");
    }
  };

  return (
    <AdminListPageShell
      title="Add permission"
      description="Define a new permission for an entity and scope."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Entity source</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={entityMode}
                onChange={(e) => setEntityMode(e.target.value === "custom" ? "custom" : "existing")}
              >
                <option value="existing">Choose existing entity</option>
                <option value="custom">Create new entity</option>
              </select>
            </div>

            {entityMode === "existing" ? (
              <div className="space-y-1">
                <Label>Entity</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                >
                  {entityOptions.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>New entity</Label>
                <Input value={customEntity} onChange={(e) => setCustomEntity(e.target.value)} placeholder="e.g. relationship" />
              </div>
            )}

            <div className="space-y-1">
              <Label>Allows</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                {uiCreatePermissionActions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Scope</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this allows" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/permissions")}>
              Cancel
            </Button>
            <Button onClick={() => void onCreatePermission()}>Create permission</Button>
          </div>
        </CardContent>
      </Card>
    </AdminListPageShell>
  );
}
