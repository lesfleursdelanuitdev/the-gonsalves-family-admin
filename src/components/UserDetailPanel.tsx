"use client";

import { useRef, useEffect, useState } from "react";
import {
  ShieldCheck,
  Shield,
  User,
  UserX,
  Link2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAdminUser,
  useUpdateUserRole,
  useCreateUserLink,
  useDeleteUserLink,
  type UserDetailResponse,
  type UserDetailLink,
} from "@/hooks/useAdminUsers";
import { IndividualPickerDialog } from "./IndividualPickerDialog";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

const ROLE_OPTIONS: Array<{
  value: "owner" | "maintainer" | "contributor" | "none";
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "owner",
    label: "Owner",
    description: "Full control of the tree: settings, roles, and all content.",
    Icon: ShieldCheck,
  },
  {
    value: "maintainer",
    label: "Maintainer",
    description: "Manage content and add contributors; cannot change owners or tree settings.",
    Icon: Shield,
  },
  {
    value: "contributor",
    label: "Contributor",
    description: "Can author stories and other user-created content for the tree.",
    Icon: User,
  },
  {
    value: "none",
    label: "None",
    description: "No tree-level role.",
    Icon: UserX,
  },
];

interface UserDetailPanelProps {
  userId: string | null;
  onClose: () => void;
}

export function UserDetailPanel({ userId, onClose }: UserDetailPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, error } = useAdminUser(userId ?? "");
  const updateRole = useUpdateUserRole();
  const createLink = useCreateUserLink();
  const deleteLink = useDeleteUserLink();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (userId) el.showModal();
    else el.close();
  }, [userId]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const payload = data as UserDetailResponse | undefined;
  const user = payload?.user;
  const role = payload?.role ?? "none";
  const links = payload?.links ?? [];

  return (
    <>
      <dialog
        ref={dialogRef}
        onCancel={onClose}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-0 shadow-none backdrop:bg-black/50"
      >
        <div
          onClick={handleContentClick}
          className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        >
        {!userId ? null : isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : error || !user ? (
          <div className="p-6 text-destructive">
            {error ? String((error as Error).message) : "User not found"}
          </div>
        ) : (
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 text-foreground">
              <h2 className="text-lg font-semibold">
                {user.name || user.username}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-6 p-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Account</CardTitle>
                  <CardDescription>@{user.username}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>{user.email}</p>
                  <p>
                    Status:{" "}
                    <span
                      className={
                        user.isActive
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tree role</CardTitle>
                  <CardDescription>
                    What this user can do in the admin tree.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Role</Label>
                    <select
                      value={role}
                      onChange={(e) => {
                        const v = e.target
                          .value as "owner" | "maintainer" | "contributor" | "none";
                        updateRole.mutate(
                          { id: userId!, role: v },
                          { onSuccess: () => {} },
                        );
                      }}
                      disabled={updateRole.isPending}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {
                        ROLE_OPTIONS.find((o) => o.value === role)
                          ?.description
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Linked individuals
                      </CardTitle>
                      <CardDescription>
                        People in the tree this user is linked to (e.g. “this is me”).
                      </CardDescription>
                    </div>
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
                </CardHeader>
                <CardContent>
                  {links.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No individuals linked. Add a link to associate this user
                      with a person in the tree.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {links.map((link) => (
                        <LinkedIndividualRow
                          key={link.id}
                          link={link}
                          userId={userId!}
                          onRemove={() =>
                            deleteLink.mutate({ userId: userId!, linkId: link.id })
                          }
                          isRemoving={deleteLink.isPending}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        </div>
      </dialog>

      {userId && (
        <IndividualPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={userId}
          existingXrefs={links.map((l) => l.individualXref)}
          onLinked={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function LinkedIndividualRow({
  link,
  userId,
  onRemove,
  isRemoving,
}: {
  link: UserDetailLink;
  userId: string;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const name = link.individualName
    ? stripSlashesFromName(link.individualName)
    : null;
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <span>
        <span className="font-mono text-muted-foreground">
          {link.individualXref}
        </span>
        {name && <span className="ml-2">{name}</span>}
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
