"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, CircleHelp, Link2, UserPlus, Users } from "lucide-react";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import {
  RELATIONSHIP_OPTIONS,
} from "@/components/admin/individual-editor/individual-editor-family-constants";
import { spouseFamilyCardPartnerTitle } from "@/components/admin/individual-editor/individual-editor-family-card-label";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  buildMiniIndividualEditorBody,
  emptyMiniIndividualFields,
  miniIndividualHasNameParts,
  type MiniIndividualFields,
} from "@/lib/forms/family-mini-individual-payload";
import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";
import { ApiError, postJson } from "@/lib/infra/api";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { cn } from "@/lib/utils";

export type WizardPath = "unknown_parent" | "existing_person" | "new_person" | "existing_family";

export type AddChildWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectIndividualId: string;
  mode: "create" | "edit";
  familiesAsSpouse: SpouseFamilyFormRow[];
  /** When opening from a family card, skip context selection. */
  initialFamilyId?: string | null;
};

function parseBirthOrder(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function committedFamilies(rows: SpouseFamilyFormRow[]): SpouseFamilyFormRow[] {
  return rows.filter(
    (r) =>
      r.familyId.trim() &&
      !r.newFamilyExistingPartnerId &&
      !r.newFamilyNewPartner,
  );
}

function PathChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  accentClass,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
        selected
          ? cn("border-primary bg-primary/10 ring-1 ring-primary/30", accentClass)
          : "border-base-content/10 bg-base-content/[0.02] hover:border-base-content/20",
      )}
    >
      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
        <Icon className="size-5 shrink-0 opacity-90" aria-hidden />
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

