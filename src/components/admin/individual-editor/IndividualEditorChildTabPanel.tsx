"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { MoreHorizontal, Star } from "lucide-react";
import { AddParentsWizardDialog } from "@/components/admin/individual-editor/AddParentsWizardDialog";
import { ChildParentsFamilySearch } from "@/components/admin/individual-editor/ChildParentsFamilySearch";
import { ParentSexIcon } from "@/components/admin/individual-editor/ParentSexIcon";
import {
  NEW_PARENT_SEX_OPTIONS,
  PEDIGREE_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/components/admin/individual-editor/individual-editor-family-constants";
import {
  createChildFamilySearchSlot,
  type ChildFamilySearchSlot,
} from "@/components/admin/individual-editor/individual-family-editor-slots";
import type { ChildFamilyParentPickLabels } from "@/components/admin/individual-editor/individual-family-search-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import type { ChildFamilyFormRow, ChildInFamilySummary } from "@/lib/forms/individual-editor-form";
import { cn } from "@/lib/utils";

function relationshipUiLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function parentFamilyCardTitle(husbandLabel: string, wifeLabel: string): string {
  const a = husbandLabel.trim() || "Unknown";
  const b = wifeLabel.trim() || "Unknown";
  return `Family with ${a} and ${b}`;
}

export type IndividualEditorChildTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  individualId: string;
  familiesAsChild: ChildFamilyFormRow[];
  hasPendingNewParentsChild: boolean;
  updateChildRow: (index: number, patch: Partial<ChildFamilyFormRow>) => void;
  removeChildRow: (index: number) => void;
  addChildRow: (
    familyId: string,
    parentLabels: ChildFamilyParentPickLabels,
    childrenInFamily?: ChildInFamilySummary[],
  ) => void;
  enrichChildFamilyPick: (
    familyId: string,
    labels: ChildFamilyParentPickLabels,
  ) => Promise<{ mergedLabels: ChildFamilyParentPickLabels; children: ChildInFamilySummary[] | undefined }>;
  childFamilySearchSlots: ChildFamilySearchSlot[];
  setChildFamilySearchSlots: Dispatch<SetStateAction<ChildFamilySearchSlot[]>>;
  excludedChildSpouseFamilyIds: ReadonlySet<string>;
  spouseLinkOptionsForNewParent: { familyId: string; parentIndividualId: string; label: string }[];
  mergeFamiliesAsChild: (fn: (prev: ChildFamilyFormRow[]) => ChildFamilyFormRow[]) => void;
  /** Shown in the add-parents wizard review step. */
  subjectDisplayName?: string;
};

