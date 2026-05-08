"use client";

import { useState } from "react";
import { Info, UserPlus } from "lucide-react";
import { AddChildWizardDialog } from "@/components/admin/individual-editor/AddChildWizardDialog";
import { IndividualEditorChildrenGroupedSection } from "@/components/admin/individual-editor/IndividualEditorChildrenGroupedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";

export type IndividualEditorAddChildSectionProps = {
  mode: "create" | "edit";
  individualId: string;
  familiesAsSpouse: SpouseFamilyFormRow[];
};

export function IndividualEditorAddChildSection({
  mode,
  individualId,
  familiesAsSpouse,
}: IndividualEditorAddChildSectionProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [presetFamilyId, setPresetFamilyId] = useState<string | null>(null);

  const openWizard = (familyId?: string) => {
    setPresetFamilyId(familyId?.trim() || null);
    setWizardOpen(true);
  };

  if (mode !== "edit") {
    return (
      <Card className="border-base-content/10 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Add child</CardTitle>
          <CardDescription>Add a child by selecting or creating a family relationship.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            Save the person first, then use Add child from the edit screen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-base-content/10 shadow-none">
        <CardHeader className="flex flex-col gap-2 border-b border-base-content/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">Add child</CardTitle>
            <CardDescription>Add a child by selecting or creating a family relationship.</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => openWizard()}
          >
            <UserPlus className="size-4" aria-hidden />
            Add child
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex gap-3 rounded-xl border border-base-content/10 bg-base-content/[0.02] px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary/90" aria-hidden />
            <div className="space-y-2">
              <p>
                Children belong to a <span className="font-medium text-foreground">family record</span>, not directly to
                one person. Choose whether the other parent is unknown, already in the tree, new, or pick an existing
                family — then search for the child or create them with minimal fields.
              </p>
              <p className="text-xs">
                If you are not sure about the second parent yet, start with &quot;No other parent / unknown&quot;; you can
                attach a partner later from the family page.
              </p>
            </div>
          </div>

          <IndividualEditorChildrenGroupedSection
            mode={mode}
            individualId={individualId}
            familiesAsSpouse={familiesAsSpouse}
            onAddChildForFamily={(familyId) => openWizard(familyId)}
          />

          <div className="rounded-xl border border-dashed border-base-content/15 bg-transparent px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Need another entry point? Use the button above to launch the guided flow.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => openWizard()}
            >
              <UserPlus className="size-4" aria-hidden />
              Add child
            </Button>
          </div>
        </CardContent>
      </Card>

      <AddChildWizardDialog
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) setPresetFamilyId(null);
        }}
        subjectIndividualId={individualId}
        mode={mode}
        familiesAsSpouse={familiesAsSpouse}
        initialFamilyId={presetFamilyId}
      />
    </>
  );
}
