"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LibApiValidationError } from "@/lib/admin/lib-api-validate";

const PARENT_CHILD_AGE_CODES_FATHER = new Set([
  "FATHER_TOO_YOUNG_AT_CHILD_BIRTH",
  "FATHER_TOO_OLD_AT_CHILD_BIRTH",
  "CHILD_BORN_BEFORE_FATHER",
]);
const PARENT_CHILD_AGE_CODES_MOTHER = new Set([
  "MOTHER_TOO_YOUNG_AT_CHILD_BIRTH",
  "MOTHER_TOO_OLD_AT_CHILD_BIRTH",
  "CHILD_BORN_BEFORE_MOTHER",
]);

function normXref(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** Human-readable role for DB cards when this finding ties specific individuals together. */
function validationRecordRoleLabel(
  code: string,
  recXref: string | null | undefined,
  finding: LibApiValidationError,
): string | null {
  const x = normXref(recXref);
  if (!x) return null;
  const details = finding.Details;
  const childXref = normXref(details?.child ?? finding.RelatedXref);
  const parentXref = normXref(details?.parent);
  const familyXref = normXref(finding.Xref);

  if (PARENT_CHILD_AGE_CODES_FATHER.has(code)) {
    if (parentXref && x === parentXref) return "Father";
    if (childXref && x === childXref) return "Child";
    if (familyXref && x === familyXref) return "Family group";
    return null;
  }
  if (PARENT_CHILD_AGE_CODES_MOTHER.has(code)) {
    if (parentXref && x === parentXref) return "Mother";
    if (childXref && x === childXref) return "Child";
    if (familyXref && x === familyXref) return "Family group";
    return null;
  }
  return null;
}

function roleSortOrder(label: string | null): number {
  switch (label) {
    case "Father":
    case "Mother":
      return 0;
    case "Child":
      return 1;
    case "Family group":
      return 2;
    default:
      return 9;
  }
}
import type {
  FamilyDbContext,
  IndividualDbContext,
  NoteDbContext,
  SourceDbContext,
  ValidationDbContextResponse,
} from "@/lib/admin/gedcom-validation-db-context";

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

function editHrefForRecord(
  rec: IndividualDbContext | FamilyDbContext | SourceDbContext | NoteDbContext,
): string {
  switch (rec.kind) {
    case "individual":
      return `/admin/individuals/${rec.id}/edit`;
    case "family":
      return `/admin/families/${rec.id}/edit`;
    case "source":
      return `/admin/sources/${rec.id}/edit`;
    case "note":
      return `/admin/notes/${rec.id}/edit`;
  }
}

function IndividualLinksList({ links }: { links: IndividualDbContext["links"] }) {
  const items: string[] = [];
  if (links.familiesAsSpouse.length)
    items.push(`Spouse in ${links.familiesAsSpouse.length} famil${links.familiesAsSpouse.length === 1 ? "y" : "ies"} (HUSB/WIFE)`);
  if (links.familiesAsChild.length) items.push(`Child in ${links.familiesAsChild.length} famil${links.familiesAsChild.length === 1 ? "y" : "ies"}`);
  if (links.spouseEdgeCount) items.push(`Spouse edges (gedcom_spouses): ${links.spouseEdgeCount}`);
  if (links.parentChildAsParentCount) items.push(`Parent-child rows as parent: ${links.parentChildAsParentCount}`);
  if (links.parentChildAsChildCount) items.push(`Parent-child rows as child: ${links.parentChildAsChildCount}`);
  if (links.familyChildRowCount) items.push(`Family–child junction rows: ${links.familyChildRowCount}`);
  if (links.familyPartnerRowCount) items.push(`Family partner rows: ${links.familyPartnerRowCount}`);
  if (links.individualEventCount) items.push(`Individual events: ${links.individualEventCount}`);
  if (links.individualNoteCount) items.push(`Individual–note links: ${links.individualNoteCount}`);
  if (links.individualSourceCount) items.push(`Individual–source citations: ${links.individualSourceCount}`);
  if (links.associationAsSubjectCount) items.push(`ASSO as subject: ${links.associationAsSubjectCount}`);
  if (links.associationAsAssociateCount) items.push(`ASSO as associate: ${links.associationAsAssociateCount}`);
  if (links.individualMediaCount) items.push(`Individual media links: ${links.individualMediaCount}`);
  if (items.length === 0) items.push("No relationship junction rows found for this individual.");
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function FamilyLinksList({ links }: { links: FamilyDbContext["links"] }) {
  const items: string[] = [];
  if (links.familyChildCount) items.push(`Children linked: ${links.familyChildCount}`);
  if (links.familyPartnerCount) items.push(`Partner rows: ${links.familyPartnerCount}`);
  if (links.spouseEdgeCount) items.push(`Spouse edges: ${links.spouseEdgeCount}`);
  if (links.parentChildCount) items.push(`Parent–child rows: ${links.parentChildCount}`);
  if (links.familyEventCount) items.push(`Family events: ${links.familyEventCount}`);
  if (links.familyNoteCount) items.push(`Family–note links: ${links.familyNoteCount}`);
  if (links.familySourceCount) items.push(`Family–source citations: ${links.familySourceCount}`);
  if (links.familyMediaCount) items.push(`Family media links: ${links.familyMediaCount}`);
  if (items.length === 0) items.push("No junction rows found for this family.");
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function RecordCard({
  rec,
  roleLabel,
}: {
  rec: IndividualDbContext | FamilyDbContext | SourceDbContext | NoteDbContext;
  roleLabel?: string | null;
}) {
  const edit = editHrefForRecord(rec);
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {roleLabel ? (
            <p className="mb-1.5 w-fit rounded-md border border-border bg-muted/80 px-2 py-0.5 text-xs font-semibold tracking-tight text-foreground">
              {roleLabel}
            </p>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rec.kind}</p>
          <p className="font-mono text-sm">{rec.xref}</p>
        </div>
        <Link
          href={edit}
          className={cn(buttonVariants({ size: "sm", variant: "default" }))}
        >
          Edit
        </Link>
      </div>
      {rec.kind === "individual" ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{rec.summary.fullName ?? "—"}</dd>
            <dt className="text-muted-foreground">Sex</dt>
            <dd>{rec.summary.sex ?? "—"}</dd>
            <dt className="text-muted-foreground">Birth year</dt>
            <dd>{rec.summary.birthYear ?? "—"}</dd>
            <dt className="text-muted-foreground">Death year</dt>
            <dd>{rec.summary.deathYear ?? "—"}</dd>
            <dt className="text-muted-foreground">Living</dt>
            <dd>{rec.summary.isLiving ? "yes" : "no"}</dd>
          </dl>
          <div>
            <p className="mb-1 text-xs font-medium text-foreground/80">Database links</p>
            <IndividualLinksList links={rec.links} />
          </div>
        </>
      ) : null}
      {rec.kind === "family" ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Husband xref</dt>
            <dd className="font-mono text-xs">{rec.summary.husbandXref ?? "—"}</dd>
            <dt className="text-muted-foreground">Wife xref</dt>
            <dd className="font-mono text-xs">{rec.summary.wifeXref ?? "—"}</dd>
            <dt className="text-muted-foreground">Marriage year</dt>
            <dd>{rec.summary.marriageYear ?? "—"}</dd>
            <dt className="text-muted-foreground">Children count</dt>
            <dd>{rec.summary.childrenCount}</dd>
          </dl>
          <div>
            <p className="mb-1 text-xs font-medium text-foreground/80">Database links</p>
            <FamilyLinksList links={rec.links} />
          </div>
        </>
      ) : null}
      {rec.kind === "source" ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Title</dt>
          <dd>{rec.summary.title ?? "—"}</dd>
          <dt className="text-muted-foreground">Author</dt>
          <dd>{rec.summary.author ?? "—"}</dd>
          <dt className="text-muted-foreground">Citations</dt>
          <dd>
            ind {rec.links.individualSourceCount}, fam {rec.links.familySourceCount}, evt{" "}
            {rec.links.eventSourceCount}
          </dd>
          <dt className="text-muted-foreground">Source–note links</dt>
          <dd>{rec.links.sourceNoteCount}</dd>
        </dl>
      ) : null}
      {rec.kind === "note" ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Top-level</dt>
          <dd>{rec.summary.isTopLevel ? "yes" : "no"}</dd>
          <dt className="text-muted-foreground">Preview</dt>
          <dd className="break-words text-muted-foreground">{rec.summary.contentPreview || "—"}</dd>
          <dt className="text-muted-foreground">Links</dt>
          <dd>
            ind {rec.links.individualNoteCount}, fam {rec.links.familyNoteCount}, evt {rec.links.eventNoteCount}, src{" "}
            {rec.links.sourceNoteCount}
          </dd>
        </dl>
      ) : null}
    </div>
  );
}

