"use client";

import { ShieldCheck, Shield, User, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useAdminUser,
  type UserDetailResponse,
  type UserDetailLink,
} from "@/hooks/useAdminUsers";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

const ROLE_LABELS: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  owner: { label: "Owner", Icon: ShieldCheck },
  maintainer: { label: "Maintainer", Icon: Shield },
  contributor: { label: "Contributor", Icon: User },
  none: { label: "None", Icon: UserX },
};

interface ViewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export function ViewUserDialog({
  open,
  onOpenChange,
  userId,
}: ViewUserDialogProps) {
  const { data, isLoading, error } = useAdminUser(userId ?? "");
  const payload = data as UserDetailResponse | undefined;
  const user = payload?.user;
  const role = payload?.role ?? "none";
  const links = payload?.links ?? [];
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.none;
  const RoleIcon = roleInfo.Icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>View user</DialogTitle>
        <DialogDescription>
          Account details and linked individuals. To edit role or links, use the Edit action.
        </DialogDescription>

        {!userId ? null : isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading…</p>
        ) : error || !user ? (
          <p className="py-4 text-sm text-destructive">
            {error ? String((error as Error).message) : "User not found"}
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <section>
              <h3 className="text-sm font-medium text-muted-foreground">Account</h3>
              <p className="mt-1 text-foreground font-medium">
                {user.name || user.username}
              </p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm">
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
            </section>

            <section>
              <h3 className="text-sm font-medium text-muted-foreground">Tree role</h3>
              <div className="mt-1 flex items-center gap-2">
                <RoleIcon className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground capitalize">
                  {roleInfo.label}
                </span>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium text-muted-foreground">
                Linked individuals
              </h3>
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
                    <LinkedIndividualView key={link.id} link={link} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <DialogClose className="border-border hover:bg-muted hover:text-muted-foreground">
            Close
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkedIndividualView({ link }: { link: UserDetailLink }) {
  const name = link.individualName
    ? stripSlashesFromName(link.individualName)
    : null;
  return (
    <li className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className="font-mono text-muted-foreground">
        {link.individualXref}
      </span>
      {name && <span className="ml-2 text-foreground">{name}</span>}
      {link.verified && (
        <span className="ml-2 text-xs text-muted-foreground">(verified)</span>
      )}
    </li>
  );
}
