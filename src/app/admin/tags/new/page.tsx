"use client";

import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { TagEditForm } from "@/components/admin/tag-editor/TagEditForm";

export default function AdminNewTagPage() {
  return (
    <NoteEditorPageLayout backHref="/admin/tags" backLabel="Tags" fullWidth hideBackLink>
      <TagEditForm mode="create" hideBackLink contextReturnHref="/admin/tags" />
    </NoteEditorPageLayout>
  );
}