export type GedcomValidationFindingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: LibApiValidationError | null;
};

export function GedcomValidationFindingModal({ open, onOpenChange, finding }: GedcomValidationFindingModalProps) {
  const [ctx, setCtx] = useState<ValidationDbContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const load = useCallback(async (f: LibApiValidationError) => {
    setLoading(true);
    setFetchErr(null);
    setCtx(null);
    try {
      const res = await fetch("/api/admin/gedcom/validation-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finding: f }),
      });
      const data = (await res.json()) as ValidationDbContextResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setCtx(data);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !finding) {
      setCtx(null);
      setFetchErr(null);
      return;
    }
    void load(finding);
  }, [open, finding, load]);

  const sortedContextRecords = useMemo(() => {
    const records = ctx?.records;
    if (!records?.length || !finding) return records ?? [];
    const withRoles = records.map((rec) => ({
      rec,
      role: validationRecordRoleLabel(finding.Code, rec.xref, finding),
    }));
    if (!withRoles.some((w) => w.role != null)) return records;
    return [...withRoles]
      .sort((a, b) => {
        const da = roleSortOrder(a.role);
        const db = roleSortOrder(b.role);
        if (da !== db) return da - db;
        return `${a.rec.kind}-${a.rec.id}`.localeCompare(`${b.rec.kind}-${b.rec.id}`);
      })
      .map((w) => w.rec);
  }, [ctx?.records, finding]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,52rem)] w-full max-w-[min(96vw,42rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-[min(96vw,42rem)]",
        )}
      >
        <div className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle>Validation finding</DialogTitle>
          <DialogDescription className="sr-only">Details and database context for one validation result.</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {!finding ? null : (
            <>
              <section className="space-y-2 rounded-lg border border-base-content/10 bg-base-content/[0.04] p-4">
                <p className={cn("text-sm font-medium", severityClass(finding.Severity))}>{severityLabel(finding.Severity)}</p>
                <p className="font-mono text-xs text-muted-foreground">{finding.Code}</p>
                <p className="text-sm leading-relaxed">{finding.Message}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Primary xref</dt>
                  <dd className="font-mono">{finding.Xref || "—"}</dd>
                  {finding.RelatedXref ? (
                    <>
                      <dt className="text-muted-foreground">Related xref</dt>
                      <dd className="font-mono">{finding.RelatedXref}</dd>
                    </>
                  ) : null}
                </dl>
                {finding.Details && Object.keys(finding.Details).length > 0 ? (
                  <div className="pt-2">
                    <p className="mb-1 text-xs font-medium text-foreground/80">Details</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      {Object.entries(finding.Details).map(([k, v]) => (
                        <DetailsRow key={k} k={k} v={v} />
                      ))}
                    </dl>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Admin tree database</h3>
                <p className="text-xs text-muted-foreground">
                  Scoped to the configured admin GEDCOM file (<span className="font-mono">fileUuid</span> in the API).
                  Xrefs from an uploaded file may not match rows until that file is imported.
                </p>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading database context…
                  </div>
                ) : null}
                {fetchErr ? <p className="text-sm text-destructive">{fetchErr}</p> : null}
                {!loading && !fetchErr && ctx?.records.length === 0 && (ctx?.xrefsNotInDatabase?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No xrefs on this finding to look up.</p>
                ) : null}
                {!loading &&
                  sortedContextRecords.map((rec) => (
                    <RecordCard
                      key={`${rec.kind}-${rec.id}`}
                      rec={rec}
                      roleLabel={finding ? validationRecordRoleLabel(finding.Code, rec.xref, finding) : null}
                    />
                  ))}
                {!loading && ctx && ctx.xrefsNotInDatabase.length > 0 ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Not found in this tree</p>
                    <ul className="mt-1 list-inside list-disc font-mono text-xs">
                      {ctx.xrefsNotInDatabase.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-all font-mono">{v}</dd>
    </>
  );
}
