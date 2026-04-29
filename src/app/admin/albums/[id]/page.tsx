"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { AdminAlbumCuratedClient } from "@/app/admin/albums/[id]/AdminAlbumCuratedClient";

export default function AdminAlbumViewPage() {
  const params = useParams();
  const albumId = typeof params.id === "string" ? params.id : "";

  const shell = (body: ReactNode) => (
    <NoteEditorPageLayout backHref="/admin/albums" backLabel="Albums" fullWidth>
      {body}
    </NoteEditorPageLayout>
  );

  if (!albumId) {
    return shell(<p className="text-sm text-muted-foreground">Invalid album.</p>);
  }

  return shell(
    <div className="space-y-6">
      <AdminAlbumCuratedClient albumId={albumId} />
    </div>,
  );
}
