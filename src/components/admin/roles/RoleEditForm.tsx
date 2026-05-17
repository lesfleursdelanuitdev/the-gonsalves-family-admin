"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AdminEditorStickySaveBar } from "@/components/admin/editor-shell/AdminEditorStickySaveBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError, fetchJson } from "@/lib/infra/api";
import { toRoleKey } from "@/lib/authz/roles";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useAdminRole,
  useAssignUserRole,
  useCreateRole,
  useCreateRolePermission,
  useDeleteRole,
  useDeleteRolePermission,
  useDeleteUserRole,
  useUpdateRole,
} from "@/hooks/useAdminRoles";

const FORM_ID = "role-edit-form";
const ASSIGNMENTS_PER_PAGE = 5;
const PICKER_PERMISSIONS_PER_PAGE = 5;
const ASSIGNED_PERMISSIONS_PER_PAGE = 5;
const SCOPE_OPTIONS = ["site", "tree", "user", "gedcom"] as const;
const PERMISSION_TYPE_OPTIONS = ["all", "read", "create", "update", "delete"] as const;
type UserHit = { user: { id: string; username: string; email: string; name: string | null; isActive: boolean } };

type Props =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      roleId: string;
    };

export function RoleEditForm(props: Props) {
  const router = useRouter();
  const mode = props.mode;
  const roleId = mode === "edit" ? props.roleId : null;

  const detail = useAdminRole(roleId);
  const permissionCatalog = useAdminPermissions({ limit: 10_000, offset: 0 });
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const createPermission = useCreateRolePermission();
  const deletePermission = useDeleteRolePermission();
  const assignUserRole = useAssignUserRole();
  const removeUserRole = useDeleteUserRole();

  const role = mode === "edit" ? detail.data?.role : null;
  const pending =
    createRole.isPending ||
    updateRole.isPending ||
    createPermission.isPending ||
    deletePermission.isPending ||
    assignUserRole.isPending ||
    removeUserRole.isPending;

  const [nameDraft, setNameDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [scopeDraft, setScopeDraft] = useState("tree");
  const [keyTouched, setKeyTouched] = useState(false);

  const [entityFilter, setEntityFilter] = useState("all");
  const [permissionTypeFilter, setPermissionTypeFilter] = useState<(typeof PERMISSION_TYPE_OPTIONS)[number]>("all");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [pickerPage, setPickerPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignUserLabel, setAssignUserLabel] = useState("");
  const [assignTreeId, setAssignTreeId] = useState("");
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignedPermissionsPage, setAssignedPermissionsPage] = useState(1);
  const debouncedUserSearch = useDebouncedValue(userSearch.trim(), ADMIN_PICKER_DEBOUNCE_MS);

  const roleName = nameDraft || role?.name || "";
  const roleKey = keyTouched
    ? keyDraft
    : keyDraft || (roleName ? toRoleKey(roleName) : role?.key || "");
  const roleDescription = descriptionDraft || role?.description || "";
  const roleScope = scopeDraft || role?.scope || "tree";

  const catalogPermissions = useMemo(
    () => permissionCatalog.data?.permissions ?? [],
    [permissionCatalog.data?.permissions],
  );
  const assignedPermissionKeys = useMemo(
    () => new Set((role?.permissions ?? []).map((p) => `${p.entity}:${p.action}:${p.scope}`)),
    [role?.permissions],
  );
  const entityOptions = useMemo(
    () => Array.from(new Set(catalogPermissions.map((p) => p.entity))).sort((a, b) => a.localeCompare(b)),
    [catalogPermissions],
  );
  const filteredCatalogPermissions = useMemo(
    () =>
      catalogPermissions.filter((p) => {
        const entityMatches = entityFilter === "all" || p.entity === entityFilter;
        const actionMatches = permissionTypeFilter === "all" || p.action === permissionTypeFilter;
        return entityMatches && actionMatches;
      }),
    [catalogPermissions, entityFilter, permissionTypeFilter],
  );
  const availableCatalogPermissions = useMemo(
    () =>
      filteredCatalogPermissions.filter((p) => !assignedPermissionKeys.has(`${p.entity}:${p.action}:${p.scope}`)),
    [assignedPermissionKeys, filteredCatalogPermissions],
  );
  const assignedPermissions = role?.permissions ?? [];
  const assignedPermissionsPageCount = Math.max(
    1,
    Math.ceil(assignedPermissions.length / ASSIGNED_PERMISSIONS_PER_PAGE),
  );
  const safeAssignedPermissionsPage = Math.min(assignedPermissionsPage, assignedPermissionsPageCount);
  const paginatedAssignedPermissions = assignedPermissions.slice(
    (safeAssignedPermissionsPage - 1) * ASSIGNED_PERMISSIONS_PER_PAGE,
    safeAssignedPermissionsPage * ASSIGNED_PERMISSIONS_PER_PAGE,
  );
  const pickerPageCount = Math.max(
    1,
    Math.ceil(availableCatalogPermissions.length / PICKER_PERMISSIONS_PER_PAGE),
  );
  const safePickerPage = Math.min(pickerPage, pickerPageCount);
  const paginatedPickerPermissions = availableCatalogPermissions.slice(
    (safePickerPage - 1) * PICKER_PERMISSIONS_PER_PAGE,
    safePickerPage * PICKER_PERMISSIONS_PER_PAGE,
  );

  const assignments = role?.assignments ?? [];
  const pageCount = Math.max(1, Math.ceil(assignments.length / ASSIGNMENTS_PER_PAGE));
  const safePage = Math.min(assignmentPage, pageCount);
  const paginatedAssignments = assignments.slice(
    (safePage - 1) * ASSIGNMENTS_PER_PAGE,
    safePage * ASSIGNMENTS_PER_PAGE,
  );
  const userSearchQuery = useQuery({
    queryKey: ["admin", "role-editor", "user-search", debouncedUserSearch],
    queryFn: () =>
      fetchJson<{ users: UserHit[] }>(`/api/admin/users?limit=8&q=${encodeURIComponent(debouncedUserSearch)}`),
    enabled: debouncedUserSearch.length >= 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleName.trim();
    const key = toRoleKey(roleKey);
    if (!name) {
      toast.error("Role name is required.");
      return;
    }
    if (!key) {
      toast.error("Role key is required.");
      return;
    }

    try {
      const selected = catalogPermissions.filter((p) => selectedPermissionIds.has(p.id));
      const newRoleId =
        mode === "create"
          ? (await createRole.mutateAsync({
              name,
              key,
              description: roleDescription.trim(),
              scope: roleScope,
            })).role.id
          : (await updateRole.mutateAsync({
              id: role!.id,
              name,
              key,
              description: roleDescription.trim(),
              scope: roleScope,
            })).role.id;

      const toAttach = selected.filter((p) => !assignedPermissionKeys.has(`${p.entity}:${p.action}:${p.scope}`));
      const attachResults = await Promise.allSettled(
        toAttach.map((p) =>
          createPermission.mutateAsync({
            roleId: newRoleId,
            entity: p.entity,
            action: p.action,
            scope: p.scope,
          }),
        ),
      );
      const attachFailures = attachResults.filter((r) => r.status === "rejected").length;

      if (attachFailures > 0) {
        toast.error(`Saved role, but failed to attach ${attachFailures} permission(s).`);
      } else {
        toast.success(mode === "create" ? "Role created." : "Role saved.");
      }
      router.push(`/admin/roles/${newRoleId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : mode === "create" ? "Could not create role." : "Could not save role.");
    }
  };

  const detailErrorMessage = useMemo(() => {
    if (!detail.isError) return null;
    if (detail.error instanceof ApiError) return detail.error.message;
    if (detail.error instanceof Error && detail.error.message.trim()) return detail.error.message;
    return "Could not load role details.";
  }, [detail.error, detail.isError]);

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4 pb-32">
      {mode === "edit" && detail.isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading role…</CardContent>
        </Card>
      ) : null}

      {mode === "edit" && detailErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Could not load role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{detailErrorMessage}</p>
            <Button variant="outline" onClick={() => void detail.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{mode === "create" ? "Create role" : "Role details"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="role-name">Role name (user friendly)</Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(e) => {
                const value = e.target.value;
                setNameDraft(value);
                if (!keyTouched) setKeyDraft(toRoleKey(value));
              }}
              placeholder="e.g. Tree Reviewer"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-key">Role key (computer friendly)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="role-key"
                value={roleKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKeyDraft(e.target.value);
                }}
                placeholder="tree_reviewer"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setKeyTouched(false);
                  setKeyDraft(toRoleKey(roleName));
                }}
              >
                Auto
              </Button>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={roleDescription}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              placeholder="What this role is for"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-scope">Scope</Label>
            <select
              id="role-scope"
              className="h-9 w-full rounded-md border border-input bg-base-100 px-3 py-1 text-sm text-base-content"
              value={roleScope}
              onChange={(e) => setScopeDraft(e.target.value)}
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {mode === "edit" && role && !role.isSystem ? (
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!window.confirm(`Delete role "${role.name}"?`)) return;
                  try {
                    await deleteRole.mutateAsync(role.id);
                    toast.success(`Deleted role ${role.name}`);
                    router.push("/admin/roles");
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Could not delete role.");
                  }
                }}
              >
                Delete role
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission picker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>Filter by entity</Label>
                <select
                  className="h-9 w-52 rounded-md border border-input bg-base-100 px-3 py-1 text-sm text-base-content"
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPickerPage(1);
                  }}
                >
                  <option value="all">All entities</option>
                  {entityOptions.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Filter by permission type</Label>
                <select
                  className="h-9 w-52 rounded-md border border-input bg-base-100 px-3 py-1 text-sm text-base-content"
                  value={permissionTypeFilter}
                  onChange={(e) => {
                    setPermissionTypeFilter(
                      (PERMISSION_TYPE_OPTIONS as readonly string[]).includes(e.target.value)
                        ? (e.target.value as (typeof PERMISSION_TYPE_OPTIONS)[number])
                        : "all",
                    );
                    setPickerPage(1);
                  }}
                >
                  <option value="all">All types</option>
                  <option value="read">Read</option>
                  <option value="create">Create</option>
                  <option value="update">Edit</option>
                  <option value="delete">Delete</option>
                </select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedPermissionIds.size} selected · {availableCatalogPermissions.length} visible
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const next = new Set<string>(selectedPermissionIds);
                for (const p of catalogPermissions) {
                  if (!assignedPermissionKeys.has(`${p.entity}:${p.action}:${p.scope}`)) next.add(p.id);
                }
                setSelectedPermissionIds(next);
              }}
            >
              Select all permissions (all pages)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const next = new Set<string>(selectedPermissionIds);
                for (const p of availableCatalogPermissions) next.add(p.id);
                setSelectedPermissionIds(next);
              }}
            >
              Select all filtered (all pages)
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedPermissionIds(new Set())}>
              Clear selection
            </Button>
          </div>

          <div className="max-h-72 space-y-1 overflow-auto rounded border p-2">
            {paginatedPickerPermissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No available permissions for this filter.</p>
            ) : (
              paginatedPickerPermissions.map((p) => {
                const key = `${p.entity}:${p.action}:${p.scope}`;
                const checked = selectedPermissionIds.has(p.id);
                return (
                  <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-accent/30">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedPermissionIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        });
                      }}
                    />
                    <span className="space-y-0.5">
                      <span className="block font-mono">{key}</span>
                      <span className="block text-muted-foreground">{p.description || "No description provided."}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {availableCatalogPermissions.length === 0 ? 0 : (safePickerPage - 1) * PICKER_PERMISSIONS_PER_PAGE + 1}-
              {Math.min(safePickerPage * PICKER_PERMISSIONS_PER_PAGE, availableCatalogPermissions.length)} of{" "}
              {availableCatalogPermissions.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safePickerPage <= 1}
                onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                {safePickerPage} / {pickerPageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safePickerPage >= pickerPageCount}
                onClick={() => setPickerPage((p) => Math.min(pickerPageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>

          {mode === "edit" && role ? (
            <div className="space-y-2 rounded border p-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned permissions</p>
              {assignedPermissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No permissions assigned.</p>
              ) : (
                <div className="space-y-1">
                  {paginatedAssignedPermissions.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                      <span className="font-mono">
                        {p.entity}:{p.action}:{p.scope}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await deletePermission.mutateAsync({ roleId: role.id, permissionId: p.id });
                            toast.success("Permission removed.");
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : "Could not remove permission.");
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {assignedPermissions.length > 0 ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing{" "}
                    {(safeAssignedPermissionsPage - 1) * ASSIGNED_PERMISSIONS_PER_PAGE + 1}-
                    {Math.min(
                      safeAssignedPermissionsPage * ASSIGNED_PERMISSIONS_PER_PAGE,
                      assignedPermissions.length,
                    )}{" "}
                    of {assignedPermissions.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={safeAssignedPermissionsPage <= 1}
                      onClick={() =>
                        setAssignedPermissionsPage((p) => Math.max(1, p - 1))
                      }
                    >
                      Prev
                    </Button>
                    <span>
                      {safeAssignedPermissionsPage} / {assignedPermissionsPageCount}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={safeAssignedPermissionsPage >= assignedPermissionsPageCount}
                      onClick={() =>
                        setAssignedPermissionsPage((p) =>
                          Math.min(assignedPermissionsPageCount, p + 1),
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {mode === "edit" && role ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users with this role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paginatedAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="space-y-1">
                {paginatedAssignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded border px-2 py-2 text-xs">
                    <span>
                      {a.user.name || a.user.username} ({a.user.email}){a.tree ? ` · ${a.tree.name}` : " · site"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await removeUserRole.mutateAsync({ userId: a.userId, userRoleId: a.id });
                          toast.success("Assignment removed.");
                        } catch (err) {
                          toast.error(err instanceof ApiError ? err.message : "Could not remove assignment.");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {assignments.length === 0 ? 0 : (safePage - 1) * ASSIGNMENTS_PER_PAGE + 1}-
                {Math.min(safePage * ASSIGNMENTS_PER_PAGE, assignments.length)} of {assignments.length}
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setAssignmentPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span>
                  {safePage} / {pageCount}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setAssignmentPage((p) => Math.min(pageCount, p + 1))}>
                  Next
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded border p-2">
              <Label>Search user by username/email/name</Label>
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Type at least 2 characters"
              />
              {debouncedUserSearch.length < 2 ? (
                <p className="text-xs text-muted-foreground">Type at least 2 characters to search users.</p>
              ) : null}
              {userSearchQuery.isFetching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
              {debouncedUserSearch.length >= 2 && !userSearchQuery.isFetching ? (
                <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                  {(userSearchQuery.data?.users ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No users found.</p>
                  ) : (
                    (userSearchQuery.data?.users ?? []).map(({ user }) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent/30"
                        onClick={() => {
                          setAssignUserId(user.id);
                          setAssignUserLabel(user.name || user.username);
                          setUserSearch(`${user.username} (${user.email})`);
                        }}
                      >
                        <span className="font-medium">{user.name || user.username}</span>
                        <span className="block text-muted-foreground">
                          {user.username} · {user.email}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Selected: {assignUserId ? `${assignUserLabel} (${assignUserId})` : "None"}
              </p>
              <Label>Tree ID (optional)</Label>
              <Input value={assignTreeId} onChange={(e) => setAssignTreeId(e.target.value)} placeholder="UUID (tree-scoped assignment)" />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  if (!assignUserId) {
                    toast.error("Pick a user first.");
                    return;
                  }
                  try {
                    await assignUserRole.mutateAsync({
                      userId: assignUserId,
                      roleId: role.id,
                      treeId: assignTreeId.trim() || null,
                    });
                    setAssignUserId(null);
                    setAssignUserLabel("");
                    setUserSearch("");
                    setAssignTreeId("");
                    toast.success("User assigned.");
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Could not assign role.");
                  }
                }}
              >
                Assign user
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AdminEditorStickySaveBar
        pending={pending}
        cancelHref="/admin/roles"
        formId={FORM_ID}
        saveLabel={mode === "create" ? "Create role" : "Save role"}
        savingLabel={mode === "create" ? "Creating…" : "Saving…"}
        pendingHint={mode === "create" ? "Creating role and attaching permissions…" : "Saving role changes…"}
      />
    </form>
  );
}
