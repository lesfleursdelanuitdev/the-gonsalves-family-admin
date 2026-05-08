"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Building2, Check, ChevronLeft, HelpCircle, UserPlus, Users } from "lucide-react";
import { ChildParentsFamilySearch } from "@/components/admin/individual-editor/ChildParentsFamilySearch";
import {
  NEW_PARENT_SEX_OPTIONS,
  PEDIGREE_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/components/admin/individual-editor/individual-editor-family-constants";
import type { ChildFamilyParentPickLabels } from "@/components/admin/individual-editor/individual-family-search-types";
import {
  createChildFamilySearchSlot,
  type ChildFamilySearchSlot,
} from "@/components/admin/individual-editor/individual-family-editor-slots";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import type { ChildFamilyFormRow } from "@/lib/forms/individual-editor-form";
import { newEmptyChildFamilyFormRow } from "@/lib/forms/individual-editor-form";
import { cn } from "@/lib/utils";

export type ParentsWizardPath = "no_second" | "existing_people" | "create_new" | "existing_family";

export type AddParentsWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  individualId: string;
  /** Display name for review copy (optional). */
  subjectDisplayName?: string;
  excludedChildSpouseFamilyIds: ReadonlySet<string>;
  enrichChildFamilyPick: (
    familyId: string,
    labels: ChildFamilyParentPickLabels,
  ) => Promise<{ mergedLabels: ChildFamilyParentPickLabels; children: import("@/lib/forms/individual-editor-form").ChildInFamilySummary[] | undefined }>;
  mergeFamiliesAsChild: (fn: (prev: ChildFamilyFormRow[]) => ChildFamilyFormRow[]) => void;
};

function PathChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-success bg-success/10 ring-1 ring-success/35"
          : "border-base-content/10 bg-base-content/[0.02] hover:border-base-content/20",
      )}
    >
      <span className="inline-flex items-center gap-2 font-semibold text-base-content">
        <Icon className="size-5 shrink-0 opacity-90" aria-hidden />
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function relationshipLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function pedigreeLabel(value: string): string {
  if (!value.trim()) return "—";
  return PEDIGREE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function familyTitleFromLabels(h: string, w: string): string {
  const a = h.trim() || "Unknown";
  const b = w.trim() || "Unknown";
  return `Family with ${a} and ${b}`;
}

export function AddParentsWizardDialog({
  open,
  onOpenChange,
  individualId,
  subjectDisplayName,
  excludedChildSpouseFamilyIds,
  enrichChildFamilyPick,
  mergeFamiliesAsChild,
}: AddParentsWizardDialogProps) {
  const excludeSelf = useMemo(() => new Set(individualId.trim() ? [individualId.trim()] : []), [individualId]);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [path, setPath] = useState<ParentsWizardPath | "">("");

  /** Path no_second */
  const [singleMode, setSingleMode] = useState<"search" | "create">("search");
  const [singleParentId, setSingleParentId] = useState("");
  const [singleParentLabel, setSingleParentLabel] = useState("");
  const [singleGiven, setSingleGiven] = useState("");
  const [singleSurname, setSingleSurname] = useState("");
  const [singleSex, setSingleSex] = useState("");

  /** Path existing_people */
  const [p1Id, setP1Id] = useState("");
  const [p1Label, setP1Label] = useState("");
  const [p2Id, setP2Id] = useState("");
  const [p2Label, setP2Label] = useState("");

  /** Path create_new */
  const [addSecond, setAddSecond] = useState(false);
  const [c1Given, setC1Given] = useState("");
  const [c1Surname, setC1Surname] = useState("");
  const [c1Sex, setC1Sex] = useState("");
  const [c2Given, setC2Given] = useState("");
  const [c2Surname, setC2Surname] = useState("");
  const [c2Sex, setC2Sex] = useState("");

  /** Path existing_family */
  const [famSlot, setFamSlot] = useState<ChildFamilySearchSlot>(() => createChildFamilySearchSlot());
  const [pickedFamily, setPickedFamily] = useState<{
    familyId: string;
    labels: ChildFamilyParentPickLabels;
    children: import("@/lib/forms/individual-editor-form").ChildInFamilySummary[] | undefined;
  } | null>(null);

  /** Shared step-2 relationship fields (per path) */
  const [rel1, setRel1] = useState("biological");
  const [ped1, setPed1] = useState("");
  const [rel2, setRel2] = useState("biological");
  const [ped2, setPed2] = useState("");
  const [birthOrderStr, setBirthOrderStr] = useState("");

  const reset = useCallback(() => {
    setStep(1);
    setPath("");
    setSingleMode("search");
    setSingleParentId("");
    setSingleParentLabel("");
    setSingleGiven("");
    setSingleSurname("");
    setSingleSex("");
    setP1Id("");
    setP1Label("");
    setP2Id("");
    setP2Label("");
    setAddSecond(false);
    setC1Given("");
    setC1Surname("");
    setC1Sex("");
    setC2Given("");
    setC2Surname("");
    setC2Sex("");
    setFamSlot(createChildFamilySearchSlot());
    setPickedFamily(null);
    setRel1("biological");
    setPed1("");
    setRel2("biological");
    setPed2("");
    setBirthOrderStr("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const canStep2 = useMemo(() => {
    if (!path) return false;
    if (path === "no_second") {
      if (singleMode === "search") return !!singleParentId.trim();
      const g = singleGiven.trim().split(/\s+/).filter(Boolean);
      return g.length > 0 && !!singleSurname.trim() && !!singleSex.trim();
    }
    if (path === "existing_people") return !!p1Id.trim();
    if (path === "create_new") {
      const g1 = c1Given.trim().split(/\s+/).filter(Boolean);
      return g1.length > 0 && !!c1Surname.trim() && !!c1Sex.trim() && (!addSecond || (c2Given.trim() && c2Surname.trim() && c2Sex.trim()));
    }
    if (path === "existing_family") return !!pickedFamily?.familyId.trim();
    return false;
  }, [
    path,
    singleMode,
    singleParentId,
    singleGiven,
    singleSurname,
    singleSex,
    p1Id,
    c1Given,
    c1Surname,
    c1Sex,
    addSecond,
    c2Given,
    c2Surname,
    c2Sex,
    pickedFamily,
  ]);

  const reviewLines = useMemo(() => {
    const who = subjectDisplayName?.trim() || "This person";
    if (path === "no_second" && singleMode === "search") {
      return {
        title: `${who} will be added as a child with one known parent`,
        family: singleParentLabel || "Selected parent",
        p1: singleParentLabel,
        p2: null as string | null,
      };
    }
    if (path === "no_second" && singleMode === "create") {
      return {
        title: `${who} will be added as a child with one new parent`,
        family: `${singleGiven.trim()} ${singleSurname.trim()}`.trim(),
        p1: `${singleGiven.trim()} ${singleSurname.trim()}`.trim(),
        p2: null,
      };
    }
    if (path === "existing_people") {
      const fam = familyTitleFromLabels(p1Label, p2Label || "Unknown");
      return { title: `${who} will be added as a child in:`, family: fam, p1: p1Label, p2: p2Label.trim() || null };
    }
    if (path === "create_new") {
      const n1 = `${c1Given.trim()} ${c1Surname.trim()}`.trim();
      const n2 = addSecond ? `${c2Given.trim()} ${c2Surname.trim()}`.trim() : null;
      return {
        title: `${who} will be added as a child in:`,
        family: familyTitleFromLabels(n1, n2 ?? "Unknown"),
        p1: n1,
        p2: n2,
      };
    }
    if (path === "existing_family" && pickedFamily) {
      const h = pickedFamily.labels.husband?.trim() || "—";
      const w = pickedFamily.labels.wife?.trim() || "—";
      const hasH = !!pickedFamily.labels.husbandId;
      const hasW = !!pickedFamily.labels.wifeId;
      return {
        title: `${who} will be added as a child in:`,
        family: familyTitleFromLabels(hasH ? h : "Unknown", hasW ? w : "Unknown"),
        p1: hasH ? h : w,
        p2: hasH && hasW ? w : null,
      };
    }
    return { title: "", family: "", p1: "", p2: null as string | null };
  }, [
    path,
    singleMode,
    singleParentLabel,
    singleGiven,
    singleSurname,
    p1Label,
    p2Label,
    c1Given,
    c1Surname,
    c2Given,
    c2Surname,
    addSecond,
    pickedFamily,
    subjectDisplayName,
  ]);

  const commitToForm = useCallback(() => {
    const birthOrder = birthOrderStr.trim();
    if (path === "no_second" && singleMode === "search") {
      mergeFamiliesAsChild((rows) => [
        ...rows,
        {
          ...newEmptyChildFamilyFormRow(),
          birthOrder,
          pendingExistingParentsLink: {
            parent1IndividualId: singleParentId.trim(),
            parent1Label: singleParentLabel.trim(),
            relationshipToParent1: rel1,
            relationshipToParent2: rel1,
            pedigreeToParent1: ped1,
            pedigreeToParent2: ped2 || ped1,
          },
        },
      ]);
      return;
    }
    if (path === "no_second" && singleMode === "create") {
      mergeFamiliesAsChild((rows) => [
        ...rows,
        {
          ...newEmptyChildFamilyFormRow(),
          birthOrder,
          pendingNewParents: {
            mode: "single",
            parent: {
              givenNames: singleGiven,
              surname: singleSurname,
              sex: singleSex,
              relationshipType: rel1,
              pedigree: ped1,
            },
          },
        },
      ]);
      return;
    }
    if (path === "existing_people") {
      mergeFamiliesAsChild((rows) => [
        ...rows,
        {
          ...newEmptyChildFamilyFormRow(),
          birthOrder,
          pendingExistingParentsLink: {
            parent1IndividualId: p1Id.trim(),
            parent2IndividualId: p2Id.trim() || undefined,
            parent1Label: p1Label.trim(),
            parent2Label: p2Label.trim() || undefined,
            relationshipToParent1: rel1,
            relationshipToParent2: p2Id.trim() ? rel2 : rel1,
            pedigreeToParent1: ped1,
            pedigreeToParent2: p2Id.trim() ? ped2 : ped1,
          },
        },
      ]);
      return;
    }
    if (path === "create_new") {
      if (!addSecond) {
        mergeFamiliesAsChild((rows) => [
          ...rows,
          {
            ...newEmptyChildFamilyFormRow(),
            birthOrder,
            pendingNewParents: {
              mode: "single",
              parent: {
                givenNames: c1Given,
                surname: c1Surname,
                sex: c1Sex,
                relationshipType: rel1,
                pedigree: ped1,
              },
            },
          },
        ]);
        return;
      }
      mergeFamiliesAsChild((rows) => [
        ...rows,
        {
          ...newEmptyChildFamilyFormRow(),
          birthOrder,
          pendingNewParents: {
            mode: "pair",
            parent1: {
              givenNames: c1Given,
              surname: c1Surname,
              sex: c1Sex,
              relationshipType: rel1,
              pedigree: ped1,
            },
            parent2: {
              givenNames: c2Given,
              surname: c2Surname,
              sex: c2Sex,
              relationshipType: rel2,
              pedigree: ped2,
            },
          },
        },
      ]);
      return;
    }
    if (path === "existing_family" && pickedFamily) {
      const { familyId, labels, children } = pickedFamily;
      mergeFamiliesAsChild((rows) => [
        ...rows,
        {
          ...newEmptyChildFamilyFormRow(),
          familyId,
          relationshipType: rel1,
          pedigree: ped1 || ped2,
          relationshipToHusband: labels.husbandId ? rel1 : "biological",
          relationshipToWife: labels.wifeId ? (labels.husbandId ? rel2 : rel1) : "biological",
          pedigreeToHusband: labels.husbandId ? ped1 : "",
          pedigreeToWife: labels.wifeId ? (labels.husbandId ? ped2 : ped1) : "",
          birthOrder,
          parentHusbandDisplay: labels.husband,
          parentWifeDisplay: labels.wife,
          ...(labels.husbandSex ? { parentHusbandSex: labels.husbandSex } : {}),
          ...(labels.wifeSex ? { parentWifeSex: labels.wifeSex } : {}),
          ...(labels.husbandId ? { parentHusbandId: labels.husbandId } : {}),
          ...(labels.wifeId ? { parentWifeId: labels.wifeId } : {}),
          childrenInFamily: children,
        },
      ]);
    }
  }, [
    path,
    singleMode,
    singleParentId,
    singleParentLabel,
    singleGiven,
    singleSurname,
    singleSex,
    p1Id,
    p1Label,
    p2Id,
    p2Label,
    addSecond,
    c1Given,
    c1Surname,
    c1Sex,
    c2Given,
    c2Surname,
    c2Sex,
    pickedFamily,
    rel1,
    rel2,
    ped1,
    ped2,
    birthOrderStr,
    mergeFamiliesAsChild,
  ]);

  const onConfirmAdd = useCallback(() => {
    commitToForm();
    setStep(4);
  }, [commitToForm]);

  const stepTitle =
    step === 1
      ? "How would you like to add parents?"
      : step === 2
        ? "Details"
        : step === 3
          ? "Review and confirm"
          : "Parents added";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto border-base-content/10 bg-base-200 p-0 sm:max-w-xl">
        <div className="border-b border-base-content/10 px-5 py-4">
          <div className="flex items-center gap-2">
            {step > 1 && step < 4 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 px-2"
                onClick={() => setStep((s) => (s === 2 ? 1 : s === 3 ? 2 : s))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold text-base-content">{stepTitle}</DialogTitle>
              {step < 4 ? (
                <DialogDescription className="text-sm text-muted-foreground">
                  Step {Math.min(step, 3)} of 3 · Parent–child links can differ for each parent.
                </DialogDescription>
              ) : (
                <DialogDescription className="text-sm text-muted-foreground">
                  The parent family will be created or updated when you save this person.
                </DialogDescription>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PathChoiceCard
                selected={path === "no_second"}
                onSelect={() => setPath("no_second")}
                icon={UserPlus}
                title="No second parent / unknown"
                description="One known parent; the other is unknown or not recorded yet."
              />
              <PathChoiceCard
                selected={path === "existing_people"}
                onSelect={() => setPath("existing_people")}
                icon={Users}
                title="Choose existing people"
                description="Pick one or two people already in the tree."
              />
              <PathChoiceCard
                selected={path === "create_new"}
                onSelect={() => setPath("create_new")}
                icon={UserPlus}
                title="Create new parents"
                description="Quick minimal records for one or both parents."
              />
              <PathChoiceCard
                selected={path === "existing_family"}
                onSelect={() => setPath("existing_family")}
                icon={Building2}
                title="Use existing family"
                description="Attach as a child of a family that is already in the tree."
              />
            </div>
          ) : null}

          {step === 2 && path === "no_second" ? (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-lg border border-base-content/10 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={singleMode === "search" ? "default" : "ghost"}
                  className={cn("flex-1", singleMode === "search" && "btn-success text-success-content")}
                  onClick={() => setSingleMode("search")}
                >
                  Search existing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={singleMode === "create" ? "default" : "ghost"}
                  className={cn("flex-1", singleMode === "create" && "btn-success text-success-content")}
                  onClick={() => setSingleMode("create")}
                >
                  Create new parent
                </Button>
              </div>
              {singleMode === "search" ? (
                <IndividualSearchPicker
                  label="Known parent"
                  description="Search by name; the other parent stays unknown until you add them later."
                  excludeIds={excludeSelf}
                  onPick={(ind: AdminIndividualListItem) => {
                    setSingleParentId(ind.id);
                    setSingleParentLabel(individualSearchDisplayName(ind));
                  }}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Given names</Label>
                    <Input value={singleGiven} onChange={(e) => setSingleGiven(e.target.value)} placeholder="e.g. Maria" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last name</Label>
                    <Input value={singleSurname} onChange={(e) => setSingleSurname(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sex</Label>
                    <select className={selectClassName} value={singleSex} onChange={(e) => setSingleSex(e.target.value)}>
                      {NEW_PARENT_SEX_OPTIONS.map((o) => (
                        <option key={o.value || "__u"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Relationship to child</Label>
                <select className={selectClassName} value={rel1} onChange={(e) => setRel1(e.target.value)}>
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pedigree</Label>
                <select className={selectClassName} value={ped1} onChange={(e) => setPed1(e.target.value)}>
                  {PEDIGREE_OPTIONS.map((o) => (
                    <option key={o.value || "__p"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Birth order (optional)</Label>
                <Input value={birthOrderStr} onChange={(e) => setBirthOrderStr(e.target.value)} inputMode="numeric" placeholder="e.g. 1" />
              </div>
            </div>
          ) : null}

          {step === 2 && path === "existing_people" ? (
            <div className="space-y-4">
              <IndividualSearchPicker
                label="Parent 1"
                excludeIds={excludeSelf}
                onPick={(ind: AdminIndividualListItem) => {
                  setP1Id(ind.id);
                  setP1Label(individualSearchDisplayName(ind));
                }}
              />
              <IndividualSearchPicker
                label="Parent 2 (optional)"
                excludeIds={new Set([...excludeSelf, p1Id.trim()].filter(Boolean))}
                isPickDisabled={(ind) => ind.id === p1Id}
                onPick={(ind: AdminIndividualListItem) => {
                  setP2Id(ind.id);
                  setP2Label(individualSearchDisplayName(ind));
                }}
              />
              <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                <p className="mb-2 text-xs font-medium text-base-content">To {p1Label || "Parent 1"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Relationship to child</Label>
                    <select className={selectClassName} value={rel1} onChange={(e) => setRel1(e.target.value)}>
                      {RELATIONSHIP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pedigree</Label>
                    <select className={selectClassName} value={ped1} onChange={(e) => setPed1(e.target.value)}>
                      {PEDIGREE_OPTIONS.map((o) => (
                        <option key={o.value || "__p"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {p2Id.trim() ? (
                <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                  <p className="mb-2 text-xs font-medium text-base-content">To {p2Label || "Parent 2"}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Relationship to child</Label>
                      <select className={selectClassName} value={rel2} onChange={(e) => setRel2(e.target.value)}>
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pedigree</Label>
                      <select className={selectClassName} value={ped2} onChange={(e) => setPed2(e.target.value)}>
                        {PEDIGREE_OPTIONS.map((o) => (
                          <option key={o.value || "__q"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">Birth order (optional)</Label>
                <Input value={birthOrderStr} onChange={(e) => setBirthOrderStr(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          ) : null}

          {step === 2 && path === "create_new" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-base-content/10 p-3">
                <p className="mb-2 text-xs font-semibold text-base-content">Parent 1</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Given names</Label>
                    <Input value={c1Given} onChange={(e) => setC1Given(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last name</Label>
                    <Input value={c1Surname} onChange={(e) => setC1Surname(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sex</Label>
                    <select className={selectClassName} value={c1Sex} onChange={(e) => setC1Sex(e.target.value)}>
                      {NEW_PARENT_SEX_OPTIONS.map((o) => (
                        <option key={o.value || "__u"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm checkbox-success" checked={addSecond} onChange={(e) => setAddSecond(e.target.checked)} />
                Add second parent
              </label>
              {addSecond ? (
                <div className="rounded-lg border border-base-content/10 p-3">
                  <p className="mb-2 text-xs font-semibold text-base-content">Parent 2</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Given names</Label>
                      <Input value={c2Given} onChange={(e) => setC2Given(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last name</Label>
                      <Input value={c2Surname} onChange={(e) => setC2Surname(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sex</Label>
                      <select className={selectClassName} value={c2Sex} onChange={(e) => setC2Sex(e.target.value)}>
                        {NEW_PARENT_SEX_OPTIONS.map((o) => (
                          <option key={o.value || "__v"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                <p className="mb-2 text-xs font-medium text-base-content">To Parent 1</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Relationship to child</Label>
                    <select className={selectClassName} value={rel1} onChange={(e) => setRel1(e.target.value)}>
                      {RELATIONSHIP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pedigree</Label>
                    <select className={selectClassName} value={ped1} onChange={(e) => setPed1(e.target.value)}>
                      {PEDIGREE_OPTIONS.map((o) => (
                        <option key={o.value || "__p"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {addSecond ? (
                <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                  <p className="mb-2 text-xs font-medium text-base-content">To Parent 2</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Relationship to child</Label>
                      <select className={selectClassName} value={rel2} onChange={(e) => setRel2(e.target.value)}>
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pedigree</Label>
                      <select className={selectClassName} value={ped2} onChange={(e) => setPed2(e.target.value)}>
                        {PEDIGREE_OPTIONS.map((o) => (
                          <option key={o.value || "__q"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">Birth order (optional)</Label>
                <Input value={birthOrderStr} onChange={(e) => setBirthOrderStr(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          ) : null}

          {step === 2 && path === "existing_family" ? (
            <div className="space-y-4">
              {!pickedFamily ? (
                <ChildParentsFamilySearch
                  inputIdPrefix={`add-parents-wiz-${famSlot.id}`}
                  p1Given={famSlot.p1Given}
                  p1Last={famSlot.p1Last}
                  p2Given={famSlot.p2Given}
                  p2Last={famSlot.p2Last}
                  setP1Given={(v) =>
                    setFamSlot((s) => ({ ...s, p1Given: typeof v === "function" ? v(s.p1Given) : v }))
                  }
                  setP1Last={(v) => setFamSlot((s) => ({ ...s, p1Last: typeof v === "function" ? v(s.p1Last) : v }))}
                  setP2Given={(v) =>
                    setFamSlot((s) => ({ ...s, p2Given: typeof v === "function" ? v(s.p2Given) : v }))
                  }
                  setP2Last={(v) => setFamSlot((s) => ({ ...s, p2Last: typeof v === "function" ? v(s.p2Last) : v }))}
                  excludedFamilyIds={excludedChildSpouseFamilyIds}
                  onPick={async (familyId, labels) => {
                    const { mergedLabels, children } = await enrichChildFamilyPick(familyId, labels);
                    setPickedFamily({ familyId, labels: mergedLabels, children });
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-base-content">Selected family</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPickedFamily(null)}>
                      Change family
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{familyTitleFromLabels(pickedFamily.labels.husband, pickedFamily.labels.wife)}</p>
                  {pickedFamily.labels.husbandId ? (
                    <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                      <p className="mb-2 text-xs font-medium text-base-content">To {pickedFamily.labels.husband || "Parent 1"}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Relationship to child</Label>
                          <select className={selectClassName} value={rel1} onChange={(e) => setRel1(e.target.value)}>
                            {RELATIONSHIP_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Pedigree</Label>
                          <select className={selectClassName} value={ped1} onChange={(e) => setPed1(e.target.value)}>
                            {PEDIGREE_OPTIONS.map((o) => (
                              <option key={o.value || "__p"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {pickedFamily.labels.wifeId ? (
                    <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                      <p className="mb-2 text-xs font-medium text-base-content">To {pickedFamily.labels.wife || "Parent 2"}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Relationship to child</Label>
                          <select className={selectClassName} value={rel2} onChange={(e) => setRel2(e.target.value)}>
                            {RELATIONSHIP_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Pedigree</Label>
                          <select className={selectClassName} value={ped2} onChange={(e) => setPed2(e.target.value)}>
                            {PEDIGREE_OPTIONS.map((o) => (
                              <option key={o.value || "__q"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <Label className="text-xs">Birth order (optional)</Label>
                    <Input value={birthOrderStr} onChange={(e) => setBirthOrderStr(e.target.value)} inputMode="numeric" />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-base-content">{reviewLines.title}</p>
              <div className="rounded-lg border border-base-content/10 bg-base-content/[0.03] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family</p>
                <p className="mt-1 text-base-content">{reviewLines.family}</p>
              </div>
              <div className="rounded-lg border border-base-content/10 p-3">
                <p className="text-xs text-muted-foreground">Parent 1</p>
                <p className="font-medium text-base-content">{reviewLines.p1}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Relationship: {relationshipLabel(rel1)} · Pedigree: {pedigreeLabel(ped1)}
                </p>
              </div>
              {reviewLines.p2 ? (
                <div className="rounded-lg border border-base-content/10 p-3">
                  <p className="text-xs text-muted-foreground">Parent 2</p>
                  <p className="font-medium text-base-content">{reviewLines.p2}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Relationship: {relationshipLabel(rel2)} · Pedigree: {pedigreeLabel(ped2)}
                  </p>
                </div>
              ) : null}
              {birthOrderStr.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Birth order: <span className="font-medium text-base-content">{birthOrderStr.trim()}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success/20 text-success">
                <Check className="size-8" strokeWidth={2.5} aria-hidden />
              </span>
              <p className="text-lg font-semibold text-base-content">Parents added</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                This parent link is queued on the form. Use <span className="font-medium text-base-content">Save person</span> at the bottom
                to write it to the tree.
              </p>
            </div>
          ) : null}

          {step === 2 || step === 1 ? (
            <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-base-content/90 dark:bg-primary/10">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                <span className="font-medium">How it works:</span> relationship and pedigree are stored per parent, so one parent can be
                biological and another adoptive.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-base-content/10 px-5 py-4">
          {step === 1 ? (
            <Button type="button" className="btn-success text-success-content" disabled={!path} onClick={() => setStep(2)}>
              Next
            </Button>
          ) : null}
          {step === 2 ? (
            <Button type="button" className="btn-success text-success-content" disabled={!canStep2} onClick={() => setStep(3)}>
              Next
            </Button>
          ) : null}
          {step === 3 ? (
            <Button type="button" className="btn-success text-success-content" onClick={onConfirmAdd}>
              Add parents
            </Button>
          ) : null}
          {step === 4 ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  onOpenChange(false);
                  const el = document.getElementById("person-relationships");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View in Relationships
              </Button>
              <Button type="button" className="btn-success text-success-content w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
