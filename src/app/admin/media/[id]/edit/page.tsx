"use client";

import { useParams, useSearchParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { MediaEditorForm, type MediaEditorInitial } from "@/components/admin/MediaEditorForm";
import { EntityOpenQuestionsSection } from "@/components/admin/EntityOpenQuestionsSection";
import { useAdminMediaItem } from "@/hooks/useAdminMedia";

export default function AdminMediaEditPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const scopeParam = searchParams.get("scope");
  const scope =
    scopeParam === "site-assets" || scopeParam === "my-media" ? scopeParam : "family-tree";

  const { data, isLoading, error } = useAdminMediaItem(id, scope);
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

  const mediaTitle =
    typeof media.title === "string" && media.title.trim()
      ? media.title.trim()
      : typeof media.xref === "string" && media.xref.trim()
        ? media.xref.trim()
        : id;

  return (
    <NoteEditorPageLayout backHref="/admin/media" backLabel="Media" fullWidth hideBackLink>
      <div className="space-y-8">
        <MediaEditorForm key={`${scope}:${id}`} mode="edit" mediaId={id} initialMedia={media} hideBackLink scope={scope} />
        {scope === "family-tree" ? (
          <EntityOpenQuestionsSection entityType="media" entityId={id} variant="edit" entityLabel={mediaTitle} />
        ) : null}
      </div>
    </NoteEditorPageLayout>
  );
}
