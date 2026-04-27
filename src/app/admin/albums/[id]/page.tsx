"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { AlbumCoverBanner } from "@/components/admin/AlbumCoverBanner";
import { AlbumMediaGridSection } from "@/components/admin/AlbumMediaGridSection";
import { buttonVariants } from "@/components/ui/button";
import { useAdminAlbum } from "@/hooks/useAdminAlbums";
import { cn } from "@/lib/utils";

export default function AdminAlbumViewPage() {
  const params = useParams();
  const albumId = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminAlbum(albumId || undefined);

  const shell = (body: ReactNode) => (
    <NoteEditorPageLayout backHref="/admin/albums" backLabel="Albums" fullWidth>
      {body}
    </NoteEditorPageLayout>
  );

  if (!albumId) {
    return shell(<p className="text-sm text-muted-foreground">Invalid album.</p>);
  }

  if (isLoading) {
    return shell(<p className="text-sm text-muted-foreground">Loading…</p>);
  }

  if (error || !data?.album) {
    return shell(
      <div className="space-y-4">
        <p className="text-sm text-destructive">Album not found or could not be loaded.</p>
        <Link href="/admin/albums" className={cn(buttonVariants({ variant: "outline" }), "inline-flex w-fit")}>
          Back to albums
        </Link>
      </div>,
    );
  }

  const album = data.album;
  const description = (album.description ?? "").trim();

  return shell(
    <div className="space-y-6">
      <h1 className="sr-only">{album.name}</h1>

      <AlbumCoverBanner
        name={album.name}
        coverMediaId={album.coverMediaId}
        coverFileRef={album.coverFileRef ?? null}
        coverForm={album.coverForm ?? null}
        isPublic={album.isPublic}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Read-only overview. Edit to change details or media.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/albums/${albumId}/export`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1.5")}
          >
            <Archive className="size-3.5" aria-hidden />
            Download
          </a>
          <Link
            href={`/admin/albums/${albumId}/edit`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "inline-flex items-center gap-1.5")}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit album
          </Link>
        </div>
      </div>

      {description ? (
        <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-base-content">{description}</p>
        </div>
      ) : null}

      <AlbumMediaGridSection albumId={albumId} manageable={false} />
    </div>,
  );
}
