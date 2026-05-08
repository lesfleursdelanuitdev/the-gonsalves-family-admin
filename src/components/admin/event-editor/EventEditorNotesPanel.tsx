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

export type EventEditorNoteJoin = {
  note: { id: string; xref?: string | null; content?: string | null };
};

export type EventEditorNotesPanelProps = {
  mode: "create" | "edit";
  eventId: string | undefined;
  /** Short label for the new-note flow (e.g. event title). */
  eventLabel: string;
  eventNotes: EventEditorNoteJoin[];
  onNotesChanged?: () => void;
};

export function EventEditorNotesPanel({
  mode,
  eventId,
  eventLabel,
  eventNotes,
  onNotesChanged,
}: EventEditorNotesPanelProps) {
  const returnTo = eventId ? `/admin/events/${eventId}/edit` : "/admin/events";

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);

  const linkedNoteIds = useMemo(
    () => new Set(eventNotes.map((jn) => String(jn.note.id))),
    [eventNotes],
  );

  const onPickExistingNote = async (note: AdminNoteListItem) => {
    if (!eventId || linkedNoteIds.has(note.id)) return;
    setAttachBusy(true);
    try {
      await postJson(`/api/admin/events/${eventId}/notes`, { noteId: note.id });
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
    mode === "create" || !eventId ? (
      <p className="text-sm text-muted-foreground">Save the event first, then you can add or attach notes.</p>
    ) : eventNotes.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No notes added yet.</p>
      </div>
    ) : (
      eventNotes.map((jn) => {
        const n = jn.note;
        const nid = String(n.id);
        return (
          <EmbeddedNoteCard key={nid} noteId={nid} xref={String(n.xref ?? "")} content={String(n.content ?? "")} />
        );
      })
    );

  const addHref =
    mode === "edit" && eventId
      ? `/admin/notes/new?eventId=${encodeURIComponent(eventId)}&eventLabel=${encodeURIComponent(eventLabel || "Event")}&returnTo=${encodeURIComponent(returnTo)}`
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
    mode === "edit" && eventId ? (
      <Dialog open={attachOpen} onOpenChange={(open) => setAttachOpen(open)}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto">
          <DialogTitle>Attach an existing note</DialogTitle>
          <DialogDescription>
            Search by text, XREF, linked person, family, or event, then choose <strong>Add note</strong> on a result to
            link it to this event.
          </DialogDescription>
          <div className={cn(attachBusy && "pointer-events-none opacity-60")}>
            <NotesPicker
              idPrefix={`event-notes-${eventId}`}
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

  return (
    <div className="space-y-4" role="region" aria-label="Notes">
      {actionButtons ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{actionButtons}</div> : null}
      {listBlock}
      {attachDialog}
    </div>
  );
}
