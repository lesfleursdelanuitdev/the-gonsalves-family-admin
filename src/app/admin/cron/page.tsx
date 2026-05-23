"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Play, RefreshCw, Clock, CheckCircle2, XCircle, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminCron, useTriggerCronJob } from "@/hooks/useAdminCron";
import { ApiError } from "@/lib/infra/api";
import type { CronJobStatus, CronLastRun, SiteHealthSummary, BackupSummary } from "@/hooks/useAdminCron";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatBytes(bytes: string | null): string {
  if (!bytes) return "—";
  const n = parseInt(bytes, 10);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ ok, completed }: { ok: boolean; completed: boolean }) {
  if (!completed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
        <RefreshCw className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        Success
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      <XCircle className="size-3" />
      Failed
    </span>
  );
}

function SiteHealthSummaryPanel({ summary }: { summary: SiteHealthSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {summary.totalIssues === 0 ? (
          <span className="text-green-600 dark:text-green-400">No issues found</span>
        ) : (
          <span className="text-destructive">{summary.totalIssues} issue{summary.totalIssues !== 1 ? "s" : ""} found</span>
        )}
      </p>
      {summary.breakdown.length > 0 && (
        <ul className="space-y-1">
          {summary.breakdown.map((b: { category: string; label: string; count: number }) => (
            <li key={b.category} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="font-medium tabular-nums">{b.count}</span>
            </li>
          ))}
        </ul>
      )}
      {summary.checks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {summary.checks.length} check{summary.checks.length !== 1 ? "s" : ""} with issues
          </summary>
          <ul className="mt-2 space-y-1 border-l border-border pl-3">
            {summary.checks.map((c: { checkKey: string; label: string; count: number; category: string }) => (
              <li key={c.checkKey} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-medium tabular-nums text-destructive">{c.count}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BackupSummaryPanel({ summary }: { summary: BackupSummary }) {
  return (
    <div className="space-y-1 text-sm">
      {summary.errorMessage ? (
        <p className="text-xs text-destructive line-clamp-3">{summary.errorMessage}</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">File size</span>
            <span className="font-medium tabular-nums">{formatBytes(summary.fileSize)}</span>
          </div>
          {summary.mediaFileCount != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Media files</span>
              <span className="font-medium tabular-nums">{summary.mediaFileCount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Schema</span>
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[14rem]">
              {summary.schemaVersion || "—"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function LastRunPanel({ lastRun }: { lastRun: CronLastRun }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Started {formatDate(lastRun.startedAt)}</span>
        {lastRun.durationMs != null && <span>Took {formatDuration(lastRun.durationMs)}</span>}
        <span className="capitalize">Triggered by {lastRun.triggeredBy}</span>
      </div>
      <div className="rounded-md border border-border bg-muted/30 p-3">
        {lastRun.summary.type === "site-health" ? (
          <SiteHealthSummaryPanel summary={lastRun.summary} />
        ) : (
          <BackupSummaryPanel summary={lastRun.summary} />
        )}
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

function CronJobCard({
  job,
  isRunning,
  onTrigger,
}: {
  job: CronJobStatus;
  isRunning: boolean;
  onTrigger: (id: string) => void;
}) {
  const { lastRun } = job;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">{job.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{job.description}</p>
          </div>
          {lastRun && (
            <StatusBadge ok={lastRun.ok} completed={lastRun.completedAt != null} />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3 shrink-0" />
          <span>{job.humanSchedule}</span>
          <span className="font-mono opacity-60">({job.schedule})</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {lastRun ? (
          <LastRunPanel lastRun={lastRun} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Minus className="size-4" />
            Never run
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={isRunning}
          onClick={() => onTrigger(job.id)}
          className="gap-1.5"
        >
          {isRunning ? (
            <><RefreshCw className="size-3.5 animate-spin" />Running…</>
          ) : (
            <><Play className="size-3.5" />Run now</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCronPage() {
  const { data, isLoading, isError, error, refetch } = useAdminCron();
  const trigger = useTriggerCronJob();
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  const onTrigger = useCallback(
    async (jobId: string) => {
      setRunningJobs((s) => new Set(s).add(jobId));
      try {
        await trigger.mutateAsync(jobId);
        toast.success("Job completed successfully.");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Job failed.");
      } finally {
        setRunningJobs((s) => {
          const next = new Set(s);
          next.delete(jobId);
          return next;
        });
      }
    },
    [trigger],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scheduled jobs</h1>
        <p className="mt-1 text-muted-foreground">
          All registered cron jobs, their schedules, last run results, and manual triggers.
        </p>
      </div>

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load cron job statuses."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.jobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              isRunning={runningJobs.has(job.id)}
              onTrigger={onTrigger}
            />
          ))}
        </div>
      )}
    </div>
  );
}
