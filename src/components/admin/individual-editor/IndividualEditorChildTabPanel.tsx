"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { ChildParentsFamilySearch } from "@/components/admin/individual-editor/ChildParentsFamilySearch";
import { ParentSexIcon } from "@/components/admin/individual-editor/ParentSexIcon";
import {
  NEW_PARENT_SEX_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/components/admin/individual-editor/individual-editor-family-constants";
import {
  createChildFamilySearchSlot,
  type ChildFamilySearchSlot,
} from "@/components/admin/individual-editor/individual-family-editor-slots";
import type { ChildFamilyParentPickLabels } from "@/components/admin/individual-editor/individual-family-search-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  addChildNewParentsDraftRow: () => void;
  addChildSingleNewParentDraftRow: () => void;
  childFamilySearchSlots: ChildFamilySearchSlot[];
  setChildFamilySearchSlots: Dispatch<SetStateAction<ChildFamilySearchSlot[]>>;
  excludedChildSpouseFamilyIds: ReadonlySet<string>;
  spouseLinkOptionsForNewParent: { familyId: string; parentIndividualId: string; label: string }[];
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
  addChildNewParentsDraftRow,
  addChildSingleNewParentDraftRow,
  childFamilySearchSlots,
  setChildFamilySearchSlots,
  excludedChildSpouseFamilyIds,
  spouseLinkOptionsForNewParent,
}: IndividualEditorChildTabPanelProps) {
  const [parentsAddOpen, setParentsAddOpen] = useState(false);

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
          <CollapsibleFormSection title="Advanced details">
            <p className="text-sm text-muted-foreground">
              Families store two partner slots (Partner 1 and Partner 2) for compatibility with standard genealogy
              files. {FAMILY_PARTNER_SLOT_SUBTITLE} Use birth order when known.
            </p>
          </CollapsibleFormSection>
          {familiesAsChild.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-base-content">Existing families</h3>
              <ul className="space-y-4">
                {familiesAsChild.map((row, i) => {
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
                                <Label className="text-xs">Sex (for HUSB/WIFE placement)</Label>
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
                  return (
                  <li key={`child-${i}-${row.familyId}`} className="space-y-3 rounded-lg border border-base-content/10 p-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-base-content">Parents</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {FAMILY_PARTNER_1_LABEL}
                          </span>
                          <ParentSexIcon sex={row.parentHusbandSex} />
                          {husbandLinked && husbandId ? (
                            <Link href={`/admin/individuals/${husbandId}`} className="link link-primary font-medium">
                              {husbandLabel}
                            </Link>
                          ) : (
                            <span>{husbandLabel}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {FAMILY_PARTNER_2_LABEL}
                          </span>
                          <ParentSexIcon sex={row.parentWifeSex} />
                          {wifeLinked && wifeId ? (
                            <Link href={`/admin/individuals/${wifeId}`} className="link link-primary font-medium">
                              {wifeLabel}
                            </Link>
                          ) : (
                            <span>{wifeLabel}</span>
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-base-content">Children in family</p>
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
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Family id</Label>
                        <Input
                          className="font-mono text-xs"
                          value={row.familyId}
                          onChange={(e) => updateChildRow(i, { familyId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Birth order</Label>
                        <Input
                          value={row.birthOrder}
                          onChange={(e) => updateChildRow(i, { birthOrder: e.target.value })}
                          inputMode="numeric"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Relationship — {FAMILY_PARTNER_1_LABEL}</Label>
                        <select
                          className={selectClassName}
                          disabled={!husbandId}
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
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Pedigree — {FAMILY_PARTNER_1_LABEL} (optional)</Label>
                        <Input
                          value={row.pedigreeToHusband}
                          onChange={(e) =>
                            updateChildRow(i, {
                              pedigreeToHusband: e.target.value,
                              pedigree: e.target.value || row.pedigreeToWife || row.pedigree,
                            })
                          }
                          placeholder="e.g. birth"
                          disabled={!husbandId}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Relationship — {FAMILY_PARTNER_2_LABEL}</Label>
                        <select
                          className={selectClassName}
                          disabled={!wifeId}
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
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Pedigree — {FAMILY_PARTNER_2_LABEL} (optional)</Label>
                        <Input
                          value={row.pedigreeToWife}
                          onChange={(e) =>
                            updateChildRow(i, {
                              pedigreeToWife: e.target.value,
                              pedigree: row.pedigreeToHusband || e.target.value || row.pedigree,
                            })
                          }
                          placeholder="e.g. birth"
                          disabled={!wifeId}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/families/${row.familyId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Open family
                      </Link>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeChildRow(i)}>
                        Remove
                      </Button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No parents added yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Search for their family record, create one new parent with a family, or create two new parents at once.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="flex min-h-11 w-full items-center justify-between gap-2 sm:w-auto sm:min-w-[12rem]"
              onClick={() => setParentsAddOpen((v) => !v)}
              aria-expanded={parentsAddOpen}
            >
              Add parents
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", parentsAddOpen && "rotate-180")}
                aria-hidden
              />
            </Button>
            {parentsAddOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    setChildFamilySearchSlots((s) => [...s, createChildFamilySearchSlot()]);
                    setParentsAddOpen(false);
                  }}
                >
                  Link to existing parents&apos; family
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    addChildSingleNewParentDraftRow();
                    setParentsAddOpen(false);
                  }}
                >
                  Create one new parent
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    addChildNewParentsDraftRow();
                    setParentsAddOpen(false);
                  }}
                >
                  Create two new parents
                </Button>
              </div>
            ) : null}
          </div>

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

          {hasPendingNewParentsChild ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground dark:bg-primary/10">
              New parents and their family are stored when you save this person. Use{" "}
              <span className="font-medium text-foreground">Save person</span> at the bottom of the page.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
