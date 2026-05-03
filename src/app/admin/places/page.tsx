"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Globe, MapPin, Pencil, Trash2 } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import {
  adminCatalogToEventsLinkClass,
  adminEventsHrefForPlaceOriginal,
} from "@/lib/admin/admin-events-url-filters";
import { cn } from "@/lib/utils";
import { initialsFromPersonLabel } from "@/lib/gedcom/display-name";

interface PlaceRow {
  id: string;
  original: string;
  /** Comma-separated segments (trimmed, non-empty). */
  hierarchySegments: string[];
  primaryName: string;
  /** Segments after the first, joined for subtitle. */
  restOfPlace: string;
  locality: string;
  coords: string;
  incomplete: boolean;
}

function segmentsFromOriginal(original: string): string[] {
  return original
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
  return (api?.places ?? []).map((p) => {
    const originalTrim = (p.original ?? "").trim();
    const nameTrim = (p.name ?? "").trim();
    const fromOriginal = segmentsFromOriginal(originalTrim);
    let hierarchySegments: string[];
    let primaryName: string;
    let restOfPlace: string;

    if (fromOriginal.length > 0) {
      hierarchySegments = fromOriginal;
      primaryName = fromOriginal[0]!;
      restOfPlace = fromOriginal.slice(1).join(", ").trim();
    } else if (nameTrim) {
      hierarchySegments = [nameTrim];
      primaryName = nameTrim;
      restOfPlace = "";
    } else if (originalTrim) {
      hierarchySegments = [originalTrim];
      primaryName = originalTrim;
      restOfPlace = "";
    } else {
      hierarchySegments = [];
      primaryName = "—";
      restOfPlace = "";
    }

    const locality = localityOf(p);
    const coords = coordsOf(p);
    const incomplete = primaryName === "—" && locality === "—" && coords === "—";

    return {
      id: p.id,
      original: p.original ?? "",
      hierarchySegments,
      primaryName,
      restOfPlace,
      locality,
      coords,
      incomplete,
    };
  });
}

