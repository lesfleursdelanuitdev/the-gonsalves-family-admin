"use client";

import { useParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminDate, type AdminDateDetail } from "@/hooks/useAdminGedcomCatalogs";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";

function ymdParts(y: number | null, m: number | null, d: number | null): string {
  if (y == null && m == null && d == null) return "—";
  return [y ?? "?", m ?? "?", d ?? "?"].join("-");
}

export default function AdminDateDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminDate(id);
  const date = data?.date as AdminDateDetail | undefined;
  const c = date?._count;

  return (
    <DetailPageShell
      backHref="/admin/dates"
      backLabel="Dates"
      isLoading={isLoading}
      error={error}
      data={date}
      notFoundMessage="Could not load this date."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <h1 className="flex items-start gap-3 text-2xl font-bold tracking-tight">
          <CalendarRange className="mt-1 size-7 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 leading-tight">{date?.original?.trim() ? date.original : "—"}</span>
        </h1>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Date type</dt>
            <dd>{date?.dateType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Calendar</dt>
            <dd>{date?.calendar ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Start (Y-M-D)</dt>
            <dd>{ymdParts(date?.year ?? null, date?.month ?? null, date?.day ?? null)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">End (Y-M-D)</dt>
            <dd>{ymdParts(date?.endYear ?? null, date?.endMonth ?? null, date?.endDay ?? null)}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Usage (reference counts)</CardTitle>
          <p className="text-sm text-muted-foreground">
            How many records point at this canonical date row.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>Events: {c?.events ?? 0}</li>
            <li>Individual birth dates: {c?.individualBirthDates ?? 0}</li>
            <li>Individual death dates: {c?.individualDeathDates ?? 0}</li>
            <li>Family marriage dates: {c?.familyMarriageDates ?? 0}</li>
            <li>Family divorce dates: {c?.familyDivorceDates ?? 0}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse all archive media linked to events and facts that use this date, in album layout.
            </p>
          </div>
          <ViewAsAlbumLink entityType="date" entityId={id} label="View media from this date" includeCount />
        </CardHeader>
      </Card>
    </DetailPageShell>
  );
}
