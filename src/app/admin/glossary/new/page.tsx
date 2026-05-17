"use client";

import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { GlossaryEntryEditForm } from "@/components/admin/glossary-editor/GlossaryEntryEditForm";

export default function AdminNewGlossaryEntryPage() {
  return (
    <NoteEditorPageLayout backHref="/admin/glossary" backLabel="Words & phrases" fullWidth hideBackLink>
      <GlossaryEntryEditForm mode="create" contextReturnHref="/admin/glossary" />
    </NoteEditorPageLayout>
  );
}
