"use client";

import { useParams } from "next/navigation";
import { CaseSensitive } from "lucide-react";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminGivenName, type AdminGivenNameDetail } from "@/hooks/useAdminGedcomCatalogs";

export default function AdminGivenNameDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminGivenName(id);
  const givenName = data?.givenName as AdminGivenNameDetail | undefined;

  return (
    <DetailPageShell
      backHref="/admin/given-names"
      backLabel="Given names"
      isLoading={isLoading}
      error={error}
      data={givenName}
      notFoundMessage="Could not load this given name."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <CaseSensitive className="size-7 shrink-0 text-muted-foreground" aria-hidden />
          <span>{givenName?.givenName ?? ""}</span>
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Normalized (lower)</dt>
            <dd className="font-mono text-xs">{givenName?.givenNameLower ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Frequency</dt>
            <dd>{givenName?.frequency?.toLocaleString() ?? "—"}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Usage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Number of name-form links referencing this catalog row.
          </p>
        </CardHeader>
        <CardContent className="text-sm">
          Name form links: {givenName?._count?.nameFormGivenNames?.toLocaleString() ?? 0}
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
