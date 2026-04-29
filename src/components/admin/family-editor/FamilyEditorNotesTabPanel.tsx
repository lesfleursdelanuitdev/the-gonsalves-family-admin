"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FamilyEditNoteJoin } from "@/components/admin/family-editor/family-editor-types";

export type FamilyEditorNotesTabPanelProps = {
  noCardShell?: boolean;
  mode: "create" | "edit";
  familyId: string;
  familyNewEventLabel: string;
  familyNotes: FamilyEditNoteJoin[];
};

export function FamilyEditorNotesTabPanel({
  noCardShell = true,
  mode,
  familyId,
  familyNewEventLabel,
  familyNotes,
}: FamilyEditorNotesTabPanelProps) {
  const returnTo =
    mode === "create"
      ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
      : `/admin/families/${familyId}/edit`;

  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Finish creating the family before adding notes.</p>
    ) : familyNotes.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No notes added yet.</p>
      </div>
    ) : (
      familyNotes.map((jn) => {
        const n = jn.note;
        const nid = String(n.id);
        return (
          <EmbeddedNoteCard key={nid} noteId={nid} xref={String(n.xref ?? "")} content={String(n.content ?? "")} />
        );
      })
    );

  const addHref =
    mode === "edit" && familyId
      ? `/admin/notes/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`
      : null;

  const inner = (
    <div className="space-y-4">
      {listBlock}
      {addHref ? (
        <Link
          href={addHref}
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex w-full items-center justify-center gap-2 border-dashed")}
        >
          <Plus className="size-4" aria-hidden />
          Add note
        </Link>
      ) : null}
    </div>
  );

  if (noCardShell) {
    return (
      <div role="region" aria-label="Notes" className="space-y-3">
        {inner}
      </div>
    );
  }

  return <div role="region" aria-label="Notes">{inner}</div>;
}
