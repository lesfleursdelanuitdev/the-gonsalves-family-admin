"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApplyStream } from "@/hooks/useApplyStream";
import { SCANS_QUERY_KEY } from "@/hooks/useInternalDuplicateScans";
import {
  useInternalScans,
  useInternalScan,
  useRunInternalScan,
  usePatchScanResolutions,
  useDiscardScan,
  type ScanListItem,
  type ScanDetail,
  type InternalDuplicatePair,
  type InternalDuplicateResolution,
} from "@/hooks/useInternalDuplicateScans";
import type { ScanApplyStreamEvent } from "@/app/api/admin/merge-records/scans/[id]/apply-stream/route";

const REASON_LABELS: Record<string, string> = {
  exact_name: "Exact name",
  name_and_birth_year: "Name + birth year",
  similar_name_birth_year: "Similar name",
};

const RESOLUTION_OPTIONS: { value: InternalDuplicateResolution; label: string }[] = [
  { value: "review_later", label: "Review later" },
  { value: "merge_b_into_a", label: "Keep A, remove B" },
  { value: "merge_a_into_b", label: "Keep B, remove A" },
  { value: "not_duplicate", label: "Not a duplicate" },
];

function confidenceColor(n: number) {
  if (n >= 90) return "text-success";
  if (n >= 70) return "text-warning";
  return "text-muted-foreground";
}

function statusBadgeClass(status: string) {
  if (status === "applied") return "badge-success";
  if (status === "discarded") return "badge-error";
  return "badge-warning";
}

