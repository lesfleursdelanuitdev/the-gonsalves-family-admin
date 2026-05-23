"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GitMerge, Upload, Users, History, EyeOff, ListChecks } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ImportMatchCandidate,
  ImportMatchAlternative,
  ImportMergePlan,
  ImportResolution,
} from "@/lib/admin/gedcom-import-merge-plan";
import { useApplyStream } from "@/hooks/useApplyStream";
import type { GedcomApplyStreamEvent } from "@/app/api/admin/imports/gedcom/[id]/apply-stream/route";
import { InternalDuplicatesPanel } from "./InternalDuplicatesPanel";
import { MergeHistoryPanel } from "./MergeHistoryPanel";
import { ReviewQueuePanel } from "./ReviewQueuePanel";

type Tab = "duplicates" | "gedcom" | "review" | "history" | "ignored";

const TABS: { id: Tab; label: string; icon: typeof GitMerge }[] = [
  { id: "duplicates", label: "Internal Duplicates", icon: Users },
  { id: "gedcom", label: "GEDCOM Comparison", icon: Upload },
  { id: "review", label: "Review Queue", icon: ListChecks },
  { id: "history", label: "Merge History", icon: History },
  { id: "ignored", label: "Ignored", icon: EyeOff },
];

const RESOLUTION_OPTIONS: { value: ImportResolution; label: string }[] = [
  { value: "merge_into_existing", label: "Merge into existing" },
  { value: "create_new", label: "Create as new" },
  { value: "skip", label: "Skip import" },
  { value: "mark_not_match", label: "Not a match" },
  { value: "review_later", label: "Review later" },
];

