"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { PaginationState, Updater } from "@tanstack/react-table";
import {
  Eye,
  FileImage,
  FileText,
  Film,
  Headphones,
  ImagePlus,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MediaPickerModal } from "@/components/admin/media-picker/MediaPickerModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { selectClassName } from "@/components/data-viewer/constants";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { ADMIN_MEDIA_QUERY_KEY, useAdminMedia, type AdminMediaListItem } from "@/hooks/useAdminMedia";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { inferAdminMediaCategory } from "@/lib/admin/infer-admin-media-category";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 100] as const;

const DEFAULT_PAGE_SIZE = 10;

function albumLinkIdFor(media: AdminMediaListItem, albumId: string): string | undefined {
  return media.albumLinks?.find((l) => l.album.id === albumId)?.id;
}

const kindIcon = {
  photo: FileImage,
  document: FileText,
  video: Film,
  audio: Headphones,
} as const;

function AlbumMediaCard({
  media,
  albumId,
  manageable,
  removing,
  onRemove,
}: {
  media: AdminMediaListItem;
  albumId: string;
  manageable: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const router = useRouter();
  const fileRef = (media.fileRef ?? "").trim();
  const title =
    (media.title ?? "").trim() ||
    (fileRef ? (fileRef.split("/").pop() ?? "").trim() : "") ||
    "Media";
  const kind = inferAdminMediaCategory(media.form, media.fileRef);
  const Icon = kindIcon[kind];
  const linkId = manageable ? albumLinkIdFor(media, albumId) : undefined;
  const thumbSrc =
    fileRef && isLikelyRasterImage(fileRef, media.form ?? "", null) ? resolveMediaImageSrc(fileRef) : null;
  const resolvedRef = fileRef ? resolveMediaImageSrc(fileRef) : null;
  const videoSrc =
    fileRef && resolvedRef && !thumbSrc && isLikelyVideoFile(fileRef, media.form) && isPlayableVideoRef(fileRef)
      ? resolvedRef
      : null;

  const viewHref = `/admin/media/${media.id}`;
  const editHref = `/admin/media/${media.id}/edit`;

  return (
    <Card className="group h-full min-h-0 overflow-hidden border-base-content/12 pt-0 shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15">
      <div className="relative aspect-[4/3] w-full shrink-0 border-b border-base-content/10 bg-gradient-to-b from-base-200/70 to-base-300/35">
        {thumbSrc ? (
          <MediaRasterImage
            fileRef={fileRef}
            form={media.form ?? ""}
            src={thumbSrc}
            alt={title}
            fill
            sizes="(max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : videoSrc ? (
          <video
            src={videoSrc}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />
        ) : (
          <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <Icon className="size-11 shrink-0 text-muted-foreground/55" aria-hidden />
            <span className="line-clamp-2 max-w-full text-xs font-medium leading-snug text-base-content/80">
              {title}
            </span>
          </div>
        )}
        <span className="pointer-events-none absolute left-2 top-2 z-[2] rounded-full border border-base-content/10 bg-base-100/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/80">
          {kind === "photo"
            ? "Photo"
            : kind === "video"
              ? "Video"
              : kind === "audio"
                ? "Audio"
                : "Doc"}
        </span>
        <Link
          href={viewHref}
          className="absolute inset-0 z-[1] block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 [@media(hover:none)]:pointer-events-none"
          aria-label={`View ${title}`}
        />
        <div
          className="absolute right-1.5 top-1.5 z-[3] hidden [@media(hover:none)]:block"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-8 items-center justify-center rounded-md border border-white/20 bg-black/50 text-white backdrop-blur-sm"
              aria-label="Card actions"
            >
              <MoreVertical className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(viewHref)}>
                <Eye className="size-4 opacity-70" aria-hidden /> View
              </DropdownMenuItem>
              {manageable ? (
                <>
                  <DropdownMenuItem onClick={() => router.push(editHref)}>
                    <Pencil className="size-4 opacity-70" aria-hidden /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!linkId || removing}
                    onClick={() => {
                      if (!linkId || removing) return;
                      onRemove();
                    }}
                  >
                    {removing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                    Remove from album
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CardContent className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-base-content">{title}</p>
        <div className="flex flex-wrap gap-2 [@media(hover:none)]:hidden">
          <Link
            href={viewHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex h-8 items-center")}
          >
            <Eye className="mr-1 size-3.5" aria-hidden />
            View
          </Link>
          {manageable ? (
            <>
              <Link
                href={editHref}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex h-8 items-center")}
              >
                <Pencil className="mr-1 size-3.5" aria-hidden />
                Edit
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!linkId || removing}
                onClick={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
                <span className="ml-1">Remove</span>
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AlbumMediaGridSection({
  albumId,
  manageable = true,
}: {
  albumId: string;
  /** When false, hide add/remove and the media picker (view page). */
  manageable?: boolean;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  }, [albumId]);

  const listOpts = useMemo(
    () => ({
      albumId,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    }),
    [albumId, pagination.pageIndex, pagination.pageSize],
  );

  const excludeListOpts = useMemo(
    () => ({ albumId, limit: ADMIN_LIST_MAX_LIMIT, offset: 0 }),
    [albumId],
  );

  const { data, isLoading } = useAdminMedia(listOpts, Boolean(albumId));
  const { data: allAlbumForExclude } = useAdminMedia(excludeListOpts, Boolean(albumId && manageable));

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  useEffect(() => {
    if (total === 0) return;
    const maxPage = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
    if (pagination.pageIndex > maxPage) {
      setPagination((p) => ({ ...p, pageIndex: maxPage }));
    }
  }, [total, pagination.pageIndex, pagination.pageSize]);

  const items = data?.media ?? [];
  const inAlbumIds = useMemo(
    () => new Set((allAlbumForExclude?.media ?? []).map((m) => m.id)),
    [allAlbumForExclude?.media],
  );

  const invalidateAlbumMedia = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
    await qc.invalidateQueries({ queryKey: ["admin", "albums", "detail", albumId] });
  }, [qc, albumId]);

  const onRemoveFromAlbum = useCallback(
    async (media: AdminMediaListItem) => {
      const linkId = albumLinkIdFor(media, albumId);
      if (!linkId) {
        toast.error("Could not find this album link.");
        return;
      }
      const label = (media.title ?? "").trim() || "this item";
      if (!window.confirm(`Remove “${label}” from this album only? The file stays in the archive.`)) return;
      setRemovingId(media.id);
      try {
        await deleteJson(`/api/admin/media/${media.id}/album-links/${linkId}`);
        await invalidateAlbumMedia();
        toast.success("Removed from album.");
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Could not remove from album.");
      } finally {
        setRemovingId(null);
      }
    },
    [albumId, invalidateAlbumMedia],
  );

  const onPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const pageSizeSelectId = `album-media-page-size-${albumId}`;

  return (
    <section className="space-y-4 rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-base-content">Media in this album</h2>
          <p className="text-sm text-muted-foreground">
            {manageable
              ? "Same card layout as the media library. Add items from the archive or upload new files."
              : "Photos, videos, and documents linked to this album."}
          </p>
        </div>
        {manageable ? (
          <Button type="button" onClick={() => setAddOpen(true)} className="shrink-0 sm:self-start">
            <ImagePlus className="mr-2 size-4" aria-hidden />
            Add media…
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex min-h-[10rem] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin shrink-0" aria-hidden />
          Loading album media…
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[8rem] flex-col items-center justify-center gap-3 rounded-box border border-dashed border-base-content/15 bg-base-100/40 px-4 py-8 text-center text-sm text-muted-foreground">
          <p>No media in this album yet.</p>
          {manageable ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              Add media…
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {items.map((m) => (
              <AlbumMediaCard
                key={m.id}
                media={m}
                albumId={albumId}
                manageable={manageable}
                removing={removingId === m.id}
                onRemove={() => void onRemoveFromAlbum(m)}
              />
            ))}
          </div>

          <div className="sticky bottom-0 z-[1] border-t border-base-content/[0.08] bg-base-100/95 px-0 py-3 backdrop-blur-md">
            <DataViewerPagination
              pagination={pagination}
              pageCount={pageCount}
              filteredTotal={total}
              onPaginationChange={onPaginationChange}
              leading={
                <>
                  <Label htmlFor={pageSizeSelectId} className="shrink-0 text-sm text-muted-foreground">
                    Per page
                  </Label>
                  <select
                    id={pageSizeSelectId}
                    className={cn(selectClassName, "w-auto min-w-[5.5rem]")}
                    value={pagination.pageSize}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const nextSize = PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])
                        ? n
                        : DEFAULT_PAGE_SIZE;
                      setPagination({ pageIndex: 0, pageSize: nextSize });
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </>
              }
            />
          </div>
        </>
      )}

      {manageable ? (
        <MediaPickerModal
          open={addOpen}
          onOpenChange={setAddOpen}
          targetType="album"
          targetId={albumId}
          mode="multiple"
          canLink
          canUpload
          excludeMediaIds={inAlbumIds}
          onAttach={() => void invalidateAlbumMedia()}
        />
      ) : null}
    </section>
  );
}