export function IndividualEditorChildTabPanel({
  hidden,
  mode,
  individualId,
  familiesAsChild,
  hasPendingNewParentsChild,
  updateChildRow,
  removeChildRow,
  addChildRow,
  enrichChildFamilyPick,
  childFamilySearchSlots,
  setChildFamilySearchSlots,
  excludedChildSpouseFamilyIds,
  spouseLinkOptionsForNewParent,
  mergeFamiliesAsChild,
  subjectDisplayName,
}: IndividualEditorChildTabPanelProps) {
  const router = useRouter();
  const [parentsWizardOpen, setParentsWizardOpen] = useState(false);

  return (
    <div role="region" aria-label="Parents" hidden={hidden} className="space-y-8 pt-2">
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Parents</CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect this person to their parents. You can search for an existing family or create new parent records.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {FAMILY_PARTNER_SLOT_SUBTITLE} Relationship and pedigree are set per parent. Use <span className="font-medium text-base-content">+ Add parents</span> for a guided flow, or search by name below.
          </p>
          {familiesAsChild.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-4">
                {familiesAsChild.map((row, i) => {
                  if (row.pendingExistingParentsLink) {
                    const L = row.pendingExistingParentsLink;
                    return (
                      <li
                        key={`child-pending-existing-${i}`}
                        className="space-y-3 rounded-xl border border-dashed border-success/30 bg-success/5 p-4 dark:bg-success/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-base-content">New parent link (saved with the person)</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {L.parent1Label}
                              {L.parent2Label ? ` · ${L.parent2Label}` : ""}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeChildRow(i)}>
                            Remove
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Relationship: {relationshipUiLabel(L.relationshipToParent1)}
                          {L.parent2IndividualId ? ` / ${relationshipUiLabel(L.relationshipToParent2)}` : ""}
                        </p>
                      </li>
                    );
                  }
                  if (row.pendingNewParents) {
                    const d = row.pendingNewParents;
                    return (
                      <li
                        key={`child-draft-parents-${i}`}
                        className="space-y-4 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-base-content">
                            New parents &amp; family (created when you save)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.mode === "single" && d.linkAsSpouse ? (
                              <>
                                The new parent is created and linked as the spouse of {d.linkAsSpouse.existingParentLabel}
                                . If that family had an empty partner slot, it is filled; if both partners were already
                                present, a new couple family is created and you are linked as a child there too.
                              </>
                            ) : d.mode === "single" ? (
                              <>
                                One new person and a family record are created with a single parent in Partner 1 or
                                Partner 2 (from sex, same rules as elsewhere). You can add the other parent later from
                                the family page, or use the optional spouse link below. Given names are split on spaces.
                              </>
                            ) : (
                              <>
                                Two new people and a family are created; this person is linked as their child. Partner
                                slots follow the same rules as elsewhere (for example, when one parent is recorded as
                                male and the other as female, they are placed in Partner 1 and Partner 2 consistently).
                                Given names are split on spaces.
                              </>
                            )}
                          </p>
                        </div>
                        {(d.mode === "single"
                          ? ([{ key: "single" as const, label: "New parent", p: d.parent }] as const)
                          : ([
                              { key: "parent1" as const, label: "Parent 1", p: d.parent1 },
                              { key: "parent2" as const, label: "Parent 2", p: d.parent2 },
                            ] as const)
                        ).map(({ key, label, p }) => (
                          <div
                            key={key}
                            className="space-y-3 rounded-md border border-base-content/10 bg-base-100/80 p-3"
                          >
                            <p className="text-xs font-medium text-base-content">{label}</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2 sm:col-span-2">
                                <Label className="text-xs">Given names</Label>
                                <Input
                                  value={p.givenNames}
                                  onChange={(e) =>
                                    updateChildRow(i, {
                                      pendingNewParents:
                                        d.mode === "single"
                                          ? { ...d, parent: { ...d.parent, givenNames: e.target.value } }
                                          : {
                                              ...d,
                                              [key]: { ...p, givenNames: e.target.value },
                                            },
                                    })
                                  }
                                  placeholder="e.g. Maria Jose"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Last name</Label>
                                <Input
                                  value={p.surname}
                                  onChange={(e) =>
                                    updateChildRow(i, {
                                      pendingNewParents:
                                        d.mode === "single"
                                          ? { ...d, parent: { ...d.parent, surname: e.target.value } }
                                          : {
                                              ...d,
                                              [key]: { ...p, surname: e.target.value },
                                            },
                                    })
                                  }
                                  placeholder="e.g. Gonsalves"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Sex (affects {FAMILY_PARTNER_1_LABEL} / {FAMILY_PARTNER_2_LABEL} when adding new
                                  parents)
                                </Label>
                                <select
                                  className={selectClassName}
                                  value={p.sex}
                                  onChange={(e) =>
                                    updateChildRow(i, {
                                      pendingNewParents:
                                        d.mode === "single"
                                          ? { ...d, parent: { ...d.parent, sex: e.target.value } }
                                          : {
                                              ...d,
                                              [key]: { ...p, sex: e.target.value },
                                            },
                                    })
                                  }
                                >
                                  {NEW_PARENT_SEX_OPTIONS.map((o) => (
                                    <option key={o.value === "" ? "__unset" : o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2 sm:col-span-2">
                                <Label className="text-xs">Relationship to this parent</Label>
                                <select
                                  className={selectClassName}
                                  value={p.relationshipType}
                                  onChange={(e) =>
                                    updateChildRow(i, {
                                      pendingNewParents:
                                        d.mode === "single"
                                          ? { ...d, parent: { ...d.parent, relationshipType: e.target.value } }
                                          : {
                                              ...d,
                                              [key]: { ...p, relationshipType: e.target.value },
                                            },
                                    })
                                  }
                                >
                                  {RELATIONSHIP_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2 sm:col-span-2">
                                <Label className="text-xs">Pedigree for this parent (optional)</Label>
                                <Input
                                  value={p.pedigree}
                                  onChange={(e) =>
                                    updateChildRow(i, {
                                      pendingNewParents:
                                        d.mode === "single"
                                          ? { ...d, parent: { ...d.parent, pedigree: e.target.value } }
                                          : {
                                              ...d,
                                              [key]: { ...p, pedigree: e.target.value },
                                            },
                                    })
                                  }
                                  placeholder="e.g. birth"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {d.mode === "single" && spouseLinkOptionsForNewParent.length > 0 ? (
                          <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/80 p-3">
                            <Label className="text-xs">Also add as spouse of an existing parent (optional)</Label>
                            <select
                              className={selectClassName}
                              value={
                                d.linkAsSpouse
                                  ? `${d.linkAsSpouse.familyId}::${d.linkAsSpouse.existingParentIndividualId}`
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                if (!v) {
                                  updateChildRow(i, {
                                    pendingNewParents: { ...d, linkAsSpouse: undefined },
                                  });
                                  return;
                                }
                                const sep = v.indexOf("::");
                                if (sep < 0) return;
                                const familyId = v.slice(0, sep);
                                const existingParentIndividualId = v.slice(sep + 2);
                                const hit = spouseLinkOptionsForNewParent.find(
                                  (o) =>
                                    o.familyId === familyId && o.parentIndividualId === existingParentIndividualId,
                                );
                                updateChildRow(i, {
                                  pendingNewParents: {
                                    ...d,
                                    linkAsSpouse: {
                                      familyId,
                                      existingParentIndividualId,
                                      existingParentLabel: hit?.label ?? "",
                                    },
                                  },
                                });
                              }}
                            >
                              <option value="">No — create a new separate family for the new parent</option>
                              {spouseLinkOptionsForNewParent.map((o) => (
                                <option
                                  key={`${o.familyId}-${o.parentIndividualId}`}
                                  value={`${o.familyId}::${o.parentIndividualId}`}
                                >
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Single-parent family: new parent fills the empty partner slot. Two-parent family: a new
                              couple family is created with the chosen parent and the new person (you stay linked as
                              child in both families when applicable).
                            </p>
                          </div>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Birth order (optional)</Label>
                            <Input
                              value={row.birthOrder}
                              onChange={(e) => updateChildRow(i, { birthOrder: e.target.value })}
                              inputMode="numeric"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeChildRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }

                  const husbandLabel = row.parentHusbandDisplay?.trim() || "—";
                  const wifeLabel = row.parentWifeDisplay?.trim() || "—";
                  const husbandId = row.parentHusbandId;
                  const wifeId = row.parentWifeId;
                  const husbandLinked =
                    !!husbandId &&
                    !(mode === "edit" && husbandId === individualId) &&
                    husbandLabel !== "—";
                  const wifeLinked =
                    !!wifeId && !(mode === "edit" && wifeId === individualId) && wifeLabel !== "—";
                  const cardTitle = parentFamilyCardTitle(husbandLabel, wifeLabel);
                  return (
                  <li
                    key={`child-${i}-${row.familyId}`}
                    className="space-y-4 rounded-xl border border-base-content/12 bg-base-content/[0.02] p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold leading-snug text-base-content">{cardTitle}</p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parent family</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-9 shrink-0 gap-1 px-2",
                          )}
                          aria-label="Family actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[11rem]">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/families/${row.familyId}`)}
                          >
                            Open family
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => removeChildRow(i)}>
                            Remove from list
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm text-base-content/90">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <ParentSexIcon sex={row.parentHusbandSex} />
                        {husbandLinked && husbandId ? (
                          <Link href={`/admin/individuals/${husbandId}`} className="link link-primary truncate font-medium">
                            {husbandLabel}
                          </Link>
                        ) : (
                          <span className="truncate">{husbandLabel}</span>
                        )}
                      </span>
                      <span className="text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <ParentSexIcon sex={row.parentWifeSex} />
                        {wifeLinked && wifeId ? (
                          <Link href={`/admin/individuals/${wifeId}`} className="link link-primary truncate font-medium">
                            {wifeLabel}
                          </Link>
                        ) : (
                          <span className="truncate">{wifeLabel}</span>
                        )}
                      </span>
                    </div>
                    <div className="space-y-1 border-t border-base-content/10 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relationship to parents</p>
                    </div>
                    {husbandId ? (
                      <div className="rounded-lg border border-base-content/10 bg-base-100/80 p-3 dark:bg-base-200/40">
                        <p className="mb-2 text-xs font-medium text-base-content">To {husbandLabel}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Relationship to child</Label>
                            <select
                              className={selectClassName}
                              value={row.relationshipToHusband}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateChildRow(i, {
                                  relationshipToHusband: v,
                                  relationshipType: v,
                                });
                              }}
                            >
                              {RELATIONSHIP_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Pedigree</Label>
                            <select
                              className={selectClassName}
                              value={row.pedigreeToHusband.trim()}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateChildRow(i, {
                                  pedigreeToHusband: v,
                                  pedigree: v || row.pedigreeToWife || row.pedigree,
                                });
                              }}
                            >
                              {PEDIGREE_OPTIONS.map((o) => (
                                <option key={o.value || "__empty"} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {wifeId ? (
                      <div className="rounded-lg border border-base-content/10 bg-base-100/80 p-3 dark:bg-base-200/40">
                        <p className="mb-2 text-xs font-medium text-base-content">To {wifeLabel}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Relationship to child</Label>
                            <select
                              className={selectClassName}
                              value={row.relationshipToWife}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateChildRow(i, {
                                  relationshipToWife: v,
                                  relationshipType: husbandId ? row.relationshipType : v,
                                });
                              }}
                            >
                              {RELATIONSHIP_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Pedigree</Label>
                            <select
                              className={selectClassName}
                              value={row.pedigreeToWife.trim()}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateChildRow(i, {
                                  pedigreeToWife: v,
                                  pedigree: row.pedigreeToHusband || v || row.pedigree,
                                });
                              }}
                            >
                              {PEDIGREE_OPTIONS.map((o) => (
                                <option key={o.value || "__emptyw"} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-base-content">Children in family</p>
                      {row.childrenInFamily === undefined ? (
                        <p className="text-sm text-muted-foreground">
                          Sibling list not loaded. Add this family via search above, or open the family page to see
                          children.
                        </p>
                      ) : row.childrenInFamily.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No children linked in this family.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {row.childrenInFamily.map((ch) => {
                            const isSelf = mode === "edit" && ch.individualId === individualId;
                            return (
                              <li key={ch.individualId}>
                                <span className="inline-flex items-center gap-1.5 text-sm text-base-content/90">
                                  <ParentSexIcon sex={ch.sex} />
                                  {isSelf ? (
                                    <Star
                                      className="size-4 shrink-0 fill-amber-400 text-amber-500"
                                      aria-label="This person"
                                    />
                                  ) : null}
                                  {isSelf ? (
                                    <span className="font-medium text-base-content">{ch.displayName}</span>
                                  ) : (
                                    <Link
                                      href={`/admin/individuals/${ch.individualId}`}
                                      className="link link-primary font-medium"
                                    >
                                      {ch.displayName}
                                    </Link>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="grid gap-2 border-t border-base-content/10 pt-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Family id</Label>
                        <Input
                          className="font-mono text-xs"
                          value={row.familyId}
                          onChange={(e) => updateChildRow(i, { familyId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Birth order (optional)</Label>
                        <Input
                          value={row.birthOrder}
                          onChange={(e) => updateChildRow(i, { birthOrder: e.target.value })}
                          inputMode="numeric"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No parent families linked yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Use Add parents to start the guided flow.</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              className="btn-success text-success-content min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
              onClick={() => setParentsWizardOpen(true)}
            >
              + Add parents
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setChildFamilySearchSlots((s) => [...s, createChildFamilySearchSlot()])}
            >
              Search family by name
            </Button>
          </div>

          <AddParentsWizardDialog
            open={parentsWizardOpen}
            onOpenChange={setParentsWizardOpen}
            individualId={individualId}
            subjectDisplayName={subjectDisplayName}
            excludedChildSpouseFamilyIds={excludedChildSpouseFamilyIds}
            enrichChildFamilyPick={enrichChildFamilyPick}
            mergeFamiliesAsChild={mergeFamiliesAsChild}
          />

          <div className="space-y-3">
            {childFamilySearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">Search parents&apos; family</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setChildFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <ChildParentsFamilySearch
                  inputIdPrefix={`child-fam-${slot.id}`}
                  p1Given={slot.p1Given}
                  p1Last={slot.p1Last}
                  p2Given={slot.p2Given}
                  p2Last={slot.p2Last}
                  setP1Given={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, p1Given: typeof v === "function" ? v(s.p1Given) : v }
                          : s,
                      ),
                    )
                  }
                  setP1Last={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id ? { ...s, p1Last: typeof v === "function" ? v(s.p1Last) : v } : s,
                      ),
                    )
                  }
                  setP2Given={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, p2Given: typeof v === "function" ? v(s.p2Given) : v }
                          : s,
                      ),
                    )
                  }
                  setP2Last={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id ? { ...s, p2Last: typeof v === "function" ? v(s.p2Last) : v } : s,
                      ),
                    )
                  }
                  excludedFamilyIds={excludedChildSpouseFamilyIds}
                  onPick={async (familyId, labels) => {
                    const { mergedLabels, children } = await enrichChildFamilyPick(familyId, labels);
                    addChildRow(familyId, mergedLabels, children);
                    setChildFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}
          </div>

          {hasPendingNewParentsChild ||
          familiesAsChild.some((r) => r.pendingExistingParentsLink?.parent1IndividualId.trim()) ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground dark:bg-primary/10">
              Pending parent links are applied when you save this person. Use{" "}
              <span className="font-medium text-foreground">Save person</span> at the bottom of the page.
            </div>
          ) : null}

          {familiesAsChild.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              This person has multiple parent families. Add another with <span className="font-medium text-base-content">+ Add parents</span> if needed.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
