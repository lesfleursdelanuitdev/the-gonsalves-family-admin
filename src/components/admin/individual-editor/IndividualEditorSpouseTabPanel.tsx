"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { NewSpousePartnerIndividualSearch } from "@/components/admin/individual-editor/NewSpousePartnerIndividualSearch";
import { SpouseSlotFamilySearch } from "@/components/admin/individual-editor/SpouseSlotFamilySearch";
import { ParentSexIcon } from "@/components/admin/individual-editor/ParentSexIcon";
import { spouseFamilyChildSearchExcludes } from "@/components/admin/individual-editor/spouseFamilyChildSearchExcludes";
import {
  NEW_PARENT_SEX_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/components/admin/individual-editor/individual-editor-family-constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";
import { cn } from "@/lib/utils";
import {
  createSpouseFamilySearchSlot,
  createSpouseNewFamilyExistingSearchSlot,
  type SpouseFamilySearchSlot,
  type SpouseNewFamilyExistingSearchSlot,
} from "@/components/admin/individual-editor/individual-family-editor-slots";

export type IndividualEditorSpouseTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  individualId: string;
  familiesAsSpouse: SpouseFamilyFormRow[];
  spouseSlotHelp: string | null;
  spouseFamiliesNeedSex: boolean;
  hasPendingNewSpouseFamily: boolean;
  hasPendingSpouseFamilyChildAdds: boolean;
  removeSpouseRow: (index: number) => void;
  updateSpouseRow: (index: number, patch: Partial<SpouseFamilyFormRow>) => void;
  addSpouseRow: (familyId: string, extra?: Partial<Omit<SpouseFamilyFormRow, "familyId">>) => void;
  enrichSpouseFamilyRow: (familyId: string) => Promise<Partial<Omit<SpouseFamilyFormRow, "familyId">> | undefined>;
  addSpouseNewFamilyExisting: (partnerId: string, partnerDisplay: string) => void;
  addSpouseNewFamilyNewPersonRow: () => void;
  spouseFamilySearchSlots: SpouseFamilySearchSlot[];
  setSpouseFamilySearchSlots: Dispatch<SetStateAction<SpouseFamilySearchSlot[]>>;
  spouseNewFamilyExistingSearchSlots: SpouseNewFamilyExistingSearchSlot[];
  setSpouseNewFamilyExistingSearchSlots: Dispatch<SetStateAction<SpouseNewFamilyExistingSearchSlot[]>>;
  spouseAddChildExistingSearch: { rowIndex: number; partnerGiven: string; partnerLast: string } | null;
  setSpouseAddChildExistingSearch: Dispatch<
    SetStateAction<{ rowIndex: number; partnerGiven: string; partnerLast: string } | null>
  >;
  excludedChildSpouseFamilyIds: ReadonlySet<string>;
  excludedSpousePartnerIndividualIds: ReadonlySet<string>;
};

