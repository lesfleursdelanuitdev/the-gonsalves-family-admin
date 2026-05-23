"use client";

import { useState } from "react";
import Link from "next/link";
import { HeartPulse, RefreshCw, ChevronDown, ChevronUp, Trash2, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useLatestHealthRun,
  useRunHealthCheck,
  useCheckRecords,
  useBatchAction,
} from "@/hooks/useAdminSiteHealth";
import type { CheckResult, HealthRecord } from "@/lib/health/types";

const CATEGORY_LABELS: Record<string, string> = {
  media: "Media",
  data_integrity: "Data Integrity",
  community: "Community",
  user_hygiene: "User Hygiene",
};

const CATEGORY_ORDER = ["data_integrity", "media", "community", "user_hygiene"];

// ── Records panel ─────────────────────────────────────────────────────────────

function RecordRow({ record }: { record: HealthRecord }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-base-content/[0.06] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{record.label}</p>
        {record.sublabel ? (
          <p className="truncate text-xs text-muted-foreground">{record.sublabel}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {record.meta ? (
          <span className="text-xs text-muted-foreground">{record.meta}</span>
        ) : null}
        {record.href ? (
          <Link href={record.href} className="text-muted-foreground hover:text-primary">
            <ExternalLink className="size-3.5" aria-label="Open" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RecordsPanel({
  checkKey,
  batchAction,
  onBatchDone,
}: {
  checkKey: string;
  batchAction: "delete" | "archive" | null;
  onBatchDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading } = useCheckRecords(checkKey, true);
  const batch = useBatchAction(checkKey);

  const records: HealthRecord[] = data?.records ?? [];
  const total = data?.total ?? 0;

  function toggleAll() {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  }

  async function handleBatch(ids?: string[]) {
    try {
      const result = await batch.mutateAsync(ids);
      toast.success(`${result.affected} record${result.affected !== 1 ? "s" : ""} ${batchAction === "delete" ? "deleted" : "archived"}.`);
      setSelected(new Set());
      onBatchDone();
    } catch {
      toast.error("Action failed.");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!records.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No records found.</p>;
  }

  const actionLabel = batchAction === "delete" ? "Delete" : "Archive";
  const ActionIcon = batchAction === "delete" ? Trash2 : Archive;

  return (
    <div className="mt-1 space-y-3">
      {batchAction ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={batchAction === "delete" ? "destructive" : "outline"}
            disabled={batch.isPending}
            onClick={() => handleBatch()}
            className="gap-1.5"
          >
            <ActionIcon className="size-3.5" />
            {actionLabel} all {total}
          </Button>
          {selected.size > 0 ? (
            <Button
              size="sm"
              variant={batchAction === "delete" ? "destructive" : "outline"}
              disabled={batch.isPending}
              onClick={() => handleBatch(Array.from(selected))}
              className="gap-1.5"
            >
              <ActionIcon className="size-3.5" />
              {actionLabel} selected ({selected.size})
            </Button>
          ) : null}
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {selected.size === records.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      ) : null}

      <div className="rounded-md border border-base-content/[0.08] bg-background px-4">
        {records.map((r) => (
          <div key={r.id} className={cn("flex items-start gap-3", batchAction && "cursor-pointer")}
            onClick={batchAction ? () => setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(r.id)) next.delete(r.id);
              else next.add(r.id);
              return next;
            }) : undefined}
          >
            {batchAction ? (
              <input
                type="checkbox"
                readOnly
                checked={selected.has(r.id)}
                className="mt-3.5 shrink-0 accent-primary"
                aria-label={`Select ${r.label}`}
              />
            ) : null}
            <div className="flex-1 min-w-0">
              <RecordRow record={r} />
            </div>
          </div>
        ))}
        {total > records.length ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Showing {records.length} of {total}. Run a batch action to clear all at once.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Check row ─────────────────────────────────────────────────────────────────

function CheckRow({ result, onBatchDone }: { result: CheckResult; onBatchDone: () => void }) {
  const [open, setOpen] = useState(false);

  const hasIssues = result.count > 0;
  const isUnknown = result.count === -1;

  return (
    <div className="border-b border-base-content/[0.06] last:border-0">
      <button
        type="button"
        disabled={!hasIssues}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-0 py-3 text-left",
          hasIssues && "cursor-pointer hover:bg-base-content/[0.02]",
          !hasIssues && "cursor-default",
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{result.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{result.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isUnknown ? (
            <span className="rounded-full border border-base-content/20 px-2 py-0.5 text-xs text-muted-foreground">error</span>
          ) : hasIssues ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold tabular-nums text-destructive-foreground">{result.count}</span>
          ) : (
            <span className="rounded-full border border-green-500/30 px-2 py-0.5 text-xs text-green-600">OK</span>
          )}
          {hasIssues ? (
            open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />
          ) : null}
        </div>
      </button>
      {open && hasIssues ? (
        <div className="pb-4">
          <RecordsPanel checkKey={result.checkKey} batchAction={result.batchAction} onBatchDone={onBatchDone} />
        </div>
      ) : null}
    </div>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  results,
  onBatchDone,
}: {
  category: string;
  results: CheckResult[];
  onBatchDone: () => void;
}) {
  const issueCount = results.reduce((s, r) => s + Math.max(0, r.count), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{CATEGORY_LABELS[category] ?? category}</span>
          {issueCount > 0 ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold tabular-nums text-destructive-foreground">
              {issueCount} issue{issueCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="rounded-full border border-green-500/30 px-2 py-0.5 text-xs text-green-600">All clear</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-2">
        {results.map((r) => (
          <CheckRow key={r.checkKey} result={r} onBatchDone={onBatchDone} />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSiteHealthPage() {
  const { data: latest, isLoading } = useLatestHealthRun();
  const run = useRunHealthCheck();

  async function handleRun() {
    try {
      await run.mutateAsync();
      toast.success("Health check complete.");
    } catch {
      toast.error("Health check failed.");
    }
  }

  const results: CheckResult[] = latest?.results ?? [];
  const grouped = CATEGORY_ORDER.reduce<Record<string, CheckResult[]>>((acc, cat) => {
    acc[cat] = results.filter((r) => r.category === cat);
    return acc;
  }, {});

  const totalIssues = latest?.totalIssues ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <HeartPulse className="size-6 text-primary" aria-hidden />
            Site health
          </h1>
          {latest ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Last run{" "}
              {new Date(latest.startedAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}{" "}
              by {latest.triggeredBy}
              {totalIssues === 0
                ? " — no issues found"
                : ` — ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found`}
            </p>
          ) : !isLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">No health check has been run yet.</p>
          ) : null}
        </div>
        <Button onClick={handleRun} disabled={run.isPending} className="gap-2">
          <RefreshCw className={cn("size-4", run.isPending && "animate-spin")} />
          {run.isPending ? "Running…" : "Run now"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : !latest ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Run a health check to see the status of your database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              results={grouped[cat]}
              onBatchDone={() => run.reset()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
