"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { formatKeyFactSummaryLine } from "@/components/admin/individual-editor/person-editor-mobile-summaries";
import { emptyKeyFactFormState, type KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { cn } from "@/lib/utils";

export type FamilyEditorEventsTabPanelProps = {
  mode: "create" | "edit";
  marriageFact: KeyFactFormState;
  setMarriageFact: Dispatch<SetStateAction<KeyFactFormState>>;
  divorceFact: KeyFactFormState;
  setDivorceFact: Dispatch<SetStateAction<KeyFactFormState>>;
  isDivorced: boolean;
  familyId: string;
  familyNewEventLabel: string;
};

function TimelineRow({
  label,
  filled,
  summaryLine,
  onEdit,
  onDelete,
  showDelete,
}: {
  label: string;
  filled: boolean;
  summaryLine: string;
  onEdit: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-3 sm:items-center">
      <span
        className={cn(
          "mt-1.5 size-2.5 shrink-0 rounded-full sm:mt-0",
          filled ? "bg-primary shadow-[0_0_0_3px] shadow-primary/25" : "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{filled ? summaryLine : "Not added yet"}</p>
      </div>
      <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto">
        {!filled ? (
          <Button type="button" variant="outline" size="sm" className="text-primary" onClick={onEdit}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            {showDelete && onDelete ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function FamilyEditorEventsTabPanel({
  mode,
  marriageFact,
  setMarriageFact,
  divorceFact,
  setDivorceFact,
  isDivorced,
  familyId,
  familyNewEventLabel,
}: FamilyEditorEventsTabPanelProps) {
  const [marriageOpen, setMarriageOpen] = useState(false);
  const [divorceOpen, setDivorceOpen] = useState(false);

  const marriageFilled = formatKeyFactSummaryLine(marriageFact) !== "Not added";
  const divorceLine = formatKeyFactSummaryLine(divorceFact);
  const divorceFilled = divorceLine !== "Not added" || isDivorced;
  const divorceSummary =
    divorceLine !== "Not added" ? divorceLine : isDivorced ? "Recorded as divorced" : "Not added yet";

  return (
    <div className="space-y-4">
      <TimelineRow
        label="Marriage"
        filled={marriageFilled}
        summaryLine={formatKeyFactSummaryLine(marriageFact)}
        onEdit={() => setMarriageOpen(true)}
        onDelete={() => setMarriageFact(emptyKeyFactFormState())}
        showDelete={marriageFilled}
      />
      <TimelineRow
        label="Divorce"
        filled={divorceFilled}
        summaryLine={divorceSummary}
        onEdit={() => setDivorceOpen(true)}
        onDelete={() => setDivorceFact(emptyKeyFactFormState())}
        showDelete={divorceFilled}
      />

      {familyId ? (
        <Link
          href={`/admin/events/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}`}
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex w-full items-center justify-center gap-2 border-dashed")}
        >
          <Plus className="size-4" aria-hidden />
          Add event
        </Link>
      ) : null}

      {mode === "create" ? (
        <p className="text-xs text-muted-foreground">
          Marriage and divorce are saved when you finish with Create new family.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Use Save family to store marriage and divorce details.</p>
      )}

      <Dialog open={marriageOpen} onOpenChange={setMarriageOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Marriage</DialogTitle>
          <DialogDescription>Date and place for this marriage.</DialogDescription>
          <KeyFactSection title="Details" fact={marriageFact} onChange={setMarriageFact} defaultOpen />
          <DialogFooter>
            <Button type="button" onClick={() => setMarriageOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={divorceOpen} onOpenChange={setDivorceOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Divorce</DialogTitle>
          <DialogDescription>Date and place when this relationship ended.</DialogDescription>
          <KeyFactSection title="Details" fact={divorceFact} onChange={setDivorceFact} defaultOpen />
          <DialogFooter>
            <Button type="button" onClick={() => setDivorceOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
