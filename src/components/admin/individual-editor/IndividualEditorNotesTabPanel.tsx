"use client";

import Link from "next/link";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IndividualEditNoteJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorNotesTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  individualId: string;
  individualNewEventLabel: string;
  individualNotes: IndividualEditNoteJoin[];
};

export function IndividualEditorNotesTabPanel({
  hidden,
  mode,
  individualId,
  individualNewEventLabel,
  individualNotes,
}: IndividualEditorNotesTabPanelProps) {
  const returnTo = `/admin/individuals/${individualId}/edit`;

  return (
    <div
      id="individual-editor-panel-notes"
      role="tabpanel"
      aria-labelledby="individual-editor-tab-notes"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
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
        <CardContent className="space-y-3">
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              Save this person first to see notes linked to their record.
            </p>
          ) : individualNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes linked to this individual.</p>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