function PlaceGridCard({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: PlaceRow;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const idBadge = record.id.length > 10 ? `${record.id.slice(0, 8)}…` : record.id;
  const eventsHref = record.original.trim() ? adminEventsHrefForPlaceOriginal(record.original) : null;
  const primaryLabel = record.primaryName.trim() && record.primaryName !== "—" ? record.primaryName : "—";
  const avatarInitials = initialsFromPersonLabel(primaryLabel === "—" ? "Place" : primaryLabel);
  const hasMultipleSegments = record.hierarchySegments.length > 1;
  const subtitle =
    hasMultipleSegments ? record.hierarchySegments.slice(1).join(" · ").trim() : record.restOfPlace.trim();
  const showSubtitle = Boolean(subtitle);
  const nameForAria = primaryLabel !== "—" ? primaryLabel : "place";

  return (
    <Card className="group flex h-full min-h-0 flex-col overflow-hidden border-base-content/12 bg-base-100/95 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20">
      <CardHeader className="space-y-2 pb-2 pt-3 text-center">
        <div className="flex justify-center">
          <span
            className="inline-flex max-w-full items-center rounded-full border border-base-content/15 bg-base-content/[0.03] px-2.5 py-0.5 font-mono text-[10px] leading-tight tracking-wide text-base-content/70"
            title={record.id}
          >
            {idBadge}
          </span>
        </div>
        <div
          className="mx-auto flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-content/12 bg-white/8 text-sm font-bold text-base-content"
          aria-hidden
        >
          {avatarInitials}
        </div>
        <CardTitle className="text-balance px-1 text-base font-semibold leading-tight text-base-content sm:text-lg">
          {primaryLabel === "—" ? <span className="text-muted-foreground">—</span> : primaryLabel}
        </CardTitle>
        {showSubtitle ? (
          <p className="line-clamp-3 px-2 text-sm leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
        {record.incomplete ? (
          <p className="text-center text-xs text-muted-foreground/90">Incomplete place data</p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 pb-3 pt-1 text-sm">
        {hasMultipleSegments ? (
          <div className="space-y-2">
            <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Place hierarchy
            </p>
            <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
              <dl className="space-y-2">
                {record.hierarchySegments.map((seg, i) => (
                  <div key={`${record.id}-seg-${i}`} className="flex min-w-0 gap-2 text-xs leading-snug">
                    <dt className="shrink-0 font-medium text-base-content/75">Segment {i + 1}</dt>
                    <dd className="min-w-0 flex-1 text-end text-base-content/[0.92]">{seg}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium text-base-content/80">Region</span>
            <span className="ml-auto min-w-0 truncate text-muted-foreground">
              {record.locality === "—" ? <span className="text-muted-foreground/70">—</span> : record.locality}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium text-base-content/80">Coordinates</span>
            <span className="ml-auto min-w-0 truncate font-mono text-[11px] text-muted-foreground">{record.coords}</span>
          </p>
        </div>

        {record.original.trim() ? (
          <div className="truncate rounded-md border border-base-content/10 bg-base-content/[0.015] px-2 py-1 text-center">
            {eventsHref ? (
              <Link
                href={eventsHref}
                className={cn(adminCatalogToEventsLinkClass, "text-[11px] font-medium")}
                title="Open events filtered by this place text"
              >
                Find related events
              </Link>
            ) : null}
          </div>
        ) : (
          <div
            className="truncate rounded-md border border-base-content/10 bg-base-content/[0.015] px-2 py-1 text-center font-mono text-[10px] leading-tight text-base-content/45"
            title={record.id}
          >
            {record.id}
          </div>
        )}
      </CardContent>

      <div className="mt-auto grid grid-cols-3 divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
          onClick={onView}
          aria-label={`View ${nameForAria}`}
          title="View"
        >
          <Eye className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
          onClick={onEdit}
          aria-label={`Edit ${nameForAria}`}
          title="Edit"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!onDelete}
          className={
            onDelete
              ? "h-9 w-full rounded-none border-0 text-base-content/55 hover:bg-destructive/10 hover:text-destructive focus-visible:z-10 focus-visible:text-destructive"
              : "h-9 w-full cursor-not-allowed rounded-none border-0 text-base-content/35 opacity-60"
          }
          onClick={onDelete}
          aria-label={onDelete ? `Delete ${nameForAria}` : "Delete unavailable for catalog places"}
          title={
            onDelete
              ? "Delete"
              : "Places can’t be removed from this catalog. Update person or event records that reference this place."
          }
        >
          <Trash2 className={cn("size-4", onDelete ? "" : "text-destructive/50")} />
        </Button>
      </div>
    </Card>
  );
}

function buildPlacesConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<PlaceRow> {
  return {
    id: "places",
    labels: { singular: "Place", plural: "Places" },
    getRowId: (row) => row.id,
    defaultSorting: [{ id: "primaryName", desc: false }],
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "original",
        header: "Full place",
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
        accessorKey: "primaryName",
        header: "Name",
        enableSorting: true,
      },
      { accessorKey: "locality", header: "Region", enableSorting: true },
      { accessorKey: "coords", header: "Coordinates", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => (
      <PlaceGridCard record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    ),
    actions: {
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/places/${r.id}`),
      },
      edit: {
        label: "Edit",
        handler: (r) => router.push(`/admin/places/${r.id}`),
      },
    },
  };
}

export default function AdminPlacesPage() {
  const router = useRouter();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminPlaces(queryOpts);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildPlacesConfig(router), [router]);

  return (
    <AdminListPageShell
      title="Places"
      description={
        <p className="text-muted-foreground">
          Canonical place rows for this tree (read-only here). Each card highlights the primary location, optional
          hierarchy from comma-separated text, and region fields when parsed. To change how a place appears in the tree,
          edit the individuals, families, or events that reference it.
        </p>
      }
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters}>
          <div className="space-y-2">
            <Label htmlFor="places-filter-q">Search places</Label>
            <Input
              id="places-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Search in full place text"
            />
            <p className="text-xs text-muted-foreground">
              Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-places-view"
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
