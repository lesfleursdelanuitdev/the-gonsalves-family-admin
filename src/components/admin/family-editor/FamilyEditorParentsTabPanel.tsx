"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { selectClassName } from "@/components/data-viewer/constants";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { SexIcon } from "@/components/admin/SexIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { MiniIndividualFields } from "@/lib/forms/family-mini-individual-payload";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import {
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import type { FamilyEditPartner, FamilyMemberAddStep } from "@/components/admin/family-editor/family-editor-types";
import { FamilyIndividualPickerList } from "@/components/admin/family-editor/FamilyIndividualPickerList";
import { isMiniParentSexChosen } from "@/components/admin/family-editor/family-parent-mini-fields";

export type FamilyEditorParentsTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  husband: FamilyEditPartner;
  wife: FamilyEditPartner;
  pending: boolean;
  onRemoveParent: (slot: "husband" | "wife") => void;
  canAddParent: boolean;
  parentSlotRulesOpen: boolean;
  setParentSlotRulesOpen: Dispatch<SetStateAction<boolean>>;
  parentSlotRulesPanelId: string;
  parentAddStep: FamilyMemberAddStep | null;
  setParentAddStep: Dispatch<SetStateAction<FamilyMemberAddStep | null>>;
  parentSearchQ: string;
  setParentSearchQ: (v: string) => void;
  miniParent: MiniIndividualFields;
  setMiniParent: Dispatch<SetStateAction<MiniIndividualFields>>;
  resetParentPanel: () => void;
  closeParentAdd: () => void;
  onAddParentById: (individualId: string) => void | Promise<void>;
  onCreateParent: () => void | Promise<void>;
  excludeMemberIds: Set<string>;
  parentSexFilter: Set<"M" | "F"> | null;
  setMiniBirth: (which: "parent" | "child", next: KeyFactFormState) => void;
  setMiniDeath: (which: "parent" | "child", next: KeyFactFormState) => void;
};

