"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Archive, Pencil } from "lucide-react";
import type { AlbumViewModel } from "@ligneous/album-view";
import { AlbumCoverBanner } from "@/components/admin/AlbumCoverBanner";
import { AlbumMediaGridSection } from "@/components/admin/AlbumMediaGridSection";
import { VirtualAlbumMediaGrid } from "@/components/album/VirtualAlbumMediaGrid";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AlbumViewProps = {
  model: AlbumViewModel;
  /** Toolbar actions rendered next to default Edit / Download (curated). */
  leadingToolbar?: ReactNode;
  /** Extra actions for generated sets (e.g. link to entity). */
  trailingToolbar?: ReactNode;
};

/**
 * Renders a **MediaSetViewModel** (`AlbumViewModel` alias) with `presentation: "album"` (cover + grid).
 * Same shell for curated DB sets and generated media-set views; “album” is only the layout style.
 */
export function AlbumView({ model, leadingToolbar, trailingToolbar }: AlbumViewProps) {
  const description = (model.description ?? "").trim();
  const coverId = model.coverMedia?.id?.trim() || null;
  const coverRef = model.coverMedia?.fileRef?.trim() || null;
  const coverForm = model.coverMedia?.form ?? null;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{model.title}</h1>

      <AlbumCoverBanner
        name={model.title}
        coverMediaId={coverId}
        coverFileRef={coverRef}
        coverForm={coverForm}
        isPublic={model.visibility === "public"}
        showCoverMediaLink={Boolean(coverId)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {leadingToolbar}
          {model.kind === "curated" ? (
            <p className="text-sm text-muted-foreground">Read-only overview. Edit to change details or membership.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Media from your tree for this topic — album-style layout; not a separate saved collection record.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {trailingToolbar}
          {model.kind === "curated" && model.source.type === "album" && model.canEditAlbumMetadata ? (
            <>
              <a
                href={`/api/admin/albums/${model.source.albumId}/export`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1.5")}
              >
                <Archive className="size-3.5" aria-hidden />
                Download
              </a>
              <Link
                href={`/admin/albums/${model.source.albumId}/edit`}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "inline-flex items-center gap-1.5")}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit album
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {description ? (
        <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-base-content">{description}</p>
        </div>
      ) : null}

      {model.gridMode === "junction" && model.albumId ? (
        <AlbumMediaGridSection albumId={model.albumId} manageable={model.canEditMembership} />
      ) : (
        <section className="space-y-4 rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-base-content">Media</h2>
            <p className="text-sm text-muted-foreground">
              {model.totalCount} item{model.totalCount === 1 ? "" : "s"} (images, documents, audio, video, …)
            </p>
          </div>
          <VirtualAlbumMediaGrid items={model.media} albumIdForCardContext="virtual" />
        </section>
      )}
    </div>
  );
}

/** @see {@link AlbumView} — prefer this name for the **media set** abstraction. */
export { AlbumView as MediaSetView };
