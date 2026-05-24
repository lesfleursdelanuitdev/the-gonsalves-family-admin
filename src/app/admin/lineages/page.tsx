"use client";

import { useMemo } from "react";
import { TreePine, Users, CalendarRange, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { useAdminLineages, type AdminLineage } from "@/hooks/useAdminLineages";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRange(lineage: AdminLineage): string {
  if (lineage.earliestYear && lineage.latestYear) return `${lineage.earliestYear} – ${lineage.latestYear}`;
  if (lineage.earliestYear) return `from ${lineage.earliestYear}`;
  if (lineage.latestYear) return `to ${lineage.latestYear}`;
  return "—";
}

// ── Card renderer ─────────────────────────────────────────────────────────────

function LineageCard({ lineage }: { lineage: AdminLineage }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <TreePine className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{lineage.name}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" />
            <span>{lineage.size.toLocaleString()} members</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarRange className="size-3.5 shrink-0" />
            <span>{dateRange(lineage)}</span>
          </div>
        </div>

        {lineage.topSurnames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lineage.topSurnames.map((s) => (
              <span
                key={s}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/admin/individuals?lineageId=${lineage.id}`}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          View members
        </Link>
      </CardContent>
    </Card>
  );
}

// ── DataViewer config ─────────────────────────────────────────────────────────

function buildLineagesConfig(): DataViewerConfig<AdminLineage> {
  return {
    id: "lineages",
    labels: { singular: "Lineage", plural: "Lineages" },
    getRowId: (l) => l.id,
    columns: [
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <TreePine className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{row.getValue("name") as string}</span>
          </div>
        ),
      },
      {
        accessorKey: "size",
        header: "Members",
        enableSorting: true,
        cell: ({ row }) => (row.getValue("size") as number).toLocaleString(),
      },
      {
        id: "dateRange",
        header: "Date range",
        enableSorting: false,
        cell: ({ row }) => dateRange(row.original),
      },
      {
        id: "topSurnames",
        header: "Top surnames",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.topSurnames.map((s) => (
              <span
                key={s}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        ),
      },
    ],
    renderCard: ({ record }) => <LineageCard lineage={record} />,
    actions: {
      view: {
        label: "View members",
        handler: (l) => {
          window.location.href = `/admin/individuals?lineageId=${l.id}`;
        },
      },
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLineagesPage() {
  const { data, isLoading } = useAdminLineages();
  const config = useMemo(() => buildLineagesConfig(), []);
  const rows = useMemo(() => data?.lineages ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lineages</h1>
          <p className="mt-1 text-muted-foreground">
            Directed family lineages traced from founding ancestors by surname.
          </p>
        </div>
        <Link
          href="/admin/cron"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Run detection
        </Link>
      </div>

      {data?.stats.lastComputedAt && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" />
          Last computed{" "}
          {new Date(data.stats.lastComputedAt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </div>
      )}

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="cards"
        viewModeKey="admin-lineages-view"
        totalCount={data?.stats.totalLineages}
        statisticsAnalyticsSegment="lineages"
      />
    </div>
  );
}