export function MergeRecordsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab = tabParam && TABS.some((x) => x.id === tabParam) ? tabParam : "gedcom";
  const setTab = (t: Tab) => {
    router.replace(`/admin/merge-records?tab=${t}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <GitMerge className="size-5 shrink-0" aria-hidden />
          </span>
          Merge Records
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Compare a new GEDCOM against the configured admin tree before writing to genealogy tables,
          or scan for duplicates already in the tree.
        </p>
      </header>

      <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-base-content/10 bg-base-200/40 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-base-100 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-base-100/60 hover:text-foreground",
              )}
              onClick={() => setTab(t.id)}
            >
              <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "duplicates" ? <InternalDuplicatesPanel /> : null}
      {activeTab === "gedcom" ? <GedcomComparisonPanel /> : null}
      {activeTab === "review" ? <ReviewQueuePanel /> : null}
      {activeTab === "history" ? <MergeHistoryPanel /> : null}
      {activeTab === "ignored" ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle>Ignored</CardTitle>
            <CardDescription>Candidates marked as not relevant — coming soon.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

type ImportRow = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
};

function GedcomComparisonPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"pick" | "flow">("pick");
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    import: Record<string, unknown>;
    effectiveResolutions?: Record<string, ImportResolution>;
    alternativeSelections?: Record<string, string>;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const applyStream = useApplyStream<GedcomApplyStreamEvent & { type: "done" }>(
    activeId ? `/api/admin/imports/gedcom/${activeId}/apply-stream` : null,
  );

  const loadImports = useCallback(async () => {
    const res = await fetch("/api/admin/imports/gedcom");
    if (!res.ok) return;
    const j = (await res.json()) as { imports: ImportRow[] };
    setImports(j.imports ?? []);
  }, []);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/imports/gedcom/${id}`);
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    const j = (await res.json()) as {
      import: Record<string, unknown>;
      effectiveResolutions: Record<string, ImportResolution>;
      alternativeSelections: Record<string, string>;
    };
    setDetail(j);
  }, []);

  useEffect(() => {
    if (activeId) void loadDetail(activeId);
    else setDetail(null);
  }, [activeId, loadDetail]);

  const plan = useMemo(() => {
    if (!detail?.import?.importMergePlanJson) return null;
    return detail.import.importMergePlanJson as ImportMergePlan;
  }, [detail]);

  const onUpload = async (file: File) => {
    setErr(null);
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/imports/gedcom", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || res.statusText);
      const imp = (j as { import: { id: string } }).import;
      await loadImports();
      setActiveId(imp.id);
      setMode("flow");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onCompare = async () => {
    if (!activeId) return;
    setErr(null);
    setBusy("compare");
    try {
      const res = await fetch(`/api/admin/imports/gedcom/${activeId}/compare`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || res.statusText);
      await loadDetail(activeId);
      await loadImports();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onPatchResolution = async (candidateId: string, value: ImportResolution) => {
    if (!activeId) return;
    setBusy(`res-${candidateId}`);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/imports/gedcom/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions: { [candidateId]: value } }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadDetail(activeId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onPatchAlternative = async (candidateId: string, existingIndividualId: string) => {
    if (!activeId) return;
    setBusy(`alt-${candidateId}`);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/imports/gedcom/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutions: { [candidateId]: "merge_into_existing" },
          alternativeOverrides: { [candidateId]: existingIndividualId },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadDetail(activeId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onDiscard = async () => {
    if (!activeId) return;
    if (!window.confirm("Discard this import?")) return;
    setBusy("discard");
    try {
      const res = await fetch(`/api/admin/imports/gedcom/${activeId}/discard`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setActiveId(null);
      await loadImports();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onApply = () => {
    if (!activeId) return;
    if (!window.confirm("Apply all decisions? This will create and merge individuals in the genealogy database. This cannot be undone.")) return;
    applyStream.start();
  };

  if (mode === "pick") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Find duplicates already in this tree</CardTitle>
            <CardDescription>Scan existing records for possible duplicates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                // Switch to duplicates tab
                window.location.href = "/admin/merge-records?tab=duplicates";
              }}
            >
              Go to Internal Duplicates →
            </Button>
          </CardContent>
        </Card>
        <Card className="border-base-content/10 bg-card/80 ring-1 ring-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Compare a new GEDCOM file</CardTitle>
            <CardDescription>
              Upload a file and compare it against this tree before importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".ged,.GED,text/plain"
              className="sr-only"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (f) void onUpload(f);
              }}
            />
            <Button type="button" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Choose GEDCOM
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setMode("flow")}>
              I already have an import in the list →
            </Button>
          </CardContent>
        </Card>
        {err ? <p className="text-sm text-error md:col-span-2">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setMode("pick")}>
          ← Mode choice
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadImports()}>
            Refresh list
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{err}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent imports</CardTitle>
            <CardDescription>Select one to compare or review.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {imports.length === 0 ? <p className="text-muted-foreground">No imports yet.</p> : null}
            {imports.map((r) => (
              <button
                key={r.id}
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-md border px-2 py-2 text-left transition-colors",
                  activeId === r.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-base-200/80",
                )}
                onClick={() => setActiveId(r.id)}
              >
                <span className="font-medium">{r.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {r.status} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {!activeId ? (
            <Card className="border-base-content/10 bg-card/80">
              <CardContent className="pt-6 text-sm text-muted-foreground">Select an import on the left.</CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-base-content/10 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">GEDCOM comparison summary</CardTitle>
                  <CardDescription>
                    Compared against the configured admin tree.{" "}
                    <Link href="/admin/settings" className="link link-primary">
                      Tree settings
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {plan ? (
                    <SummaryBlock plan={plan} />
                  ) : (
                    <p className="text-muted-foreground">
                      Parsed file is loaded. Run <strong>Compare to tree</strong> to classify individuals and build
                      the import merge plan.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void onCompare()} disabled={Boolean(busy) || applyStream.state.phase === "running"}>
                      {busy === "compare" ? "Comparing…" : "Compare to tree"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void onDiscard()} disabled={Boolean(busy) || applyStream.state.phase === "running"}>
                      Discard import
                    </Button>
                    {plan && applyStream.state.phase === "idle" ? (
                      <Button type="button" variant="secondary" onClick={onApply} disabled={Boolean(busy)}>
                        Apply approved decisions
                      </Button>
                    ) : null}
                  </div>

                  {applyStream.state.phase === "running" && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{applyStream.state.label}</span>
                        <span>{applyStream.state.processed}/{applyStream.state.total}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-150"
                          style={{
                            width: applyStream.state.total > 0
                              ? `${Math.round((applyStream.state.processed / applyStream.state.total) * 100)}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {applyStream.state.phase === "done" && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                      Done —{" "}
                      {(applyStream.state.result as { stats?: { created?: number } }).stats?.created ?? 0} created,{" "}
                      {(applyStream.state.result as { stats?: { merged?: number } }).stats?.merged ?? 0} merged,{" "}
                      {(applyStream.state.result as { stats?: { skipped?: number } }).stats?.skipped ?? 0} skipped.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => { applyStream.reset(); void loadDetail(activeId!); void loadImports(); }}
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
                </CardContent>
              </Card>

              {plan ? (
                <Card className="border-base-content/10 bg-card/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Individuals — review</CardTitle>
                    <CardDescription>
                      <span className="font-medium text-foreground">Left column</span> is the existing database tree;{" "}
                      <span className="font-medium text-foreground">right column</span> is the uploaded GEDCOM snapshot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plan.candidates.map((c) => (
                      <CandidateRow
                        key={c.candidateId}
                        c={c}
                        value={detail?.effectiveResolutions?.[c.candidateId] ?? "review_later"}
                        alternativeSelection={detail?.alternativeSelections?.[c.candidateId]}
                        disabled={Boolean(busy) || applyStream.state.phase === "running" || applyStream.state.phase === "done"}
                        onChange={(v) => void onPatchResolution(c.candidateId, v)}
                        onAlternativeChange={(existingId) => void onPatchAlternative(c.candidateId, existingId)}
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ plan }: { plan: ImportMergePlan }) {
  const s = plan.summary;
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/30 p-4">
      <p className="font-medium text-foreground">File: {plan.importFilename}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imported records</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground">
        <li>{s.importedIndividuals.toLocaleString()} individuals</li>
        <li>{s.importedFamilies.toLocaleString()} families</li>
        <li>{s.importedEvents.toLocaleString()} events</li>
        <li>{s.importedNotes.toLocaleString()} notes</li>
        <li>{s.importedMedia.toLocaleString()} media references</li>
      </ul>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compared against</p>
      <p className="text-foreground">{plan.treeLabel}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Results (individuals)</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground">
        <li>{s.likelyExisting} likely existing</li>
        <li>{s.possibleMatches} possible matches need review</li>
        <li>{s.newRecords} likely new people</li>
        <li>{s.conflicts} conflicts</li>
        <li>{s.warnings} validation warnings / errors flag</li>
      </ul>
    </div>
  );
}

function CandidateRow({
  c,
  value,
  alternativeSelection,
  disabled,
  onChange,
  onAlternativeChange,
}: {
  c: ImportMatchCandidate;
  value: ImportResolution;
  alternativeSelection?: string;
  disabled: boolean;
  onChange: (v: ImportResolution) => void;
  onAlternativeChange?: (existingIndividualId: string) => void;
}) {
  const catLabel =
    c.category === "likely_existing"
      ? "Likely existing"
      : c.category === "possible_match"
        ? "Possible match"
        : c.category === "new_record"
          ? "New record"
          : c.category === "conflict"
            ? "Conflict"
            : "Warning";

  const showAlternativePicker =
    value === "merge_into_existing" &&
    c.alternatives &&
    c.alternatives.length > 1 &&
    onAlternativeChange;

  const selectedAlt: string =
    alternativeSelection ??
    c.existingIndividualId ??
    c.alternatives?.[0]?.existingIndividualId ??
    "";

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="badge badge-sm badge-outline">{catLabel}</span>
        {c.confidencePct != null ? (
          <span className="text-xs text-muted-foreground">Score ~{c.confidencePct}%</span>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300/90">
            Existing tree record
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{c.existingDisplay}</p>
        </div>
        <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
            Imported GEDCOM record
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{c.importedDisplay}</p>
        </div>
      </div>
      {c.detail ? <p className="mt-2 text-xs text-muted-foreground">{c.detail}</p> : null}

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Resolution
        <select
          className="mt-1 flex h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as ImportResolution)}
        >
          {RESOLUTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {showAlternativePicker ? (
        <label className="mt-2 block text-xs font-medium text-muted-foreground">
          Merge into which existing record?
          <select
            className="mt-1 flex h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={selectedAlt}
            disabled={disabled}
            onChange={(e) => onAlternativeChange?.(e.target.value)}
          >
            {(c.alternatives as ImportMatchAlternative[]).map((alt) => (
              <option key={alt.existingIndividualId} value={alt.existingIndividualId}>
                {alt.label}{alt.scorePct != null ? ` (~${alt.scorePct}%)` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