export function FamilyEditorParentsTabPanel({
  hidden,
  mode,
  husband,
  wife,
  pending,
  onRemoveParent,
  canAddParent,
  parentSlotRulesOpen,
  setParentSlotRulesOpen,
  parentSlotRulesPanelId,
  parentAddStep,
  setParentAddStep,
  parentSearchQ,
  setParentSearchQ,
  miniParent,
  setMiniParent,
  resetParentPanel,
  closeParentAdd,
  onAddParentById,
  onCreateParent,
  excludeMemberIds,
  parentSexFilter,
  setMiniBirth,
  setMiniDeath,
}: FamilyEditorParentsTabPanelProps) {
  return (
    <div
      id="family-editor-panel-parents"
      role="tabpanel"
      aria-labelledby="family-editor-tab-parents"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Parents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
              aria-expanded={parentSlotRulesOpen}
              aria-controls={parentSlotRulesPanelId}
              onClick={() => setParentSlotRulesOpen((o) => !o)}
            >
              <span className="font-medium text-base-content">Info</span>
              {parentSlotRulesOpen ? (
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            <div
              id={parentSlotRulesPanelId}
              hidden={!parentSlotRulesOpen}
              className="space-y-2 border-t border-base-content/10 px-3 pb-3 pt-2"
              role="region"
              aria-label="Partner slot info"
            >
              <p className="text-sm text-muted-foreground">{FAMILY_PARTNER_SLOT_SUBTITLE}</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Add existing person still filters by the open partner slot (M/F). Create new person accepts Male, Female,
                Unknown (U), or Other (X); when linking, HUSB/WIFE follow the rules above (including unknown/other with M
                or F).
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-box border border-base-content/[0.08] p-3">
              <p className="text-xs font-medium text-muted-foreground">{FAMILY_PARTNER_1_LABEL}</p>
              <p className="text-[11px] text-muted-foreground/90">GEDCOM husband (HUSB)</p>
              {husband ? (
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <SexIcon sex={husband.sex} />
                    <Link href={`/admin/individuals/${husband.id}`} className="link link-primary truncate font-medium">
                      {stripSlashesFromName(husband.fullName) || husband.xref || husband.id}
                    </Link>
                  </div>
                  {wife ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label={`Remove ${FAMILY_PARTNER_1_LABEL} (HUSB)`}
                      onClick={() => void onRemoveParent("husband")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Cannot remove only parent</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
            <div className="rounded-box border border-base-content/[0.08] p-3">
              <p className="text-xs font-medium text-muted-foreground">{FAMILY_PARTNER_2_LABEL}</p>
              <p className="text-[11px] text-muted-foreground/90">GEDCOM wife (WIFE)</p>
              {wife ? (
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <SexIcon sex={wife.sex} />
                    <Link href={`/admin/individuals/${wife.id}`} className="link link-primary truncate font-medium">
                      {stripSlashesFromName(wife.fullName) || wife.xref || wife.id}
                    </Link>
                  </div>
                  {husband ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label={`Remove ${FAMILY_PARTNER_2_LABEL} (WIFE)`}
                      onClick={() => void onRemoveParent("wife")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Cannot remove only parent</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
          </div>

          {canAddParent ? (
            <div className="space-y-3 border-t border-base-content/10 pt-4">
              <h3 className="text-sm font-semibold text-base-content">Add Parent(s)</h3>
              {parentAddStep === null ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("existing");
                    }}
                  >
                    Add existing person
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("create");
                    }}
                  >
                    Create new person
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-medium text-base-content">
                      {parentAddStep === "existing" ? "Add existing person" : "Create new parent"}
                    </Label>
                    <Button type="button" variant="ghost" size="sm" onClick={closeParentAdd}>
                      Cancel
                    </Button>
                  </div>
                  {parentAddStep === "existing" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Search by given or surname, then pick someone who fits the open partner slot (M/F).
                      </p>
                      <Label htmlFor="parent-q">Name search</Label>
                      <Input
                        id="parent-q"
                        value={parentSearchQ}
                        onChange={(e) => setParentSearchQ(e.target.value)}
                        placeholder="Given or surname…"
                        autoComplete="off"
                        className="min-h-11 sm:min-h-10"
                      />
                      <FamilyIndividualPickerList
                        query={parentSearchQ}
                        excludeIds={excludeMemberIds}
                        allowedSexes={parentSexFilter}
                        onPick={(indiId) => void onAddParentById(indiId)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {mode === "create" ? (
                          <>
                            Creates only the person in the tree (not linked to this family yet). Use{" "}
                            <span className="font-medium text-base-content/90">Add existing person</span> to link them
                            after <span className="font-medium text-base-content/90">Create new family</span>. Choose
                            sex (M, F, U, or X). Open partner slot rules above if needed.
                          </>
                        ) : (
                          <>
                            Minimal person record; sex M, F, U, or X. Open{" "}
                            <span className="font-medium text-base-content/90">Partner slot assignment rules</span> above
                            if you need the full logic.
                          </>
                        )}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-given">Given names</Label>
                          <Input
                            id="np-given"
                            value={miniParent.givenNamesLine}
                            onChange={(e) => setMiniParent((p) => ({ ...p, givenNamesLine: e.target.value }))}
                            placeholder="e.g. Maria Clara"
                            className="min-h-11 sm:min-h-10"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-sur">Surname (use /a /b/ for several)</Label>
                          <Input
                            id="np-sur"
                            value={miniParent.surnameLine}
                            onChange={(e) => setMiniParent((p) => ({ ...p, surnameLine: e.target.value }))}
                            placeholder="e.g. Gonsalves or /Silva /Oliveira/"
                            className="min-h-11 sm:min-h-10"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-sex">Sex</Label>
                          <select
                            id="np-sex"
                            className={selectClassName}
                            value={miniParent.sex}
                            onChange={(e) => setMiniParent((p) => ({ ...p, sex: e.target.value }))}
                          >
                            <option value="">Choose…</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="U">Unknown</option>
                            <option value="X">Other</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground">
                            GEDCOM sex codes: U = unknown, X = other. Partner slots when linking follow the collapsible
                            rules (M/F/U/X and same-sex ordering).
                          </p>
                        </div>
                      </div>
                      <KeyFactSection title="Birth (optional)" fact={miniParent.birth} onChange={(n) => setMiniBirth("parent", n)} />
                      <KeyFactSection title="Death (optional)" fact={miniParent.death} onChange={(n) => setMiniDeath("parent", n)} />
                      <Button
                        type="button"
                        disabled={pending || !isMiniParentSexChosen(miniParent.sex)}
                        className="w-full sm:w-auto"
                        onClick={() => void onCreateParent()}
                      >
                        {mode === "create" ? "Create" : "Create and link"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
