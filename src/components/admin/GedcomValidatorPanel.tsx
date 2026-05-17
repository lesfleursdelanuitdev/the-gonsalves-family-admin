"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, FileCheck, Loader2, Trash2, TreeDeciduous, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LibApiValidationError, LibApiValidateResponse } from "@/lib/admin/lib-api-validate";
import { GedcomValidationFindingModal } from "@/components/admin/GedcomValidationFindingModal";
import { toast } from "sonner";
import { useAdminCrudPermissions } from "@/hooks/useAdminAuthz";

type ValidatePayload = LibApiValidateResponse & {
  source: "upload" | "database";
  filename?: string;
  fileUuid?: string;
};

function severityLabel(s: number): string {
  if (s === 2) return "Error";
  if (s === 1) return "Warning";
  return "Hint";
}

function severityClass(s: number): string {
  if (s === 2) return "text-destructive font-medium";
  if (s === 1) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

type SeverityTab = "all" | "error" | "warning" | "hint";

function matchesSeverityTab(row: LibApiValidationError, tab: SeverityTab): boolean {
  if (tab === "all") return true;
  if (tab === "error") return row.Severity === 2;
  if (tab === "warning") return row.Severity === 1;
  return row.Severity === 0;
}

export function GedcomValidatorPanel() {
  const authz = useAdminCrudPermissions("gedcom", "gedcom");
  const canValidateUpload = Boolean(authz.permissions.validate_external);
  const canValidateTree = Boolean(authz.permissions.validate_tree);

  const [busy, setBusy] = useState<"upload" | "tree" | "cleanup" | null>(null);
  const [result, setResult] = useState<ValidatePayload | null>(null);
  const [severityTab, setSeverityTab] = useState<SeverityTab>("all");
  /** Codes to hide from the table (multi-select). */
  const [excludedCodes, setExcludedCodes] = useState<string[]>([]);
  const [hideCodesPanelOpen, setHideCodesPanelOpen] = useState(false);
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<LibApiValidationError | null>(null);

  const allRows = useMemo(() => result?.errors ?? [], [result]);

  const distinctCodes = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) {
      if (r.Code) s.add(r.Code);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const emptyFamilyFindingCount = useMemo(
    () => allRows.filter((r) => r.Code === "EMPTY_FAMILY").length,
    [allRows],
  );

  const excludedSet = useMemo(() => new Set(excludedCodes), [excludedCodes]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (excludedSet.has(r.Code)) return false;
      return matchesSeverityTab(r, severityTab);
    });
  }, [allRows, excludedSet, severityTab]);

  const toggleCodeExcluded = useCallback((code: string) => {
    setExcludedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }, []);

  const clearExcludedCodes = useCallback(() => setExcludedCodes([]), []);

  const openFindingModal = useCallback((row: LibApiValidationError) => {
    setSelectedFinding(row);
    setFindingModalOpen(true);
  }, []);

  const onFindingModalOpenChange = useCallback((open: boolean) => {
    setFindingModalOpen(open);
    if (!open) setSelectedFinding(null);
  }, []);

  const runTreeValidation = useCallback(async (): Promise<ValidatePayload> => {
    const res = await fetch("/api/admin/gedcom/validate/tree", { method: "POST" });
    const data = (await res.json()) as ValidatePayload & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return data;
  }, []);

  const onValidateTree = useCallback(async () => {
    setBusy("tree");
    setResult(null);
    try {
      const data = await runTreeValidation();
      setResult(data);
      setSeverityTab("all");
      setExcludedCodes([]);
      if (data.valid) {
        toast.success("Tree passed validation (no blocking errors).");
      } else {
        toast.error("Validation reported errors — see table below.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [runTreeValidation]);

  const onCleanupEmptyFamilies = useCallback(async () => {
    if (emptyFamilyFindingCount === 0) return;
    if (
      !window.confirm(
        `Remove empty families from the admin tree database? The validator reported ${emptyFamilyFindingCount} EMPTY_FAMILY finding${emptyFamilyFindingCount === 1 ? "" : "s"}. ` +
          `This deletes family rows that have no husband, wife, or children (and their family-only links). People are not deleted. ` +
          `Rows that still have internal spouse or partner junctions will be skipped. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy("cleanup");
    try {
      const res = await fetch("/api/admin/gedcom/cleanup-empty-families", { method: "POST" });
      const data = (await res.json()) as {
        deletedCount?: number;
        skipped?: { xref: string; reason: string }[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const deleted = data.deletedCount ?? 0;
      const skipped = data.skipped ?? [];
      if (deleted > 0) {
        toast.success(`Removed ${deleted} empty famil${deleted === 1 ? "y" : "ies"} from the database.`);
      } else {
        toast.message("No empty families were deleted (none matched the safe cleanup criteria).");
      }
      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} famil${skipped.length === 1 ? "y" : "ies"} skipped (still have spouse or partner rows).`,
        );
      }
      const v = await runTreeValidation();
      setResult(v);
      setSeverityTab("all");
      setExcludedCodes([]);
      if (!v.valid && (v.errors?.length ?? 0) > 0) {
        toast.error("Validation still reports errors — see table below.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [emptyFamilyFindingCount, runTreeValidation]);

  const onValidateFile = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("gedcom-file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      toast.error("Choose a GEDCOM file first.");
      return;
    }
    setBusy("upload");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/gedcom/validate", { method: "POST", body: fd });
      const data = (await res.json()) as ValidatePayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data);
      setSeverityTab("all");
      setExcludedCodes([]);
      if (data.valid) {
        toast.success("File passed validation (no blocking errors).");
      } else {
        toast.error("Validation reported errors — see table below.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {canValidateUpload ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-primary" aria-hidden />
              Upload a GEDCOM file
            </CardTitle>
            <CardDescription>
              Sends the file to <span className="font-mono text-[11px]">ligneous-gedcom-lib-api</span>{" "}
              <span className="font-mono text-[11px]">POST /api/v1/validate</span> (parse + structural checks).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onValidateFile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gedcom-file">File</Label>
                <Input
                  id="gedcom-file"
                  name="gedcom-file"
                  type="file"
                  accept=".ged,.GED,.txt,text/plain"
                  disabled={busy !== null}
                />
              </div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "upload" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Validating…
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 size-4" aria-hidden />
                    Validate upload
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}

        {canValidateTree ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TreeDeciduous className="size-4 text-primary" aria-hidden />
              Configured admin tree
            </CardTitle>
            <CardDescription>
              Builds the same enriched payload as export, generates GEDCOM via the lib API, then validates that
              output — so results match what you would download from{" "}
              <span className="font-medium text-foreground/90">Export</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onValidateTree} disabled={busy !== null}>
              {busy === "tree" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Validating…
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 size-4" aria-hidden />
                  Validate database tree
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        ) : null}
      </div>

      {!authz.isLoading && !canValidateUpload && !canValidateTree ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You do not have permission to run GEDCOM validation checks.
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>
              Source:{" "}
              <span className="font-medium text-foreground/90">
                {result.source === "database" ? "Database (exported GEDCOM)" : `Upload${result.filename ? ` — ${result.filename}` : ""}`}
              </span>
              {result.fileUuid ? (
                <>
                  {" "}
                  · file UUID <span className="font-mono text-[11px]">{result.fileUuid}</span>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={cn(
                  "rounded-md border px-2 py-1 font-medium",
                  result.valid ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {result.valid ? "Valid (no errors)" : "Has errors"}
              </span>
            </div>

            {result.source === "database" && canValidateTree && emptyFamilyFindingCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
                <p className="min-w-0 flex-1">
                  <span className="font-medium">Empty families</span> — {emptyFamilyFindingCount} EMPTY_FAMILY
                  finding{emptyFamilyFindingCount === 1 ? "" : "s"}. You can remove matching empty family rows from the
                  admin tree database (individuals are not deleted).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={busy !== null}
                  onClick={() => void onCleanupEmptyFamilies()}
                >
                  {busy === "cleanup" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Working…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 size-4" aria-hidden />
                      Clean up empty families
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {(result.errors?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No findings to list.</p>
            ) : (
              <>
                <div
                  role="tablist"
                  aria-label="Filter by severity"
                  className="flex flex-wrap gap-2 border-b border-base-content/10 pb-3"
                >
                  {(
                    [
                      { id: "all" as const, label: "All", count: allRows.length },
                      { id: "error" as const, label: "Errors", count: result.counts?.errors ?? 0 },
                      { id: "warning" as const, label: "Warnings", count: result.counts?.warnings ?? 0 },
                      { id: "hint" as const, label: "Hints", count: result.counts?.hints ?? 0 },
                    ] as const
                  ).map((tab) => {
                    const selected = severityTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        id={`validator-tab-${tab.id}`}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-base-content/15 bg-base-content/[0.04] text-foreground/90 hover:bg-base-content/10",
                        )}
                        onClick={() => setSeverityTab(tab.id)}
                      >
                        {tab.label}
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-xs tabular-nums",
                            selected ? "bg-primary/20 text-primary" : "bg-base-content/10 text-muted-foreground",
                          )}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {distinctCodes.length > 0 ? (
                  <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left hover:bg-base-content/5"
                        aria-expanded={hideCodesPanelOpen}
                        id="validator-hide-codes-toggle"
                        onClick={() => setHideCodesPanelOpen((o) => !o)}
                      >
                        <ChevronRight
                          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", hideCodesPanelOpen && "rotate-90")}
                          aria-hidden
                        />
                        <span className="text-sm font-medium">Hide codes</span>
                        {excludedCodes.length > 0 ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                            {excludedCodes.length} hidden
                          </span>
                        ) : null}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={excludedCodes.length === 0}
                        onClick={clearExcludedCodes}
                      >
                        Clear hidden ({excludedCodes.length})
                      </Button>
                    </div>
                    {hideCodesPanelOpen ? (
                      <div className="mt-3 space-y-2 border-t border-base-content/10 pt-3" role="region" aria-label="Hide codes checklist">
                        <p className="text-xs text-muted-foreground">
                          Checked codes are excluded from the table below. Uncheck or clear to show them again.
                        </p>
                        <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                          {distinctCodes.map((code, idx) => {
                            const checked = excludedSet.has(code);
                            const id = `validator-hide-code-${idx}`;
                            return (
                              <div key={code} className="flex items-start gap-2">
                                <input
                                  id={id}
                                  type="checkbox"
                                  className="mt-1 size-4 shrink-0 rounded border-input"
                                  checked={checked}
                                  onChange={() => toggleCodeExcluded(code)}
                                />
                                <label htmlFor={id} className="cursor-pointer font-mono text-xs leading-snug">
                                  {code}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {filteredRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No findings match the current filters (
                    {severityTab === "all"
                      ? "all severities"
                      : severityTab === "error"
                        ? "errors only"
                        : severityTab === "warning"
                          ? "warnings only"
                          : "hints only"}
                    {excludedCodes.length > 0 ? `; ${excludedCodes.length} code(s) hidden` : ""}).
                  </p>
                ) : null}

                {filteredRows.length > 0 ? (
              <div className="max-h-[min(60vh,32rem)] overflow-auto rounded-lg border border-base-content/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead className="w-[160px]">Code</TableHead>
                      <TableHead className="w-[120px]">Xref</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="w-[88px] text-right"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row: LibApiValidationError, i: number) => (
                      <TableRow
                        key={`${row.Code}-${row.Xref}-${row.RelatedXref ?? ""}-${i}`}
                        className="cursor-pointer hover:bg-muted/50"
                        tabIndex={0}
                        title="Open details"
                        onClick={() => openFindingModal(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openFindingModal(row);
                          }
                        }}
                      >
                        <TableCell className={cn("align-top text-xs", severityClass(row.Severity))}>
                          {severityLabel(row.Severity)}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs">{row.Code}</TableCell>
                        <TableCell className="align-top font-mono text-xs">{row.Xref || "—"}</TableCell>
                        <TableCell className="align-top text-sm">{row.Message}</TableCell>
                        <TableCell className="align-top text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFindingModal(row);
                            }}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <GedcomValidationFindingModal
        open={findingModalOpen}
        onOpenChange={onFindingModalOpenChange}
        finding={selectedFinding}
      />
    </div>
  );
}
