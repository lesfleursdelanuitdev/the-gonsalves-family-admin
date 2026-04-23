"use client";

import { useParams } from "next/navigation";
import { CaseUpper } from "lucide-react";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminSurname, type AdminSurnameDetail } from "@/hooks/useAdminGedcomCatalogs";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export default function AdminSurnameDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminSurname(id);
  const surname = data?.surname as AdminSurnameDetail | undefined;
  const display = surname ? stripSlashesFromName(surname.surname) || surname.surname : "";

  return (
    <DetailPageShell
      backHref="/admin/surnames"
      backLabel="Surnames"
      isLoading={isLoading}
      error={error}
      data={surname}
      notFoundMessage="Could not load this surname."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <CaseUpper className="size-7 shrink-0 text-muted-foreground" aria-hidden />
          <span>{display}</span>
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Stored value</dt>
            <dd className="break-words font-mono text-xs">{surname?.surname ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Normalized (lower)</dt>
            <dd className="font-mono text-xs">{surname?.surnameLower ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Frequency</dt>
            <dd>{surname?.frequency?.toLocaleString() ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Soundex</dt>
            <dd>{surname?.soundex ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Metaphone</dt>
            <dd>{surname?.metaphone ?? "—"}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Usage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Links from name forms and family surname rows.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>Name form links: {surname?._count?.nameFormSurnames?.toLocaleString() ?? 0}</li>
            <li>Family surname links: {surname?._count?.familySurnames?.toLocaleString() ?? 0}</li>
          </ul>
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
