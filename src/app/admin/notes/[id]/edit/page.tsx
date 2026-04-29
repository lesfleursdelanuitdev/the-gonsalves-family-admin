"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { NoteForm } from "@/components/admin/NoteForm";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { useAdminNote } from "@/hooks/useAdminNotes";
import { noteDetailToSelectedLinks } from "@/lib/forms/note-form-links";

export default function AdminEditNotePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminNote(id);

  const note = data?.note as Record<string, unknown> | undefined;

  const shell = (body: ReactNode) => (
    <NoteEditorPageLayout backHref="/admin/notes" backLabel="Notes" hideBackLink>
      {body}
    </NoteEditorPageLayout>
  );

  if (!id) {
    return shell(<p className="text-muted-foreground">Missing note id.</p>);
  }

  if (isLoading) {
    return shell(<p className="text-muted-foreground">Loading…</p>);
  }

  if (error || !note) {
    return shell(<p className="text-destructive">Could not load this note.</p>);
  }

  return shell(
    <NoteForm
      key={id}
      hideBackLink
      mode="edit"
      noteId={id}
      initialContent={typeof note.content === "string" ? note.content : ""}
      readOnlyXref={typeof note.xref === "string" ? note.xref : null}
      initialIsTopLevel={Boolean(note.isTopLevel)}
      initialLinks={noteDetailToSelectedLinks(note)}
    />,
  );
}
