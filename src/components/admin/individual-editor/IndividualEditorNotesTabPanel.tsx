"use client";

import Link from "next/link";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IndividualEditNoteJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorNotesTabPanelProps = {
  hidden: boolean;
  /** When true, omit the outer Card (used inside PersonEditorSectionCard). */
  noCardShell?: boolean;
  mode: "create" | "edit";
  individualId: string;
  individualNewEventLabel: string;
  individualNotes: IndividualEditNoteJoin[];
};

export function IndividualEditorNotesTabPanel({
  hidden,
  noCardShell = false,
  mode,
  individualId,
  individualNewEventLabel,
  individualNotes,
}: IndividualEditorNotesTabPanelProps) {
  const returnTo = `/admin/individuals/${individualId}/edit`;

  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Save this person first to add notes to their record.</p>
    ) : individualNotes.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No notes added yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Capture research, stories, or reminders here.</p>
      </div>
    ) : (
      individualNotes.map((jn) => {
        const n = jn.note;
        const nid = String(n.id);
        return (
          <EmbeddedNoteCard
            key={nid}
            noteId={nid}
            xref={String(n.xref ?? "")}
            content={String(n.content ?? "")}
          />
        );
      })
    );

  const body = noCardShell ? (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-end gap-3">
        {mode === "edit" && individualId ? (
          <Link
            href={`/admin/notes/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "min-h-11 shrink-0")}
          >
            Add note
          </Link>
        ) : null}
      </div>
      <div className="space-y-3">{listBlock}</div>
    </>
  ) : (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg">Notes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Notes linked to this person. Edit content on each note&apos;s admin page.
          </p>
        </div>
        {mode === "edit" && individualId ? (
          <Link
            href={`/admin/notes/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Add note
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">{listBlock}</CardContent>
    </Card>
  );

  return (
    <div role="region" aria-label="Notes" hidden={hidden} className={noCardShell ? "space-y-3" : "space-y-8 pt-2"}>
      {body}
    </div>
  );
}
