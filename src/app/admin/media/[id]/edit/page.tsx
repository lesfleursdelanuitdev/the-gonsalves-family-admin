"use client";

import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { MediaEditorForm, type MediaEditorInitial } from "@/components/admin/MediaEditorForm";
import { useAdminMediaItem } from "@/hooks/useAdminMedia";

export default function AdminMediaEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminMediaItem(id);
  const media = data?.media as MediaEditorInitial | undefined;

  if (!id) {
    return (
      <NoteEditorPageLayout backHref="/admin/media" backLabel="Media">
        <p className="text-muted-foreground">Missing media id.</p>
      </NoteEditorPageLayout>
    );
  }

  if (isLoading) {
    return (
      <NoteEditorPageLayout backHref="/admin/media" backLabel="Media">
        <p className="text-muted-foreground">Loading…</p>
      </NoteEditorPageLayout>
    );
  }

  if (error || !media) {
    return (
      <NoteEditorPageLayout backHref="/admin/media" backLabel="Media">
        <p className="text-destructive">Could not load this media item.</p>
      </NoteEditorPageLayout>
    );
  }

  return (
    <NoteEditorPageLayout backHref="/admin/media" backLabel="Media" fullWidth>
      <MediaEditorForm key={id} mode="edit" mediaId={id} initialMedia={media} hideBackLink />
    </NoteEditorPageLayout>
  );
}
