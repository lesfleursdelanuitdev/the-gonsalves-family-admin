"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
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
import type { FamilyEditChildRow, FamilyMemberAddStep } from "@/components/admin/family-editor/family-editor-types";
import { FamilyIndividualPickerList } from "@/components/admin/family-editor/FamilyIndividualPickerList";

const RELATIONSHIP_OPTIONS = [
  { value: "biological", label: "Biological" },
  { value: "adopted", label: "Adopted" },
  { value: "foster", label: "Foster" },
  { value: "step", label: "Step" },
  { value: "sealing", label: "Sealing" },
];

export type FamilyEditorChildrenTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  familyChildren: FamilyEditChildRow[];
  pending: boolean;
  onRemoveChild: (childId: string) => void | Promise<void>;
  childAddStep: FamilyMemberAddStep | null;
  setChildAddStep: Dispatch<SetStateAction<FamilyMemberAddStep | null>>;
  childSearchQ: string;
  setChildSearchQ: (v: string) => void;
  childRelationshipType: string;
  setChildRelationshipType: (v: string) => void;
  childBirthOrder: string;
  setChildBirthOrder: (v: string) => void;
  miniChild: MiniIndividualFields;
  setMiniChild: Dispatch<SetStateAction<MiniIndividualFields>>;
  resetChildPanel: () => void;
  closeChildAdd: () => void;
  onAddChildById: (childId: string) => void | Promise<void>;
  onCreateChild: () => void | Promise<void>;
  excludeMemberIds: Set<string>;
  setMiniBirth: (which: "parent" | "child", next: KeyFactFormState) => void;
  setMiniDeath: (which: "parent" | "child", next: KeyFactFormState) => void;
};

export function FamilyEditorChildrenTabPanel({
  hidden,
  mode,
  familyChildren,
  pending,
  onRemoveChild,
  childAddStep,
  setChildAddStep,
  childSearchQ,
  setChildSearchQ,
  childRelationshipType,
  setChildRelationshipType,
  childBirthOrder,
  setChildBirthOrder,
  miniChild,
  setMiniChild,
  resetChildPanel,
  closeChildAdd,
  onAddChildById,
  onCreateChild,
  excludeMemberIds,
  setMiniBirth,
  setMiniDeath,
}: FamilyEditorChildrenTabPanelProps) {
  return (
    <div
      id="family-editor-panel-children"
      role="tabpanel"
      aria-labelledby="family-editor-tab-children"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Children ({familyChildren.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {familyChildren.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked.</p>
          ) : (
            <ul className="space-y-2">
              {familyChildren.map((row) => {
                const c = row.child;
                if (!c?.id) return null;
                const label = stripSlashesFromName(c.fullName) || c.xref || c.id;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-box border border-base-content/[0.08] px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SexIcon sex={c.sex} />
                      <Link href={`/admin/individuals/${c.id}`} className="link link-primary truncate font-medium">
                        {label}
                      </Link>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label="Remove child"
                      onClick={() => void onRemoveChild(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-3 border-t border-base-content/10 pt-4">
            <h3 className="text-sm font-semibold text-base-content">Add children</h3>
            {childAddStep === null ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    resetChildPanel();
                    setChildAddStep("existing");
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
                    resetChildPanel();
                    setChildAddStep("create");
                  }}
                >
                  Create new person
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">
                    {childAddStep === "existing" ? "Add existing person" : "Create new child"}
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={closeChildAdd}>
                    Cancel
                  </Button>
                </div>
                {(mode === "edit" || childAddStep === "existing") ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ch-rel">Relationship</Label>
                      <select
                        id="ch-rel"
                        className={selectClassName}
                        value={childRelationshipType}
                        onChange={(e) => setChildRelationshipType(e.target.value)}
                      >
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ch-bo">Birth order (optional)</Label>
                      <Input
                        id="ch-bo"
                        inputMode="numeric"
                        value={childBirthOrder}
                        onChange={(e) => setChildBirthOrder(e.target.value)}
                        placeholder="e.g. 1"
                        className="min-h-11 sm:min-h-10"
                      />
                    </div>
                  </div>
                ) : null}
                {childAddStep === "existing" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Search by given or surname, then pick someone not already in this family.
                    </p>
                    <Label htmlFor="child-q">Name search</Label>
                    <Input
                      id="child-q"
                      value={childSearchQ}
                      onChange={(e) => setChildSearchQ(e.target.value)}
                      placeholder="Given or surname…"
                      autoComplete="off"
                      className="min-h-11 sm:min-h-10"
                    />
                    <FamilyIndividualPickerList
                      query={childSearchQ}
                      excludeIds={excludeMemberIds}
                      allowedSexes={null}
                      onPick={(childIndiId) => void onAddChildById(childIndiId)}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {mode === "create" ? (
                        <>
                          Creates only the person in the tree (not linked as a child yet). Use{" "}
                          <span className="font-medium text-base-content/90">Add existing person</span> to link them after{" "}
                          <span className="font-medium text-base-content/90">Create new family</span>.
                        </>
                      ) : (
                        <>Create a minimal person and link them as a child with the relationship and birth order above.</>
                      )}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-given">Given names</Label>
                        <Input
                          id="nc-given"
                          value={miniChild.givenNamesLine}
                          onChange={(e) => setMiniChild((p) => ({ ...p, givenNamesLine: e.target.value }))}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-sur">Surname</Label>
                        <Input
                          id="nc-sur"
                          value={miniChild.surnameLine}
                          onChange={(e) => setMiniChild((p) => ({ ...p, surnameLine: e.target.value }))}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-sex">Sex</Label>
                        <select
                          id="nc-sex"
                          className={selectClassName}
                          value={miniChild.sex}
                          onChange={(e) => setMiniChild((p) => ({ ...p, sex: e.target.value }))}
                        >
                          <option value="">Unknown</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="U">Unknown (U)</option>
                          <option value="X">Other (X)</option>
                        </select>
                      </div>
                    </div>
                    <KeyFactSection title="Birth (optional)" fact={miniChild.birth} onChange={(n) => setMiniBirth("child", n)} />
                    <KeyFactSection title="Death (optional)" fact={miniChild.death} onChange={(n) => setMiniDeath("child", n)} />
                    <Button type="button" disabled={pending} className="w-full sm:w-auto" onClick={() => void onCreateChild()}>
                      {mode === "create" ? "Create" : "Create and link"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
