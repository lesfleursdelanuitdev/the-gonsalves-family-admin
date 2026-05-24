"use client";

import { GitBranch, Users, CalendarRange, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminBranches, type AdminBranch } from "@/hooks/useAdminBranches";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dateRange(branch: AdminBranch): string {
  if (branch.earliestYear && branch.latestYear) {
    return `${branch.earliestYear} – ${branch.latestYear}`;
  }
  if (branch.earliestYear) return `from ${branch.earliestYear}`;
  if (branch.latestYear) return `to ${branch.latestYear}`;
  return "—";
}

// ── Branch card ───────────────────────────────────────────────────────────────

function BranchCard({ branch }: { branch: AdminBranch }) {
  return (
    <Card className={branch.isMain ? "border-primary/30" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{branch.name}</span>
            </CardTitle>
          </div>
          {branch.isMain && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Main
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5 shrink-0" />
            <span>{branch.size.toLocaleString()} individuals</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarRange className="size-3.5 shrink-0" />
            <span>{dateRange(branch)}</span>
          </div>
        </div>

        {branch.topSurnames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {branch.topSurnames.map((s) => (
              <span
                key={s}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Link
            href={`/admin/individuals?branchId=${branch.id}`}
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            View members
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBranchesPage() {
  const { data, isLoading, isError, error, refetch } = useAdminBranches();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="mt-1 text-muted-foreground">
            Connected family branches discovered from the pedigree graph.
          </p>
        </div>
        {data && (
          <Link
            href="/admin/cron"
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Run detection
          </Link>
        )}
      </div>

      {/* Stats bar */}
      {data && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">{data.stats.totalBranches}</span>
            {" "}<span className="text-muted-foreground">branches</span>
          </span>
          <span>
            <span className="font-semibold">{data.stats.totalIndividualsInBranches.toLocaleString()}</span>
            {" "}<span className="text-muted-foreground">individuals in branches</span>
          </span>
          {data.stats.lastComputedAt && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              Last computed {formatDate(data.stats.lastComputedAt)}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load branches."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Last run error notice */}
      {data?.stats.lastError && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-start gap-2 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Last detection run ended with an error: {data.stats.lastError}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Not yet computed */}
      {data && data.branches.length === 0 && !data.stats.lastComputedAt && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No branches detected yet.{" "}
            <Link href="/admin/cron" className="underline underline-offset-2">
              Run the branch detection job
            </Link>{" "}
            to discover branches.
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-36 rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Branch grid */}
      {data && data.branches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}
    </div>
  );
}
