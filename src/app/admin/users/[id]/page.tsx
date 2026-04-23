"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Shield, User, UserCircle, UserX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useAdminUser,
  type UserDetailResponse,
  type UserDetailLink,
} from "@/hooks/useAdminUsers";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";

const ROLE_LABELS: Record<
  string,
  { label: string; Icon: ComponentType<{ className?: string }> }
> = {
  owner: { label: "Owner", Icon: ShieldCheck },
  maintainer: { label: "Maintainer", Icon: Shield },
  contributor: { label: "Contributor", Icon: User },
  none: { label: "None", Icon: UserX },
};

function formatLinkedIndividualName(link: UserDetailLink): string {
  const fromForms = formatDisplayNameFromNameForms(
    link.individualNameForms as Parameters<typeof formatDisplayNameFromNameForms>[0],
    link.individualName,
  );
  if (fromForms) return fromForms;
  const stripped = stripSlashesFromName(link.individualName);
  if (stripped) return stripped;
  return link.individualXref;
}

function LinkedIndividualRow({ link }: { link: UserDetailLink }) {
  const displayName = formatLinkedIndividualName(link);
  const nameContent =
    link.individualId != null ? (
      <Link href={`/admin/individuals/${link.individualId}`} className="link link-primary font-medium">
        {displayName}
      </Link>
    ) : (
      <span className="font-medium text-base-content">{displayName}</span>
    );

  return (
    <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15">
      <div className="flex flex-wrap items-center gap-2">
        {nameContent}
        {link.verified ? (
          <span className="badge badge-outline badge-primary badge-sm font-normal">Verified</span>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{link.individualXref}</p>
      {link.individualId == null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No matching person in this tree (check xref).
        </p>
      ) : null}
    </div>
  );
}

function profileEntries(profile: unknown): { key: string; value: string }[] {
  if (profile == null || typeof profile !== "object") return [];
  const out: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(profile as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out.push({ key: k, value: String(v) });
    }
  }
  return out;
}

export default function ViewUserPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminUser(id);
  const payload = data as UserDetailResponse | undefined;
  const user = payload?.user;
  const role = payload?.role ?? "none";
  const links = payload?.links ?? [];
  const profile = payload?.profile;
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.none;
  const RoleIcon = roleInfo.Icon;

  const displayTitle = user?.name?.trim() || user?.username || "User";
  const profileRows = profileEntries(profile);

  if (!id) {
    return <p className="text-muted-foreground">Missing user id.</p>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error || !user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-20">
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex w-fit gap-2")}
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>
        <p className="text-destructive">
          {error ? String((error as Error).message) : "User not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-20 md:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-2")}
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>
        <Link href={`/admin/users/${id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Edit
        </Link>
      </div>

      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-base-content">
          <UserCircle className="size-8 shrink-0 text-base-content/80 sm:size-9" aria-hidden />
          <span className="min-w-0 leading-tight">{displayTitle}</span>
        </h1>
        <p className="text-sm text-muted-foreground">@{user.username}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{user.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{user.isActive ? "Active" : "Inactive"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Website owner</dt>
            <dd>{user.isWebsiteOwner ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(user.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(user.updatedAt).toLocaleString()}</dd>
          </div>
          {user.lastLoginAt ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Last login</dt>
              <dd>{new Date(user.lastLoginAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Tree role</CardTitle>
          <p className="text-sm text-muted-foreground">Role for the admin GEDCOM tree.</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <RoleIcon className="size-5 shrink-0 text-base-content/70" />
            <span className="font-medium capitalize">{roleInfo.label}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Linked individuals</CardTitle>
          <p className="text-sm text-muted-foreground">
            People in this tree linked to this account (by GEDCOM xref).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No individuals linked.</p>
          ) : (
            links.map((link) => <LinkedIndividualRow key={link.id} link={link} />)
          )}
        </CardContent>
      </Card>

      {profileRows.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {profileRows.map((row) => (
              <div key={row.key}>
                <p className="text-muted-foreground">{row.key}</p>
                <p className="break-words">{row.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
