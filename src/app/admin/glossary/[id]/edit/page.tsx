"use client";

import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { GlossaryEntryEditForm } from "@/components/admin/glossary-editor/GlossaryEntryEditForm";

export default function AdminGlossaryEntryEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <NoteEditorPageLayout backHref="/admin/glossary" backLabel="Words & phrases" fullWidth>
        <p className="text-muted-foreground">Missing entry id.</p>
      </NoteEditorPageLayout>
    );
  }

  return (
    <NoteEditorPageLayout backHref="/admin/glossary" backLabel="Words & phrases" fullWidth hideBackLink>
      <GlossaryEntryEditForm mode="edit" entryId={id} contextReturnHref="/admin/glossary" />
    </NoteEditorPageLayout>
  );
}
