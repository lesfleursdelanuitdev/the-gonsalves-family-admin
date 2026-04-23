"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { ResultCount } from "@/components/data-viewer/ResultCount";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAdminPlaces,
  type AdminPlaceListItem,
  type AdminPlacesListResponse,
} from "@/hooks/useAdminGedcomCatalogs";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import {
  adminCatalogToEventsLinkClass,
  adminEventsHrefForPlaceOriginal,
} from "@/lib/admin/admin-events-url-filters";
import { cn } from "@/lib/utils";

interface PlaceRow {
  id: string;
  original: string;
  /** Leftmost comma-separated segment from PLAC (often city); not the full place. */
  firstSegment: string;
  locality: string;
  coords: string;
}

function localityOf(p: AdminPlaceListItem): string {
  const parts = [p.county, p.state, p.country].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "—";
}

function coordsOf(p: AdminPlaceListItem): string {
  const lat = p.latitude != null ? String(p.latitude) : "";
  const lng = p.longitude != null ? String(p.longitude) : "";
  if (!lat && !lng) return "—";
  return `${lat || "?"}, ${lng || "?"}`;
}

function mapApiToRows(api: AdminPlacesListResponse): PlaceRow[] {
  return (api?.places ?? []).map((p) => ({
    id: p.id,
    original: p.original,
    firstSegment: p.name ?? "—",
    locality: localityOf(p),
    coords: coordsOf(p),
  }));
}

function buildPlacesConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<PlaceRow> {
  return {
    id: "places",
    labels: { singular: "Place", plural: "Places" },
    getRowId: (row) => row.id,
    defaultSorting: [{ id: "original", desc: false }],
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "original",
        header: "Original PLAC",
        enableSorting: true,
        cell: ({ row }) => {
          const v = (row.getValue("original") as string).trim();
          if (!v) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              href={adminEventsHrefForPlaceOriginal(v)}
              className={cn(adminCatalogToEventsLinkClass, "line-clamp-2 inline-block max-w-[min(100%,24rem)]")}
              title={v}
            >
              {v}
            </Link>
          );
        },
      },
      {
        accessorKey: "firstSegment",
        header: "First segment",
        enableSorting: true,
      },
      { accessorKey: "locality", header: "County, state, country", enableSorting: true },
      { accessorKey: "coords", header: "Lat, long", enableSorting: true },
    ],
    renderCard: ({ record, onView }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-medium leading-snug">
              {record.original.trim() ? (
                <Link
                  href={adminEventsHrefForPlaceOriginal(record.original)}
                  className={cn(adminCatalogToEventsLinkClass, "line-clamp-2 block")}
                >
                  {record.original}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-base-content/80">First segment:</span>{" "}
            {record.firstSegment}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-base-content/80">Rest:</span> {record.locality}
          </p>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          <p>{record.coords}</p>
        </CardContent>
        <CardActionFooter onView={onView} />
      </Card>
    ),
    actions: {
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/places/${r.id}`),
      },
    },
  };
}

export default function AdminPlacesPage() {
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const applyFilters = useCallback(() => setAppliedQ(draftQ), [draftQ]);
  const clearFilters = useCallback(() => {
    setDraftQ("");
    setAppliedQ("");
  }, []);

  const { data, isLoading } = useAdminPlaces({
    q: appliedQ.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildPlacesConfig(router), [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Places</h1>
        <p className="text-muted-foreground">
          Deduplicated place records for this tree (read-only).{" "}
          <span className="font-medium text-base-content/90">First segment</span> is the leftmost part of a
          comma-separated GEDCOM place (usually city); county, state, and country are stored in separate columns when
          parsed. Edit data by changing individuals, families, or events that reference this row.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="space-y-2">
          <Label htmlFor="places-filter-q">Search places</Label>
          <Input
            id="places-filter-q"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Substring in original PLAC text"
          />
          <p className="text-xs text-muted-foreground">
            Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
          </p>
        </div>
      </FilterPanel>

      {data && (
        <ResultCount total={data.total} hasMore={data.hasMore} shown={data.places.length} isLoading={isLoading} />
      )}

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-places-view"
        paginationResetKey={appliedQ}
      />
    </div>
  );
}
