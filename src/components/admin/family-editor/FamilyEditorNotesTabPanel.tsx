"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { NotesPicker } from "@/components/admin/NotesPicker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ApiError, postJson } from "@/lib/infra/api";
import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import type { FamilyEditNoteJoin } from "@/components/admin/family-editor/family-editor-types";

export type FamilyEditorNotesTabPanelProps = {
  noCardShell?: boolean;
  mode: "create" | "edit";
  familyId: string;
  familyNewEventLabel: string;
  familyNotes: FamilyEditNoteJoin[];
  /** Called after a note is linked so the editor can refetch family detail. */
  onNotesChanged?: () => void;
};

export function FamilyEditorNotesTabPanel({
  noCardShell = true,
  mode,
  familyId,
  familyNewEventLabel,
  familyNotes,
  onNotesChanged,
}: FamilyEditorNotesTabPanelProps) {
  const returnTo =
    mode === "create"
      ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
      : `/admin/families/${familyId}/edit`;

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);

  const linkedNoteIds = useMemo(
    () => new Set(familyNotes.map((jn) => String(jn.note.id))),
    [familyNotes],
  );

  const onPickExistingNote = async (note: AdminNoteListItem) => {
    if (linkedNoteIds.has(note.id)) return;
    setAttachBusy(true);
    try {
      await postJson(`/api/admin/families/${familyId}/notes`, { noteId: note.id });
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

  const actionButtons =
    addHref != null ? (
      <div className="flex flex-wrap items-stretch justify-stretch gap-2 sm:justify-end">
        <Button type="button" variant="outline" size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => setAttachOpen(true)}>
          Attach existing note
        </Button>
        <Link
          href={addHref}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "inline-flex min-h-11 flex-1 items-center justify-center sm:flex-none",
          )}
        >
          Add new note
        </Link>
      </div>
    ) : null;

  const attachDialog =
    mode === "edit" && familyId ? (
      <Dialog open={attachOpen} onOpenChange={(open) => setAttachOpen(open)}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto">
          <DialogTitle>Attach an existing note</DialogTitle>
          <DialogDescription>
            Search by text, XREF, linked person, family, or event, then choose <strong>Add note</strong> on a result to
            link it to this family.
          </DialogDescription>
          <div className={cn(attachBusy && "pointer-events-none opacity-60")}>
            <NotesPicker
              idPrefix={`fam-notes-${familyId}`}
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
    ) : null;

  const inner = (
    <div className="space-y-4">
      {actionButtons ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{actionButtons}</div> : null}
      {listBlock}
      {attachDialog}
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
