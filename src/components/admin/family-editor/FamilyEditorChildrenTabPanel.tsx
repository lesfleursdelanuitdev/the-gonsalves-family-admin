"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { selectClassName } from "@/components/data-viewer/constants";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { MiniIndividualFields } from "@/lib/forms/family-mini-individual-payload";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import type { FamilyEditChildRow, FamilyMemberAddStep } from "@/components/admin/family-editor/family-editor-types";
import { FamilyIndividualPickerList } from "@/components/admin/family-editor/FamilyIndividualPickerList";
import {
  initialsFromDisplayName,
  partnerAvatarClass,
  partnerSexLabel,
} from "@/components/admin/family-editor/family-editor-display";

const RELATIONSHIP_OPTIONS = [
  { value: "biological", label: "Biological" },
  { value: "adopted", label: "Adopted" },
  { value: "foster", label: "Foster" },
  { value: "step", label: "Step" },
  { value: "sealing", label: "Sealing" },
];

export type FamilyEditorChildrenTabPanelProps = {
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

function ChildRow({
  child,
  pending,
  onRemove,
}: {
  child: NonNullable<FamilyEditChildRow["child"]>;
  pending: boolean;
  onRemove: () => void;
}) {
  const label = stripSlashesFromName(child.fullName) || child.xref || child.id;
  const initials = initialsFromDisplayName(child.fullName, child.id);
  const by = child.birthYear != null && Number.isFinite(child.birthYear) ? String(child.birthYear) : null;
  const metaParts = [partnerSexLabel(child.sex), by ? `Born ${by}` : null].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-3">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${partnerAvatarClass(child.sex)}`}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{metaParts.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/admin/individuals/${child.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-1 text-muted-foreground",
          )}
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => void onRemove()}
        >
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      </div>
    </div>
  );
}

export function FamilyEditorChildrenTabPanel({
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
    <div className="space-y-4">
      {familyChildren.length === 0 ? (
        <p className="text-sm text-muted-foreground">No children in this relationship yet.</p>
      ) : (
        <ul className="space-y-2">
          {familyChildren.map((row) => {
            const c = row.child;
            if (!c?.id) return null;
            return (
              <li key={c.id}>
                <ChildRow child={c} pending={pending} onRemove={() => void onRemoveChild(c.id)} />
              </li>
            );
          })}
        </ul>
      )}

      {childAddStep === null ? (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          disabled={pending}
          onClick={() => {
            resetChildPanel();
            setChildAddStep("existing");
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add child
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {childAddStep === "existing" ? "Add a child" : "Create a new child"}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={closeChildAdd}>
              Cancel
            </Button>
          </div>
          {childAddStep === "existing" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Search by name, then pick someone not already in this family.</p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => {
                  resetChildPanel();
                  setChildAddStep("create");
                }}
              >
                Create a new person instead
              </Button>
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
              <div className="space-y-2">
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
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => {
                  resetChildPanel();
                  setChildAddStep("existing");
                }}
              >
                Search the tree instead
              </Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ch-rel2">Relationship</Label>
                  <select
                    id="ch-rel2"
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
                  <Label htmlFor="ch-bo2">Birth order (optional)</Label>
                  <Input
                    id="ch-bo2"
                    inputMode="numeric"
                    value={childBirthOrder}
                    onChange={(e) => setChildBirthOrder(e.target.value)}
                    placeholder="e.g. 1"
                    className="min-h-11 sm:min-h-10"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === "create"
                  ? "Creates the person only. After you create the family record, add them with Add child if they are not linked yet."
                  : "Creates a minimal person and links them as a child."}
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
                {mode === "create" ? "Create person" : "Create and add child"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