export function InternalDuplicatesPanel() {
  const { data, isLoading } = useInternalScans();
  const runMutation = useRunInternalScan();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scans = data?.scans ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Scan the tree for duplicate individuals that may have been entered more than once.
        </p>
        <Button
          type="button"
          className="gap-2"
          disabled={runMutation.isPending}
          onClick={() => {
            runMutation.mutate(undefined, {
              onSuccess: (result) => setSelectedId(result.id),
            });
          }}
        >
          {runMutation.isPending ? "Scanning…" : "Run New Scan"}
        </Button>
      </div>

      {runMutation.isError ? (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
          {runMutation.error.message}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading scans…</p>
      ) : scans.length === 0 ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No scans yet. Click <strong>Run New Scan</strong> to search for duplicates.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <ScanList scans={scans} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="flex flex-col gap-4">
            {selectedId ? (
              <ScanReviewPane scanId={selectedId} />
            ) : (
              <Card className="border-base-content/10 bg-card/80">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Select a scan on the left to review pairs.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScanList({
  scans,
  selectedId,
  onSelect,
}: {
  scans: ScanListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="border-base-content/10 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent scans</CardTitle>
        <CardDescription>Select one to review pairs.</CardDescription>
      </CardHeader>
      <CardContent className="max-h-80 space-y-1 overflow-y-auto text-sm">
        {scans.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              "flex w-full flex-col rounded-md border px-2 py-2 text-left transition-colors",
              selectedId === s.id
                ? "border-primary bg-primary/10"
                : "border-transparent hover:bg-base-200/80",
            )}
            onClick={() => onSelect(s.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.summary.total} pairs</span>
              <span className={cn("badge badge-sm", statusBadgeClass(s.status))}>{s.status}</span>
            </div>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {new Date(s.startedAt).toLocaleString()}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function ScanReviewPane({ scanId }: { scanId: string }) {
  const qc = useQueryClient();
  const { data: scan, isLoading, error } = useInternalScan(scanId);
  const patchMutation = usePatchScanResolutions(scanId);
  const discardMutation = useDiscardScan(scanId);
  const applyStream = useApplyStream<ScanApplyStreamEvent & { type: "done" }>(
    `/api/admin/merge-records/scans/${scanId}/apply-stream`,
  );

  if (isLoading) {
    return (
      <Card className="border-base-content/10 bg-card/80">
        <CardContent className="pt-6 text-sm text-muted-foreground">Loading pairs…</CardContent>
      </Card>
    );
  }

  if (error || !scan) {
    return (
      <Card className="border-base-content/10 bg-card/80">
        <CardContent className="pt-6 text-sm text-error">
          {error?.message ?? "Failed to load scan."}
        </CardContent>
      </Card>
    );
  }

  const unresolvedCount = scan.pairs.filter(
    (p) => (scan.resolutions[p.pairId] ?? "review_later") === "review_later",
  ).length;

  const mergeCount = scan.pairs.filter((p) => {
    const r = scan.resolutions[p.pairId] ?? "review_later";
    return r !== "not_duplicate" && r !== "review_later";
  }).length;

  const isClosed = scan.status === "applied" || scan.status === "discarded";
  const isStreaming = applyStream.state.phase === "running";
  const isBusy = patchMutation.isPending || discardMutation.isPending || isStreaming;

  const pct =
    applyStream.state.phase === "running" && applyStream.state.total > 0
      ? Math.round((applyStream.state.processed / applyStream.state.total) * 100)
      : 0;

  return (
    <>
      <Card className="border-base-content/10 bg-card/80">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {scan.summary.total} pair{scan.summary.total !== 1 ? "s" : ""} found
            </CardTitle>
            <span className={cn("badge badge-sm", statusBadgeClass(scan.status))}>{scan.status}</span>
          </div>
          <CardDescription>
            {scan.summary.exactName > 0 && `${scan.summary.exactName} exact name · `}
            {scan.summary.nameAndBirthYear > 0 && `${scan.summary.nameAndBirthYear} name + birth year · `}
            {scan.summary.similarNameBirthYear > 0 && `${scan.summary.similarNameBirthYear} fuzzy match`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!isClosed && applyStream.state.phase === "idle" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {unresolvedCount > 0
                  ? `${unresolvedCount} of ${scan.pairs.length} still needs a decision`
                  : "All pairs resolved — ready to apply"}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => {
                    if (!window.confirm("Discard this scan? Resolutions will be lost.")) return;
                    discardMutation.mutate();
                  }}
                >
                  {discardMutation.isPending ? "Discarding…" : "Discard"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy || unresolvedCount > 0}
                  onClick={() => {
                    if (!window.confirm(`Apply ${mergeCount} merge${mergeCount !== 1 ? "s" : ""}? This cannot be undone.`)) return;
                    applyStream.start();
                  }}
                >
                  Apply merges
                </Button>
              </div>
            </div>
          )}

          {applyStream.state.phase === "running" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{applyStream.state.label}</span>
                <span>{applyStream.state.processed}/{applyStream.state.total}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {applyStream.state.phase === "done" && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Done — {(applyStream.state.result as { merged?: number }).merged ?? 0} merged,{" "}
              {(applyStream.state.result as { skipped?: number }).skipped ?? 0} skipped
              {((applyStream.state.result as { errors?: unknown[] }).errors?.length ?? 0) > 0
                ? `, ${(applyStream.state.result as { errors: unknown[] }).errors.length} errors`
                : ""}
              .
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  applyStream.reset();
                  void qc.invalidateQueries({ queryKey: SCANS_QUERY_KEY });
                }}
              >
                Refresh
              </button>
            </div>
          )}

          {applyStream.state.phase === "error" && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {applyStream.state.message}
            </div>
          )}

          {discardMutation.isError && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {discardMutation.error?.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-base-content/10 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pairs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scan.pairs.map((pair) => (
            <PairRow
              key={pair.pairId}
              pair={pair}
              resolution={scan.resolutions[pair.pairId] ?? "review_later"}
              disabled={isClosed || isBusy}
              onChange={(v) => patchMutation.mutate({ [pair.pairId]: v })}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function PairRow({
  pair,
  resolution,
  disabled,
  onChange,
}: {
  pair: InternalDuplicatePair;
  resolution: InternalDuplicateResolution;
  disabled: boolean;
  onChange: (v: InternalDuplicateResolution) => void;
}) {
  const keepA = resolution === "merge_b_into_a";
  const keepB = resolution === "merge_a_into_b";

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="badge badge-sm badge-outline">
          {REASON_LABELS[pair.matchReason] ?? pair.matchReason}
        </span>
        <span className={cn("text-xs font-medium", confidenceColor(pair.confidence))}>
          {pair.confidence}% confidence
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div
          className={cn(
            "rounded-md border p-2 transition-colors",
            keepA
              ? "border-success/40 bg-success/10"
              : keepB
                ? "border-error/30 bg-error/5 opacity-60"
                : "border-base-content/10",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Individual A{keepA ? " · keeping" : keepB ? " · removing" : ""}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{pair.aDisplay}</p>
        </div>
        <div
          className={cn(
            "rounded-md border p-2 transition-colors",
            keepB
              ? "border-success/40 bg-success/10"
              : keepA
                ? "border-error/30 bg-error/5 opacity-60"
                : "border-base-content/10",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Individual B{keepB ? " · keeping" : keepA ? " · removing" : ""}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{pair.bDisplay}</p>
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Decision
        <select
          className="mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          value={resolution}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as InternalDuplicateResolution)}
        >
          {RESOLUTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
