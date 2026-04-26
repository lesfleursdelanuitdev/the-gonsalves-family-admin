"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { Star } from "lucide-react";
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
  pending: boolean;
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
  childFamilySearchSlots: ChildFamilySearchSlot[];
  setChildFamilySearchSlots: Dispatch<SetStateAction<ChildFamilySearchSlot[]>>;
  excludedChildSpouseFamilyIds: ReadonlySet<string>;
};

export function IndividualEditorChildTabPanel({
  hidden,
  mode,
  individualId,
  pending,
  familiesAsChild,
  hasPendingNewParentsChild,
  updateChildRow,
  removeChildRow,
  addChildRow,
  enrichChildFamilyPick,
  addChildNewParentsDraftRow,
  childFamilySearchSlots,
  setChildFamilySearchSlots,
  excludedChildSpouseFamilyIds,
}: IndividualEditorChildTabPanelProps) {
  return (
    <div
      id="individual-editor-panel-child"
      role="tabpanel"
      aria-labelledby="individual-editor-tab-child"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Families as child</CardTitle>
          <p className="text-sm text-muted-foreground">Link parental families by id or search.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CollapsibleFormSection title="Info">
            <p className="text-sm text-muted-foreground">
              Child-of-family links and parent relationships. {FAMILY_PARTNER_SLOT_SUBTITLE} Use birth order when known.
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
                            Two new individuals and a family are created; you are linked as their child.{" "}
                            {FAMILY_PARTNER_1_LABEL} / {FAMILY_PARTNER_2_LABEL} (HUSB/WIFE) follow the same sex rules
                            as elsewhere (e.g. M with F → M in partner 1, F in partner 2). Given names are split on
                            spaces.
                          </p>
                        </div>
                        {(["parent1", "parent2"] as const).map((pk) => {
                          const p = d[pk];
                          const label = pk === "parent1" ? "Parent 1" : "Parent 2";
                          return (
                            <div
                              key={pk}
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
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, givenNames: e.target.value },
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
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, surname: e.target.value },
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
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, sex: e.target.value },
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
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, relationshipType: e.target.value },
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
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Pedigree (optional)</Label>
                            <Input
                              value={row.pedigree}
                              onChange={(e) => updateChildRow(i, { pedigree: e.target.value })}
                              placeholder="e.g. birth"
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
                        <Label className="text-xs">Relationship to parents</Label>
                        <select
                          className={selectClassName}
                          value={row.relationshipType}
                          onChange={(e) => updateChildRow(i, { relationshipType: e.target.value })}
                        >
                          {RELATIONSHIP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pedigree (optional)</Label>
                        <Input
                          value={row.pedigree}
                          onChange={(e) => updateChildRow(i, { pedigree: e.target.value })}
                          placeholder="e.g. birth"
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
            <p className="text-sm text-muted-foreground">Not linked as a child.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChildFamilySearchSlots((s) => [...s, createChildFamilySearchSlot()])}
            >
              Add as child to an existing family
            </Button>
            <Button type="button" variant="outline" onClick={addChildNewParentsDraftRow}>
              Add parents — create new people
            </Button>
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
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-sm font-medium text-base-content">Save new parents &amp; family</p>
              <p className="text-sm text-muted-foreground">
                New parents and their family are not stored until you save. This runs the same save as the primary
                button at the bottom of the page.
              </p>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : mode === "create"
                    ? "Save person & new parental family"
                    : "Save & create new parental family"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