export function IndividualEditorSpouseTabPanel({
  hidden,
  mode,
  individualId,
  familiesAsSpouse,
  spouseSlotHelp,
  spouseFamiliesNeedSex,
  hasPendingNewSpouseFamily,
  hasPendingSpouseFamilyChildAdds,
  removeSpouseRow,
  updateSpouseRow,
  addSpouseRow,
  enrichSpouseFamilyRow,
  addSpouseNewFamilyExisting,
  addSpouseNewFamilyNewPersonRow,
  spouseFamilySearchSlots,
  setSpouseFamilySearchSlots,
  spouseNewFamilyExistingSearchSlots,
  setSpouseNewFamilyExistingSearchSlots,
  spouseAddChildExistingSearch,
  setSpouseAddChildExistingSearch,
  excludedChildSpouseFamilyIds,
  excludedSpousePartnerIndividualIds,
}: IndividualEditorSpouseTabPanelProps) {
  const [partnerAddOpen, setPartnerAddOpen] = useState(false);

  return (
    <div role="region" aria-label="Partners and children" hidden={hidden} className="space-y-8 pt-2">
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Partners / spouses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Couples this person was part of—used for spouses and shared children.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CollapsibleFormSection title="Advanced details">
            <p className="text-sm text-muted-foreground">
              {FAMILY_PARTNER_SLOT_SUBTITLE} Set sex in Basic info before saving partner links when the tree needs a
              clear male/female pair for automatic placement. Empty list removes partner links.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
            {spouseSlotHelp ? <p className="text-xs text-muted-foreground">{spouseSlotHelp}</p> : null}
          </CollapsibleFormSection>
          {spouseFamiliesNeedSex ? (
            <p className="text-sm text-destructive" role="alert">
              Set sex to Male or Female to save spouse family links; unknown/other sex cannot be assigned to a husband
              or wife slot automatically.
            </p>
          ) : null}
          {familiesAsSpouse.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-base-content">Existing families</h3>
              <ul className="space-y-4">
                {familiesAsSpouse.map((row, i) => {
                  if (row.newFamilyExistingPartnerId) {
                    return (
                      <li
                        key={`spouse-newfam-ex-${i}-${row.newFamilyExistingPartnerId}`}
                        className="space-y-3 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <p className="text-sm font-semibold text-base-content">New family (created when you save)</p>
                        <p className="text-sm text-base-content/90">
                          Partner:{" "}
                          <span className="font-medium">
                            {row.newFamilyPartnerDisplay || row.newFamilyExistingPartnerId}
                          </span>
                        </p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }
                  if (row.newFamilyNewPartner) {
                    const np = row.newFamilyNewPartner;
                    return (
                      <li
                        key={`spouse-newfam-new-${i}`}
                        className="space-y-3 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <p className="text-sm font-semibold text-base-content">
                          New family with a new person (created when you save)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs">Given names (split on spaces into name parts)</Label>
                            <Input
                              value={np.givenNames}
                              onChange={(e) =>
                                updateSpouseRow(i, {
                                  newFamilyNewPartner: { ...np, givenNames: e.target.value },
                                })
                              }
                              placeholder="e.g. Maria Jose"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs">Last name</Label>
                            <Input
                              value={np.surname}
                              onChange={(e) =>
                                updateSpouseRow(i, {
                                  newFamilyNewPartner: { ...np, surname: e.target.value },
                                })
                              }
                              placeholder="e.g. Gonsalves"
                            />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }

                  const husbandLabel = row.husbandDisplay?.trim() || "—";
                  const wifeLabel = row.wifeDisplay?.trim() || "—";
                  const husbandId = row.husbandId;
                  const wifeId = row.wifeId;
                  const husbandLinked =
                    !!husbandId &&
                    !(mode === "edit" && husbandId === individualId) &&
                    husbandLabel !== "—";
                  const wifeLinked =
                    !!wifeId && !(mode === "edit" && wifeId === individualId) && wifeLabel !== "—";
                  const isHusbandSelf =
                    mode === "edit" && !!individualId && !!husbandId && husbandId === individualId;
                  const isWifeSelf = mode === "edit" && !!individualId && !!wifeId && wifeId === individualId;
                  const otherSpouseOnly = isHusbandSelf || isWifeSelf;
                  const otherSex = isHusbandSelf ? row.wifeSex : isWifeSelf ? row.husbandSex : undefined;
                  const otherId = isHusbandSelf ? wifeId : isWifeSelf ? husbandId : undefined;
                  const otherLabel = isHusbandSelf ? wifeLabel : isWifeSelf ? husbandLabel : "";
                  const showOtherLink =
                    otherSpouseOnly && !!otherId && !(mode === "edit" && otherId === individualId);
                  return (
                    <li key={`spouse-${i}-${row.familyId}`} className="space-y-3 rounded-lg border border-base-content/10 p-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-base-content">
                          {otherSpouseOnly ? "Partner" : "Spouses"}
                        </p>
                        {otherSpouseOnly ? (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                            <span className="inline-flex items-center gap-1.5">
                              <ParentSexIcon sex={otherSex} />
                              {showOtherLink ? (
                                <Link href={`/admin/individuals/${otherId}`} className="link link-primary font-medium">
                                  {otherLabel !== "—" ? otherLabel : "Partner"}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">No other spouse linked</span>
                              )}
                            </span>
                          </p>
                        ) : (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {FAMILY_PARTNER_1_LABEL}
                              </span>
                              <ParentSexIcon sex={row.husbandSex} />
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
                              <ParentSexIcon sex={row.wifeSex} />
                              {wifeLinked && wifeId ? (
                                <Link href={`/admin/individuals/${wifeId}`} className="link link-primary font-medium">
                                  {wifeLabel}
                                </Link>
                              ) : (
                                <span>{wifeLabel}</span>
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-base-content">Children in family</p>
                        {row.childrenInFamily === undefined ? (
                          <p className="text-sm text-muted-foreground">
                            Children list not loaded. Add this family via search below, or open the family page.
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
                      {row.familyId.trim() ? (
                        <div className="space-y-3 rounded-md border border-base-content/10 bg-base-100/40 p-3">
                          <p className="text-xs font-medium text-base-content">
                            Add children (applied when you save this person)
                          </p>
                          {(row.pendingSpouseFamilyChildren?.length ?? 0) > 0 ? (
                            <ul className="space-y-3">
                              {row.pendingSpouseFamilyChildren!.map((pch) => (
                                <li
                                  key={pch.clientId}
                                  className="space-y-2 rounded border border-dashed border-base-content/15 bg-base-200/20 p-2"
                                >
                                  {pch.kind === "existing" ? (
                                    <>
                                      <p className="text-sm font-medium text-base-content">
                                        {pch.displayLabel || pch.childIndividualId}
                                      </p>
                                      <p className="font-mono text-xs text-muted-foreground">
                                        {pch.childIndividualId.slice(0, 8)}…
                                      </p>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Relationship to parents</Label>
                                          <select
                                            className={selectClassName}
                                            value={pch.relationshipType}
                                            onChange={(e) =>
                                              updateSpouseRow(i, {
                                                pendingSpouseFamilyChildren: (
                                                  row.pendingSpouseFamilyChildren ?? []
                                                ).map((x) =>
                                                  x.clientId === pch.clientId && x.kind === "existing"
                                                    ? { ...x, relationshipType: e.target.value }
                                                    : x,
                                                ),
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
                                        <div className="space-y-1">
                                          <Label className="text-xs">Birth order (optional)</Label>
                                          <Input
                                            value={pch.birthOrder}
                                            onChange={(e) =>
                                              updateSpouseRow(i, {
                                                pendingSpouseFamilyChildren: (
                                                  row.pendingSpouseFamilyChildren ?? []
                                                ).map((x) =>
                                                  x.clientId === pch.clientId && x.kind === "existing"
                                                    ? { ...x, birthOrder: e.target.value }
                                                    : x,
                                                ),
                                              })
                                            }
                                            inputMode="numeric"
                                            placeholder="Optional"
                                          />
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="space-y-1 sm:col-span-2">
                                        <Label className="text-xs">Given names</Label>
                                        <Input
                                          value={pch.givenNames}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, givenNames: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                          placeholder="e.g. Maria Jose"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Last name</Label>
                                        <Input
                                          value={pch.surname}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, surname: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Sex</Label>
                                        <select
                                          className={selectClassName}
                                          value={pch.sex}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, sex: e.target.value }
                                                  : x,
                                              ),
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
                                      <div className="space-y-1">
                                        <Label className="text-xs">Relationship to parents</Label>
                                        <select
                                          className={selectClassName}
                                          value={pch.relationshipType}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, relationshipType: e.target.value }
                                                  : x,
                                              ),
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
                                      <div className="space-y-1">
                                        <Label className="text-xs">Birth order (optional)</Label>
                                        <Input
                                          value={pch.birthOrder}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, birthOrder: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                          inputMode="numeric"
                                          placeholder="Optional"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateSpouseRow(i, {
                                        pendingSpouseFamilyChildren: (
                                          row.pendingSpouseFamilyChildren ?? []
                                        ).filter((x) => x.clientId !== pch.clientId),
                                      })
                                    }
                                  >
                                    Remove from list
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSpouseAddChildExistingSearch((cur) =>
                                  cur?.rowIndex === i ? null : { rowIndex: i, partnerGiven: "", partnerLast: "" },
                                )
                              }
                            >
                              Add child — existing person
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateSpouseRow(i, {
                                  pendingSpouseFamilyChildren: [
                                    ...(row.pendingSpouseFamilyChildren ?? []),
                                    {
                                      clientId:
                                        typeof crypto !== "undefined" && "randomUUID" in crypto
                                          ? crypto.randomUUID()
                                          : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                      kind: "new" as const,
                                      givenNames: "",
                                      surname: "",
                                      sex: "",
                                      relationshipType: "biological",
                                      birthOrder: "",
                                    },
                                  ],
                                })
                              }
                            >
                              Add child — new person
                            </Button>
                          </div>
                          {spouseAddChildExistingSearch?.rowIndex === i ? (
                            <div className="space-y-2 rounded-md border border-base-content/10 bg-base-content/[0.02] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label className="text-sm font-medium text-base-content">
                                  Search for an existing person to add as a child
                                </Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSpouseAddChildExistingSearch(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <NewSpousePartnerIndividualSearch
                                inputIdPrefix={`spouse-add-child-${i}`}
                                partnerGiven={spouseAddChildExistingSearch.partnerGiven}
                                partnerLast={spouseAddChildExistingSearch.partnerLast}
                                setPartnerGiven={(v) =>
                                  setSpouseAddChildExistingSearch((s) =>
                                    s && s.rowIndex === i
                                      ? {
                                          ...s,
                                          partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                                        }
                                      : s,
                                  )
                                }
                                setPartnerLast={(v) =>
                                  setSpouseAddChildExistingSearch((s) =>
                                    s && s.rowIndex === i
                                      ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                                      : s,
                                  )
                                }
                                excludeIndividualIds={spouseFamilyChildSearchExcludes(row, individualId, mode)}
                                onPick={(childId, displayLabel) => {
                                  const cid =
                                    typeof crypto !== "undefined" && "randomUUID" in crypto
                                      ? crypto.randomUUID()
                                      : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                                  updateSpouseRow(i, {
                                    pendingSpouseFamilyChildren: [
                                      ...(row.pendingSpouseFamilyChildren ?? []),
                                      {
                                        clientId: cid,
                                        kind: "existing",
                                        childIndividualId: childId,
                                        displayLabel,
                                        relationshipType: "biological",
                                        birthOrder: "",
                                      },
                                    ],
                                  });
                                  setSpouseAddChildExistingSearch(null);
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Family id</Label>
                          <Input
                            className="font-mono text-xs"
                            value={row.familyId}
                            onChange={(e) => updateSpouseRow(i, { familyId: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/families/${row.familyId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")}
                        >
                          Open family
                        </Link>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
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
              <p className="text-sm text-muted-foreground">No partners added yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Add someone you share a family record with.</p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="flex min-h-11 w-full items-center justify-between gap-2 sm:w-auto sm:min-w-[12rem]"
              onClick={() => setPartnerAddOpen((v) => !v)}
              aria-expanded={partnerAddOpen}
            >
              Add partner
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", partnerAddOpen && "rotate-180")}
                aria-hidden
              />
            </Button>
            {partnerAddOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    setSpouseFamilySearchSlots((s) => [...s, createSpouseFamilySearchSlot()]);
                    setPartnerAddOpen(false);
                  }}
                >
                  Link to existing family (one open slot)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    setSpouseNewFamilyExistingSearchSlots((s) => [...s, createSpouseNewFamilyExistingSearchSlot()]);
                    setPartnerAddOpen(false);
                  }}
                >
                  New family — partner already in the tree
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full justify-start sm:flex-1"
                  onClick={() => {
                    addSpouseNewFamilyNewPersonRow();
                    setPartnerAddOpen(false);
                  }}
                >
                  New family — create new partner
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {spouseFamilySearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">Find a one-spouse family</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpouseFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <SpouseSlotFamilySearch
                  inputIdPrefix={`spouse-fam-${slot.id}`}
                  partnerGiven={slot.partnerGiven}
                  partnerLast={slot.partnerLast}
                  setPartnerGiven={(v) =>
                    setSpouseFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? {
                              ...s,
                              partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                            }
                          : s,
                      ),
                    )
                  }
                  setPartnerLast={(v) =>
                    setSpouseFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                          : s,
                      ),
                    )
                  }
                  excludedFamilyIds={excludedChildSpouseFamilyIds}
                  onPick={async (familyId) => {
                    const extra = await enrichSpouseFamilyRow(familyId);
                    addSpouseRow(familyId, extra);
                    setSpouseFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}

            {spouseNewFamilyExistingSearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">
                    New family — search for an existing partner
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpouseNewFamilyExistingSearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <NewSpousePartnerIndividualSearch
                  inputIdPrefix={`spouse-newfam-ex-${slot.id}`}
                  partnerGiven={slot.partnerGiven}
                  partnerLast={slot.partnerLast}
                  setPartnerGiven={(v) =>
                    setSpouseNewFamilyExistingSearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? {
                              ...s,
                              partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                            }
                          : s,
                      ),
                    )
                  }
                  setPartnerLast={(v) =>
                    setSpouseNewFamilyExistingSearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                          : s,
                      ),
                    )
                  }
                  excludeIndividualIds={excludedSpousePartnerIndividualIds}
                  onPick={(id, label) => {
                    addSpouseNewFamilyExisting(id, label);
                    setSpouseNewFamilyExistingSearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}
          </div>

          {hasPendingNewSpouseFamily || hasPendingSpouseFamilyChildAdds ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground dark:bg-primary/10">
              {hasPendingNewSpouseFamily ? "New partners and families apply when you save this person. " : null}
              {hasPendingSpouseFamilyChildAdds ? "Children you add here apply when you save. " : null}
              Use <span className="font-medium text-foreground">Save person</span> at the bottom of the page.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
