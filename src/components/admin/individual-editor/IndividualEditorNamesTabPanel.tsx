"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  SURNAME_PIECE_TYPE_OPTIONS,
  type NameFormEditorRow,
  type NameFormRole,
  type SurnameFormRow,
} from "@/lib/forms/individual-editor-form";
import { cn } from "@/lib/utils";

export type IndividualEditorNamesTabPanelProps = {
  hidden: boolean;
  displayPreview: string;
  nameForms: NameFormEditorRow[];
  onAddNameForm: () => void;
  onNameFormRoleChange: (formIdx: number, role: NameFormRole) => void;
  onRemoveNameForm: (formIdx: number) => void;
  onAddGiven: (formIdx: number) => void;
  onSetGiven: (formIdx: number, i: number, value: string) => void;
  onMoveGiven: (formIdx: number, i: number, delta: number) => void;
  onRemoveGiven: (formIdx: number, i: number) => void;
  onAddSurname: (formIdx: number) => void;
  onRemoveSurname: (formIdx: number, i: number) => void;
  onUpdateSurnameRow: (formIdx: number, i: number, patch: Partial<SurnameFormRow>) => void;
};

export function IndividualEditorNamesTabPanel({
  hidden,
  displayPreview,
  nameForms,
  onAddNameForm,
  onNameFormRoleChange,
  onRemoveNameForm,
  onAddGiven,
  onSetGiven,
  onMoveGiven,
  onRemoveGiven,
  onAddSurname,
  onRemoveSurname,
  onUpdateSurnameRow,
}: IndividualEditorNamesTabPanelProps) {
  return (
    <div
      role="region"
      aria-label="Names"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Names</CardTitle>
          <p className="text-sm text-muted-foreground">
            Primary name for headings; add rows for nicknames, married names, or spelling variants.
          </p>
          <div className="mt-3 space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Effective label (primary)</p>
            <p className="font-medium text-base-content">{displayPreview || "—"}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <CollapsibleFormSection title="Advanced name details (GEDCOM & export)">
            <p className="text-sm text-muted-foreground">
              Mark exactly one name as <span className="font-medium text-base-content">Primary</span> (used for labels
              and exports). Add more rows as <span className="font-medium text-base-content">Alias</span> (also known
              as). Given-name order matters—use the arrows to reorder. Each surname can have a type (maiden, married,
              etc.).
            </p>
          </CollapsibleFormSection>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onAddNameForm}>
              Add name
            </Button>
          </div>
          {nameForms.map((nf, formIdx) => (
            <div key={nf.clientId} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`name-type-${nf.clientId}`}>Name type</Label>
                  <select
                    id={`name-type-${nf.clientId}`}
                    className={selectClassName}
                    value={nf.role}
                    onChange={(e) => onNameFormRoleChange(formIdx, e.target.value as NameFormRole)}
                  >
                    <option value="primary">Primary</option>
                    <option value="alias" disabled={nf.role === "primary" && nameForms.length === 1}>
                      Alias
                    </option>
                  </select>
                </div>
                {nameForms.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onRemoveNameForm(formIdx)}>
                    Remove name
                  </Button>
                ) : null}
              </div>
              <CollapsibleFormSection title="Given names">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => onAddGiven(formIdx)}>
                    Add given
                  </Button>
                </div>
                {nf.givenNames.map((g, i) => (
                  <div
                    key={`g-${nf.clientId}-${i}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          disabled={i === 0}
                          title="Move earlier"
                          aria-label={`Move given name ${i + 1} earlier`}
                          onClick={() => onMoveGiven(formIdx, i, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          disabled={i === nf.givenNames.length - 1}
                          title="Move later"
                          aria-label={`Move given name ${i + 1} later`}
                          onClick={() => onMoveGiven(formIdx, i, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <Input
                        className="h-10 min-h-10 min-w-0 flex-1"
                        value={g}
                        onChange={(e) => onSetGiven(formIdx, i, e.target.value)}
                        placeholder={`Given ${i + 1}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 self-end sm:self-center"
                      onClick={() => onRemoveGiven(formIdx, i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </CollapsibleFormSection>
              <CollapsibleFormSection title="Surnames">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => onAddSurname(formIdx)}>
                    Add surname
                  </Button>
                </div>
                {nf.surnames.map((s, i) => (
                  <div
                    key={`s-${nf.clientId}-${i}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <Input
                      className="h-10 min-h-10 min-w-0 flex-1"
                      value={s.text}
                      onChange={(e) => onUpdateSurnameRow(formIdx, i, { text: e.target.value })}
                      placeholder={`Surname ${i + 1}`}
                    />
                    <select
                      className={cn(selectClassName, "h-10 min-h-10 w-full shrink-0 sm:w-52")}
                      value={s.pieceType}
                      onChange={(e) => onUpdateSurnameRow(formIdx, i, { pieceType: e.target.value })}
                      aria-label={`Surname ${i + 1} type`}
                    >
                      {SURNAME_PIECE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value || "__default"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => onRemoveSurname(formIdx, i)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </CollapsibleFormSection>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
