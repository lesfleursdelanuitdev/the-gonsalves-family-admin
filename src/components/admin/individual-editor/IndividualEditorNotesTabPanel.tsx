"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { NotesPicker } from "@/components/admin/NotesPicker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ApiError, postJson } from "@/lib/infra/api";
import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import type { IndividualEditNoteJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorNotesTabPanelProps = {
  hidden: boolean;
  /** When true, omit the outer Card (used inside PersonEditorSectionCard). */
  noCardShell?: boolean;
  mode: "create" | "edit";
  individualId: string;
  individualNewEventLabel: string;
  individualNotes: IndividualEditNoteJoin[];
  /** Called after a note is linked so the editor can refetch (e.g. `router.refresh()`). */
  onNotesChanged?: () => void;
};

export function IndividualEditorNotesTabPanel({
  hidden,
  noCardShell = false,
  mode,
  individualId,
  individualNewEventLabel,
  individualNotes,
  onNotesChanged,
}: IndividualEditorNotesTabPanelProps) {
  const returnTo = `/admin/individuals/${individualId}/edit`;
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);

  const linkedNoteIds = useMemo(
    () => new Set(individualNotes.map((jn) => String(jn.note.id))),
    [individualNotes],
  );

  const onPickExistingNote = async (note: AdminNoteListItem) => {
    if (linkedNoteIds.has(note.id)) return;
    setAttachBusy(true);
    try {
      await postJson(`/api/admin/individuals/${individualId}/notes`, { noteId: note.id });
      toast.success(`Linked note ${note.xref?.trim() || note.id}.`);
      setAttachOpen(false);
      onNotesChanged?.();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not link note.";
      toast.error(msg);
    } finally {
      setAttachBusy(false);
    }
  };

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

  const addNoteHref = `/admin/notes/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`;

  const actionButtons =
    mode === "edit" && individualId ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => setAttachOpen(true)}>
          Attach existing note
        </Button>
        <Link href={addNoteHref} className={cn(buttonVariants({ variant: "default", size: "sm" }), "min-h-11 shrink-0")}>
          Add new note
        </Link>
      </div>
    ) : null;

  const cardHeaderActions =
    mode === "edit" && individualId ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAttachOpen(true)}>
          Attach existing
        </Button>
        <Link href={addNoteHref} className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0")}>
          Add new note
        </Link>
      </div>
    ) : null;

  const attachDialog = (
    <Dialog open={attachOpen} onOpenChange={(open) => setAttachOpen(open)}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto">
        <DialogTitle>Attach an existing note</DialogTitle>
        <DialogDescription>
          Search by text, XREF, linked person, family, or event, then choose <strong>Add note</strong> on a result to
          link it to this person.
        </DialogDescription>
        <div className={cn(attachBusy && "pointer-events-none opacity-60")}>
          <NotesPicker
            idPrefix={`ind-notes-${individualId}`}
            excludeIds={linkedNoteIds}
            onPick={onPickExistingNote}
            limit={12}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAttachOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const body = noCardShell ? (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-end gap-3">
        {actionButtons}
      </div>
      <div className="space-y-3">{listBlock}</div>
      {attachDialog}
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
        {cardHeaderActions}
      </CardHeader>
      <CardContent className="space-y-3">
        {listBlock}
        {attachDialog}
      </CardContent>
    </Card>
  );

  return (
    <div role="region" aria-label="Notes" hidden={hidden} className={noCardShell ? "space-y-3" : "space-y-8 pt-2"}>
      {body}
    </div>
  );
}
