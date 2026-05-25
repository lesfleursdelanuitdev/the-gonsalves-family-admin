"use client";

import { useMemo } from "react";
import { GitBranch, Users, CalendarRange, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { useAdminBranches, type AdminBranch } from "@/hooks/useAdminBranches";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRange(branch: AdminBranch): string {
  if (branch.earliestYear && branch.latestYear) return `${branch.earliestYear} – ${branch.latestYear}`;
  if (branch.earliestYear) return `from ${branch.earliestYear}`;
  if (branch.latestYear) return `to ${branch.latestYear}`;
  return "—";
}

// ── Card renderer ─────────────────────────────────────────────────────────────

function BranchCard({ branch }: { branch: AdminBranch }) {
  return (
    <Card className={branch.isMain ? "border-primary/30" : undefined}>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{branch.name}</span>
          </div>
          {branch.isMain && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Main
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" />
            <span>{branch.size.toLocaleString()} individuals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarRange className="size-3.5 shrink-0" />
            <span>{dateRange(branch)}</span>
          </div>
        </div>

        {branch.topSurnames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {branch.topSurnames.map((s) => (
              <span
                key={s}
                className="rounded-full border border-base-content/15 bg-base-200/60 px-2 py-0.5 text-xs font-medium text-base-content capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/admin/individuals?branchId=${branch.id}`}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          View members
        </Link>
      </CardContent>
    </Card>
  );
}

// ── DataViewer config ─────────────────────────────────────────────────────────

function buildBranchesConfig(): DataViewerConfig<AdminBranch> {
  return {
    id: "branches",
    labels: { singular: "Branch", plural: "Branches" },
    getRowId: (b) => b.id,
    columns: [
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{row.getValue("name") as string}</span>
            {row.original.isMain && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Main
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "size",
        header: "Size",
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
                className="rounded-full border border-base-content/15 bg-base-200/60 px-1.5 py-0.5 text-[11px] font-medium capitalize text-base-content"
              >
                {s}
              </span>
            ))}
          </div>
        ),
      },
    ],
    renderCard: ({ record }) => <BranchCard branch={record} />,
    actions: {
      view: {
        label: "View members",
        handler: (b) => {
          window.location.href = `/admin/individuals?branchId=${b.id}`;
        },
      },
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBranchesPage() {
  const { data, isLoading } = useAdminBranches();
  const config = useMemo(() => buildBranchesConfig(), []);
  const rows = useMemo(() => data?.branches ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="mt-1 text-muted-foreground">
            Connected family branches discovered from the pedigree graph.
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
        viewModeKey="admin-branches-view"
        totalCount={data?.stats.totalBranches}
        statisticsAnalyticsSegment="branches"
      />
    </div>
  );
}
