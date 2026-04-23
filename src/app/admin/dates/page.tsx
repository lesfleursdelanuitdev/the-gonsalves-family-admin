"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
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
  useAdminDates,
  type AdminDateListItem,
  type AdminDatesListResponse,
} from "@/hooks/useAdminGedcomCatalogs";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import {
  adminCatalogToEventsLinkClass,
  adminEventsHrefForDateYear,
} from "@/lib/admin/admin-events-url-filters";
import { cn } from "@/lib/utils";

interface DateRow {
  id: string;
  original: string;
  /** When set, Original column links to Events filtered by this calendar year. */
  year: number | null;
  dateType: string;
  calendar: string;
  ymd: string;
  endYmd: string;
}

function ymdParts(y: number | null, m: number | null, d: number | null): string {
  if (y == null && m == null && d == null) return "—";
  return [y ?? "?", m ?? "?", d ?? "?"].join("-");
}

function mapApiToRows(api: AdminDatesListResponse): DateRow[] {
  return (api?.dates ?? []).map((d: AdminDateListItem) => ({
    id: d.id,
    original: d.original?.trim() ? d.original : "—",
    year: d.year ?? null,
    dateType: d.dateType,
    calendar: d.calendar ?? "—",
    ymd: ymdParts(d.year, d.month, d.day),
    endYmd: ymdParts(d.endYear, d.endMonth, d.endDay),
  }));
}

function buildDatesConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<DateRow> {
  return {
    id: "dates",
    labels: { singular: "Date", plural: "Dates" },
    getRowId: (row) => row.id,
    defaultSorting: [{ id: "ymd", desc: false }],
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "original",
        header: "Original text",
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original;
          const label = r.original;
          if (r.year == null) {
            return label && label !== "—" ? (
              <span title="No calendar year on this row; Events filter uses year only.">{label}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          }
          return (
            <Link
              href={adminEventsHrefForDateYear(r.year)}
              className={cn(adminCatalogToEventsLinkClass, "line-clamp-2 inline-block max-w-[min(100%,24rem)]")}
              title={`Events in year ${r.year}`}
            >
              {label}
            </Link>
          );
        },
      },
      { accessorKey: "dateType", header: "Type", enableSorting: true },
      { accessorKey: "calendar", header: "Calendar", enableSorting: true },
      { accessorKey: "ymd", header: "Start Y-M-D", enableSorting: true },
      { accessorKey: "endYmd", header: "End Y-M-D", enableSorting: true },
    ],
    renderCard: ({ record, onView }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-medium leading-snug">
              {record.year != null ? (
                <Link
                  href={adminEventsHrefForDateYear(record.year)}
                  className={cn(adminCatalogToEventsLinkClass, "line-clamp-3 block")}
                >
                  {record.original}
                </Link>
              ) : (
                <span className="line-clamp-3" title="No calendar year; link to Events is only available when year is set.">
                  {record.original}
                </span>
              )}
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {record.dateType} · {record.calendar}
          </p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            {record.ymd}
            {record.endYmd !== "—" ? ` → ${record.endYmd}` : ""}
          </p>
        </CardContent>
        <CardActionFooter onView={onView} />
      </Card>
    ),
    actions: {
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/dates/${r.id}`),
      },
    },
  };
}

export default function AdminDatesPage() {
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const applyFilters = useCallback(() => setAppliedQ(draftQ), [draftQ]);
  const clearFilters = useCallback(() => {
    setDraftQ("");
    setAppliedQ("");
  }, []);

  const { data, isLoading } = useAdminDates({
    q: appliedQ.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildDatesConfig(router), [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dates</h1>
        <p className="text-muted-foreground">
          Canonical parsed dates for this tree (read-only). Search matches original text or an exact calendar year. When
          a row has a calendar year, its title links to Events filtered to that year; otherwise open the date detail for
          context.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="space-y-2">
          <Label htmlFor="dates-filter-q">Search dates</Label>
          <Input
            id="dates-filter-q"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Original text or a calendar year (e.g. 1920)"
          />
          <p className="text-xs text-muted-foreground">
            Click Apply to run the search against the catalog API.
          </p>
        </div>
      </FilterPanel>

      {data && (
        <ResultCount total={data.total} hasMore={data.hasMore} shown={data.dates.length} isLoading={isLoading} />
      )}

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-dates-view"
        paginationResetKey={appliedQ}
      />
    </div>
  );
}