export function AddChildWizardDialog({
  open,
  onOpenChange,
  subjectIndividualId,
  mode,
  familiesAsSpouse,
  initialFamilyId,
}: AddChildWizardDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<WizardPath | "">("");
  const [pathD_familyId, setPathD_familyId] = useState("");
  const [pathB_partnerId, setPathB_partnerId] = useState("");
  const [pathB_partnerLabel, setPathB_partnerLabel] = useState("");
  const [miniPartner, setMiniPartner] = useState<MiniIndividualFields>(() => emptyMiniIndividualFields());
  const [childMode, setChildMode] = useState<"search" | "create">("search");
  const [childExistingId, setChildExistingId] = useState("");
  const [childMini, setChildMini] = useState<MiniIndividualFields>(() => emptyMiniIndividualFields());
  const [relSingle, setRelSingle] = useState("biological");
  const [relCurrent, setRelCurrent] = useState("biological");
  const [relOther, setRelOther] = useState("biological");
  const [birthOrderStr, setBirthOrderStr] = useState("");
  const [busy, setBusy] = useState(false);

  const families = useMemo(() => committedFamilies(familiesAsSpouse), [familiesAsSpouse]);
  const familyContextLocked = !!initialFamilyId?.trim();

  const reset = useCallback(() => {
    setStep(1);
    setPath("");
    setPathD_familyId("");
    setPathB_partnerId("");
    setPathB_partnerLabel("");
    setMiniPartner(emptyMiniIndividualFields());
    setChildMode("search");
    setChildExistingId("");
    setChildMini(emptyMiniIndividualFields());
    setRelSingle("biological");
    setRelCurrent("biological");
    setRelOther("biological");
    setBirthOrderStr("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (initialFamilyId?.trim()) {
      setPath("existing_family");
      setPathD_familyId(initialFamilyId.trim());
      setStep(2);
    }
  }, [open, initialFamilyId, reset]);

  const familyRowForD = useMemo(
    () => families.find((r) => r.familyId === pathD_familyId),
    [families, pathD_familyId],
  );

  const twoParentsInContext = useMemo(() => {
    if (path === "existing_family" && familyRowForD) {
      return !!(familyRowForD.husbandId && familyRowForD.wifeId);
    }
    if (path === "existing_person" || path === "new_person") return true;
    return false;
  }, [path, familyRowForD]);

  const childExcludeIds = useMemo(() => {
    const s = new Set<string>();
    if (subjectIndividualId.trim()) s.add(subjectIndividualId.trim());
    if (pathB_partnerId.trim()) s.add(pathB_partnerId.trim());
    return s;
  }, [subjectIndividualId, pathB_partnerId]);

  const canAdvanceFromStep2 = useMemo(() => {
    const childOk =
      childMode === "search"
        ? !!childExistingId.trim()
        : miniIndividualHasNameParts(childMini);
    if (!childOk) return false;
    if (path === "existing_person") return !!pathB_partnerId.trim();
    if (path === "new_person") return miniIndividualHasNameParts(miniPartner);
    if (path === "existing_family") return !!pathD_familyId.trim();
    if (path === "unknown_parent") return true;
    return false;
  }, [
    childMode,
    childExistingId,
    childMini,
    path,
    pathB_partnerId,
    miniPartner,
    pathD_familyId,
  ]);

  const buildPayload = useCallback((): Record<string, unknown> => {
    const birthOrder = parseBirthOrder(birthOrderStr);
    const childPayload =
      childMode === "search"
        ? { kind: "existing", childIndividualId: childExistingId.trim() }
        : { kind: "new", individual: buildMiniIndividualEditorBody(childMini) };

    if (path === "unknown_parent") {
      return {
        path: "unknown_parent",
        child: childPayload,
        relationshipType: relSingle,
        ...(birthOrder !== undefined ? { birthOrder } : {}),
      };
    }
    if (path === "existing_person") {
      return {
        path: "existing_person",
        secondParentIndividualId: pathB_partnerId.trim(),
        child: childPayload,
        relationshipToCurrentPerson: relCurrent,
        relationshipToOtherParent: relOther,
        ...(birthOrder !== undefined ? { birthOrder } : {}),
      };
    }
    if (path === "new_person") {
      return {
        path: "new_person",
        newSecondParent: buildMiniIndividualEditorBody(miniPartner),
        child: childPayload,
        relationshipToCurrentPerson: relCurrent,
        relationshipToOtherParent: relOther,
        ...(birthOrder !== undefined ? { birthOrder } : {}),
      };
    }
    if (path === "existing_family") {
      const two = !!(familyRowForD?.husbandId && familyRowForD?.wifeId);
      return {
        path: "existing_family",
        familyId: pathD_familyId.trim(),
        child: childPayload,
        ...(two
          ? {
              relationshipToCurrentPerson: relCurrent,
              relationshipToOtherParent: relOther,
            }
          : { relationshipType: relSingle }),
        ...(birthOrder !== undefined ? { birthOrder } : {}),
      };
    }
    throw new Error("Incomplete wizard");
  }, [
    birthOrderStr,
    childMode,
    childExistingId,
    childMini,
    path,
    pathB_partnerId,
    relSingle,
    relCurrent,
    relOther,
    miniPartner,
    pathD_familyId,
    familyRowForD,
  ]);

  const submit = async () => {
    if (!subjectIndividualId.trim()) return;
    setBusy(true);
    try {
      await postJson<{ familyId: string; childId: string }>(
        `/api/admin/individuals/${subjectIndividualId}/add-child`,
        buildPayload(),
      );
      toast.success("Child added to family");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add child");
    } finally {
      setBusy(false);
    }
  };

  const reviewLines = useMemo(() => {
    const lines: string[] = [];
    if (path === "unknown_parent") lines.push("Other parent: unknown / not recorded yet");
    if (path === "existing_person") lines.push(`Other parent: ${pathB_partnerLabel || pathB_partnerId}`);
    if (path === "new_person") lines.push("Other parent: new person (saved with minimal fields)");
    if (path === "existing_family" && familyRowForD) {
      lines.push(`Family: ${spouseFamilyCardPartnerTitle(familyRowForD, subjectIndividualId, mode)}`);
    }
    if (childMode === "search") lines.push(`Child: existing record (${childExistingId.slice(0, 8)}…)`);
    else lines.push("Child: new person (minimal fields)");
    if (twoParentsInContext) {
      lines.push(`Relationship to you: ${relCurrent}`);
      lines.push(`Relationship to other parent: ${relOther}`);
    } else {
      lines.push(`Relationship: ${relSingle}`);
    }
    const bo = parseBirthOrder(birthOrderStr);
    if (bo !== undefined) lines.push(`Birth order: ${bo}`);
    return lines;
  }, [
    path,
    pathB_partnerLabel,
    pathB_partnerId,
    familyRowForD,
    subjectIndividualId,
    mode,
    childMode,
    childExistingId,
    twoParentsInContext,
    relCurrent,
    relOther,
    relSingle,
    birthOrderStr,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,880px)] max-w-2xl overflow-y-auto border-border bg-background p-0 shadow-lg">
        <div className="border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">Add child</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Children are linked through a family record. Choose the family context, then the child.
          </DialogDescription>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Step {step} of 3 —{" "}
            {step === 1 ? "Family context" : step === 2 ? "Child & relationships" : "Review"}
          </p>
        </div>

        <div className="space-y-6 px-6 py-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2 text-sm text-muted-foreground">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary/80" aria-hidden />
                <span>
                  Pick how the other parent is represented. You can leave the second parent blank and fill it in later
                  from the family editor.
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PathChoiceCard
                  selected={path === "unknown_parent"}
                  onSelect={() => setPath("unknown_parent")}
                  icon={Users}
                  title="No other parent / unknown"
                  description="Single-parent family for this person; add the other parent later if you discover them."
                  accentClass=""
                />
                <PathChoiceCard
                  selected={path === "existing_person"}
                  onSelect={() => setPath("existing_person")}
                  icon={UserPlus}
                  title="Choose existing person"
                  description="The second parent is already in the tree. We reuse an existing couple family when possible."
                  accentClass=""
                />
                <PathChoiceCard
                  selected={path === "new_person"}
                  onSelect={() => setPath("new_person")}
                  icon={UserPlus}
                  title="Create new person"
                  description="Quick minimal entry for the second parent, then the child."
                  accentClass=""
                />
                <PathChoiceCard
                  selected={path === "existing_family"}
                  onSelect={() => setPath("existing_family")}
                  icon={Link2}
                  title="Use existing family"
                  description="Pick from families where you already appear as a parent."
                  accentClass=""
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              {path === "existing_family" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Family</Label>
                  {!initialFamilyId ? (
                    <select
                      className={selectClassName}
                      value={pathD_familyId}
                      onChange={(e) => setPathD_familyId(e.target.value)}
                    >
                      <option value="">Select a family…</option>
                      {families.map((r) => (
                        <option key={r.familyId} value={r.familyId}>
                          {spouseFamilyCardPartnerTitle(r, subjectIndividualId, mode)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-foreground">
                      {familyRowForD
                        ? spouseFamilyCardPartnerTitle(familyRowForD, subjectIndividualId, mode)
                        : pathD_familyId}
                    </p>
                  )}
                  {families.length === 0 ? (
                    <p className="text-sm text-destructive">
                      No saved partner families yet. Go back and choose another path, or add a partner first.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {path === "existing_person" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Other parent (existing person)</Label>
                  {pathB_partnerId ? (
                    <p className="text-sm">
                      <span className="font-medium text-foreground">{pathB_partnerLabel || pathB_partnerId}</span>
                      <Button
                        type="button"
                        variant="link"
                        className="ml-2 h-auto p-0 text-xs"
                        onClick={() => {
                          setPathB_partnerId("");
                          setPathB_partnerLabel("");
                        }}
                      >
                        Change
                      </Button>
                    </p>
                  ) : (
                    <IndividualSearchPicker
                      idPrefix="wiz-par"
                      label=""
                      description=""
                      excludeIds={new Set(subjectIndividualId.trim() ? [subjectIndividualId.trim()] : [])}
                      onPick={(ind: AdminIndividualListItem) => {
                        setPathB_partnerId(ind.id);
                        setPathB_partnerLabel(ind.fullName?.trim() || ind.xref || ind.id);
                      }}
                      allowEmptySearch
                      limit={20}
                    />
                  )}
                </div>
              ) : null}

              {path === "new_person" ? (
                <div className="space-y-3 rounded-xl border border-base-content/10 bg-base-content/[0.02] p-4">
                  <p className="text-sm font-medium text-foreground">New other parent</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-np-given">Given names</Label>
                      <Input
                        id="wiz-np-given"
                        value={miniPartner.givenNamesLine}
                        onChange={(e) => setMiniPartner((p) => ({ ...p, givenNamesLine: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-np-sur">Surname</Label>
                      <Input
                        id="wiz-np-sur"
                        value={miniPartner.surnameLine}
                        onChange={(e) => setMiniPartner((p) => ({ ...p, surnameLine: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-np-sex">Sex</Label>
                      <select
                        id="wiz-np-sex"
                        className={selectClassName}
                        value={miniPartner.sex}
                        onChange={(e) => setMiniPartner((p) => ({ ...p, sex: e.target.value }))}
                      >
                        <option value="">Unknown</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="U">Unknown (U)</option>
                        <option value="X">Other (X)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Child</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={childMode === "search" ? "secondary" : "outline"}
                    onClick={() => setChildMode("search")}
                  >
                    Search existing person
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={childMode === "create" ? "secondary" : "outline"}
                    onClick={() => setChildMode("create")}
                  >
                    Create new child
                  </Button>
                </div>
                {childMode === "search" ? (
                  childExistingId.trim() ? (
                    <p className="text-sm">
                      Selected child id <span className="font-mono text-xs">{childExistingId.slice(0, 36)}</span>
                      <Button
                        type="button"
                        variant="link"
                        className="ml-2 h-auto p-0 text-xs"
                        onClick={() => setChildExistingId("")}
                      >
                        Clear
                      </Button>
                    </p>
                  ) : (
                    <IndividualSearchPicker
                      idPrefix="wiz-child"
                      label=""
                      description=""
                      excludeIds={childExcludeIds}
                      onPick={(ind: AdminIndividualListItem) => setChildExistingId(ind.id)}
                      allowEmptySearch
                      limit={20}
                    />
                  )
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-ch-given">Given names</Label>
                      <Input
                        id="wiz-ch-given"
                        value={childMini.givenNamesLine}
                        onChange={(e) => setChildMini((p) => ({ ...p, givenNamesLine: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-ch-sur">Surname</Label>
                      <Input
                        id="wiz-ch-sur"
                        value={childMini.surnameLine}
                        onChange={(e) => setChildMini((p) => ({ ...p, surnameLine: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wiz-ch-sex">Sex (optional)</Label>
                      <select
                        id="wiz-ch-sex"
                        className={selectClassName}
                        value={childMini.sex}
                        onChange={(e) => setChildMini((p) => ({ ...p, sex: e.target.value }))}
                      >
                        <option value="">Unknown</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="U">Unknown (U)</option>
                        <option value="X">Other (X)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <KeyFactSection
                        title="Birth (optional)"
                        fact={childMini.birth}
                        onChange={(n) => setChildMini((p) => ({ ...p, birth: n }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {twoParentsInContext ? (
                  <>
                    <div className="space-y-2">
                      <Label>Relationship to you</Label>
                      <select
                        className={selectClassName}
                        value={relCurrent}
                        onChange={(e) => setRelCurrent(e.target.value)}
                      >
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship to other parent</Label>
                      <select
                        className={selectClassName}
                        value={relOther}
                        onChange={(e) => setRelOther(e.target.value)}
                      >
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={`o-${o.value}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Relationship to recorded parent(s)</Label>
                    <select
                      className={selectClassName}
                      value={relSingle}
                      onChange={(e) => setRelSingle(e.target.value)}
                    >
                      {RELATIONSHIP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="wiz-bo">Birth order (optional)</Label>
                  <Input
                    id="wiz-bo"
                    inputMode="numeric"
                    value={birthOrderStr}
                    onChange={(e) => setBirthOrderStr(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 rounded-xl border border-base-content/10 bg-base-content/[0.02] p-4">
              <p className="text-sm font-medium text-foreground">Review and confirm</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {reviewLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <DialogClose disabled={busy} className={cn(buttonVariants({ variant: "ghost" }))}>
              Cancel
            </DialogClose>
            <div className="flex flex-wrap gap-2">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="gap-1"
                  onClick={() => {
                    if (step === 2 && familyContextLocked) {
                      onOpenChange(false);
                      return;
                    }
                    setStep((s) => Math.max(1, s - 1));
                  }}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </Button>
              ) : null}
              {step < 3 ? (
                <Button
                  type="button"
                  variant="default"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={
                    busy ||
                    (step === 1 && !path) ||
                    (step === 2 && !canAdvanceFromStep2)
                  }
                  onClick={() => {
                    if (step === 1 && path) setStep(2);
                    else if (step === 2 && canAdvanceFromStep2) setStep(3);
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? "Saving…" : "Add child"}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
