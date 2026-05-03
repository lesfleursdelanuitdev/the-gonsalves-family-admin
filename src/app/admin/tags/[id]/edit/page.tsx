"use client";

import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { TagEditForm } from "@/components/admin/tag-editor/TagEditForm";

export default function AdminTagEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <NoteEditorPageLayout backHref="/admin/tags" backLabel="Tags" fullWidth>
        <p className="text-muted-foreground">Missing tag id.</p>
      </NoteEditorPageLayout>
    );
  }

  return (
    <NoteEditorPageLayout backHref="/admin/tags" backLabel="Tags" fullWidth hideBackLink>
      <TagEditForm mode="edit" tagId={id} hideBackLink contextReturnHref="/admin/tags" />
    </NoteEditorPageLayout>
  );
}
