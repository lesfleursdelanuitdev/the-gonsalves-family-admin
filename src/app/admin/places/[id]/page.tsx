"use client";

import { useParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminPlace, type AdminPlaceDetail } from "@/hooks/useAdminGedcomCatalogs";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";

function fmtCoord(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export default function AdminPlaceDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminPlace(id);
  const place = data?.place as AdminPlaceDetail | undefined;

  const c = place?._count;

  return (
    <DetailPageShell
      backHref="/admin/places"
      backLabel="Places"
      isLoading={isLoading}
      error={error}
      data={place}
      notFoundMessage="Could not load this place."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <h1 className="flex items-start gap-3 text-2xl font-bold tracking-tight">
          <MapPin className="mt-1 size-7 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 leading-tight">{place?.original ?? ""}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Comma-separated place text is shown most specific first. Broader parts may also appear as region fields when
          the parser can infer them.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Primary name</dt>
            <dd>{place?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">County</dt>
            <dd>{place?.county ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">State / province</dt>
            <dd>{place?.state ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Country</dt>
            <dd>{place?.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Latitude</dt>
            <dd>{fmtCoord(place?.latitude)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Longitude</dt>
            <dd>{fmtCoord(place?.longitude)}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Usage (reference counts)</CardTitle>
          <p className="text-sm text-muted-foreground">
            How many records point at this canonical place row.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>Events: {c?.events ?? 0}</li>
            <li>Individual birth places: {c?.individualBirthPlaces ?? 0}</li>
            <li>Individual death places: {c?.individualDeathPlaces ?? 0}</li>
            <li>Family marriage places: {c?.familyMarriagePlaces ?? 0}</li>
            <li>Family divorce places: {c?.familyDivorcePlaces ?? 0}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse all archive media linked to events and facts that use this place, in album layout.
            </p>
          </div>
          <ViewAsAlbumLink entityType="place" entityId={id} label="View media from this place" includeCount />
        </CardHeader>
      </Card>
    </DetailPageShell>
  );
}
