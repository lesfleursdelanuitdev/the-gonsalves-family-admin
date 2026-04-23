"use client";

import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { MediaEditorForm } from "@/components/admin/MediaEditorForm";

export default function AdminMediaNewPage() {
  return (
    <NoteEditorPageLayout backHref="/admin/media" backLabel="Media">
      <MediaEditorForm mode="create" hideBackLink />
    </NoteEditorPageLayout>
  );
}
