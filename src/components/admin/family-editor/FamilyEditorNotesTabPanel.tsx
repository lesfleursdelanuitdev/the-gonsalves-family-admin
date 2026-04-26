"use client";

import Link from "next/link";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FamilyEditNoteJoin } from "@/components/admin/family-editor/family-editor-types";

export type FamilyEditorNotesTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  familyId: string;
  familyNewEventLabel: string;
  familyNotes: FamilyEditNoteJoin[];
};

export function FamilyEditorNotesTabPanel({
  hidden,
  mode,
  familyId,
  familyNewEventLabel,
  familyNotes,
}: FamilyEditorNotesTabPanelProps) {
  const returnTo =
    mode === "create"
      ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
      : `/admin/families/${familyId}/edit`;

  return (
    <div
      id="family-editor-panel-notes"
      role="tabpanel"
      aria-labelledby="family-editor-tab-notes"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Notes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Notes linked to this family. Manage full text on each note&apos;s admin page.
            </p>
          </div>
          <Link
            href={`/admin/notes/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Add note
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {familyNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes linked to this family.</p>
          ) : (
            familyNotes.map((jn) => {
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
