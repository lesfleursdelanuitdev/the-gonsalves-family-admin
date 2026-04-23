"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Link2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminUser,
  useUpdateUser,
  useUpdateUserRole,
  useCreateUserLink,
  useDeleteUserLink,
  type UserDetailResponse,
  type UserDetailLink,
} from "@/hooks/useAdminUsers";
import { IndividualPickerDialog } from "@/components/IndividualPickerDialog";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { ApiError } from "@/lib/infra/api";

type RoleValue = "owner" | "maintainer" | "contributor" | "none";

const ROLE_OPTIONS: { value: RoleValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "contributor", label: "Contributor" },
  { value: "maintainer", label: "Maintainer" },
  { value: "owner", label: "Owner" },
];

function LinkedIndividualRow({
  link,
  onRemove,
  isRemoving,
}: {
  link: UserDetailLink;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const name = link.individualName
    ? stripSlashesFromName(link.individualName)
    : null;
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <span>
        <span className="font-mono text-muted-foreground">{link.individualXref}</span>
        {name && <span className="ml-2 text-foreground">{name}</span>}
        {link.verified && (
          <span className="ml-2 text-xs text-muted-foreground">(verified)</span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        disabled={isRemoving}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [role, setRole] = useState<RoleValue>("none");

  const { data, isLoading, error } = useAdminUser(id ?? "");
  const updateUser = useUpdateUser();
  const updateRole = useUpdateUserRole();
  const createLink = useCreateUserLink();
  const deleteLink = useDeleteUserLink();

  const payload = data as UserDetailResponse | undefined;
  const user = payload?.user;
  const links = payload?.links ?? [];

  useEffect(() => {
    if (!payload?.user || !id) return;
    setName(payload.user.name ?? "");
    setEmail(payload.user.email ?? "");
    setIsActive(payload.user.isActive ?? true);
    setRole((payload.role as RoleValue) ?? "none");
  }, [id, payload?.user?.id, payload?.user?.name, payload?.user?.email, payload?.user?.isActive, payload?.role]);

  const handleSave = () => {
    if (!id || !user) return;
    updateUser.mutate(
      { id, name: name.trim() || undefined, email: email.trim(), isActive },
      { onSuccess: () => router.push(`/admin/users/${id}`) }
    );
    updateRole.mutate(
      { id, role },
      { onSuccess: () => {} }
    );
  };

  const errorMessage =
    updateUser.error?.message || updateRole.error?.message;
  const errorStatus =
    updateUser.error instanceof ApiError
      ? updateUser.error.status
      : updateRole.error instanceof ApiError
        ? updateRole.error.status
        : undefined;
  const isSaving = updateUser.isPending || updateRole.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={id ? `/admin/users/${id}` : "/admin/users"}
            aria-label="Back"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Edit user</h1>
            <p className="text-muted-foreground">
              Update account details, tree role, and linked individuals.
            </p>
          </div>
        </div>

        {!id ? (
          <p className="text-sm text-destructive">Missing user ID.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error || !user ? (
          <p className="text-sm text-destructive">
            {error ? String((error as Error).message) : "User not found"}
          </p>
        ) : (
          <div className="max-w-md space-y-6">
            {errorMessage && (
              <p className="text-sm text-destructive">
                {errorMessage}
                {errorStatus != null && ` (${errorStatus})`}
              </p>
            )}

            <section>
              <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">@{user.username}</p>
              <div className="mt-2 space-y-2">
                <Label htmlFor="edit-user-name">Display name</Label>
                <Input
                  id="edit-user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional display name"
                />
              </div>
              <div className="mt-2 space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="edit-user-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="edit-user-active" className="font-normal">
                  Active
                </Label>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-muted-foreground">Tree role</h2>
              <select
                id="edit-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleValue)}
                className="mt-1 flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Linked individuals
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  disabled={createLink.isPending}
                >
                  <Link2 className="size-4" />
                  Link to individual
                </Button>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                People in the tree this user is linked to.
              </p>
              {links.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No individuals linked.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {links.map((link) => (
                    <LinkedIndividualRow
                      key={link.id}
                      link={link}
                      onRemove={() => deleteLink.mutate({ userId: id, linkId: link.id })}
                      isRemoving={deleteLink.isPending}
                    />
                  ))}
                </ul>
              )}
            </section>

            <div className="flex gap-2">
              <Link
                href={`/admin/users/${id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Cancel
              </Link>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {id && pickerOpen && (
        <IndividualPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={id}
          existingXrefs={links.map((l) => l.individualXref)}
          onLinked={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
