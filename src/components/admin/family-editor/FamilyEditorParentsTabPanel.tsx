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
import type { FamilyEditPartner, FamilyMemberAddStep } from "@/components/admin/family-editor/family-editor-types";
import { FamilyIndividualPickerList } from "@/components/admin/family-editor/FamilyIndividualPickerList";
import { isMiniParentSexChosen } from "@/components/admin/family-editor/family-parent-mini-fields";
import {
  initialsFromDisplayName,
  partnerAvatarClass,
  partnerSexLabel,
} from "@/components/admin/family-editor/family-editor-display";

export type FamilyEditorParentsTabPanelProps = {
  mode: "create" | "edit";
  husband: FamilyEditPartner;
  wife: FamilyEditPartner;
  pending: boolean;
  onRemoveParent: (slot: "husband" | "wife") => void;
  canAddParent: boolean;
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

function PartnerRow({
  partner,
  pending,
  canRemove,
  onRemove,
}: {
  partner: NonNullable<FamilyEditPartner>;
  pending: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const label = stripSlashesFromName(partner.fullName) || partner.xref || partner.id;
  const initials = initialsFromDisplayName(partner.fullName, partner.id);
  const avatarClass = partnerAvatarClass(partner.sex);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-3">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{partnerSexLabel(partner.sex)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/admin/individuals/${partner.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-1 text-muted-foreground",
          )}
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </Link>
        {canRemove ? (
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
        ) : null}
      </div>
    </div>
  );
}

export function FamilyEditorParentsTabPanel({
  mode,
  husband,
  wife,
  pending,
  onRemoveParent,
  canAddParent,
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
  const rows: { slot: "husband" | "wife"; partner: NonNullable<FamilyEditPartner> }[] = [];
  if (husband) rows.push({ slot: "husband", partner: husband });
  if (wife) rows.push({ slot: "wife", partner: wife });

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No partners linked yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ slot, partner }) => (
            <PartnerRow
              key={partner.id}
              partner={partner}
              pending={pending}
              canRemove={rows.length > 1}
              onRemove={() => void onRemoveParent(slot)}
            />
          ))}
        </div>
      )}

      {canAddParent ? (
        <>
          {parentAddStep === null ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              disabled={pending}
              onClick={() => {
                resetParentPanel();
                setParentAddStep("existing");
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add partner
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {parentAddStep === "existing" ? "Find a partner" : "Create a new person"}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={closeParentAdd}>
                  Cancel
                </Button>
              </div>
              {parentAddStep === "existing" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Search by name, then pick someone who fits the open partner slot.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("create");
                    }}
                  >
                    Create a new person instead
                  </Button>
                  <div className="space-y-2">
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
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("existing");
                    }}
                  >
                    Search the tree instead
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {mode === "create"
                      ? "Creates the person only. After creating the family record, add them with Add partner if they are not linked yet."
                      : "Creates a minimal person and adds them as a partner when possible."}
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
                      <Label htmlFor="np-sur">Surname</Label>
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
                    {mode === "create" ? "Create person" : "Create and add partner"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
