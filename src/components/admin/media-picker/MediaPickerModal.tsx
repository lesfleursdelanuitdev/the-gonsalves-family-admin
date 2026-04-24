"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { MediaSearchBar } from "@/components/admin/media-picker/MediaSearchBar";
import { AlbumFilter } from "@/components/admin/media-picker/AlbumFilter";
import { TagFilter } from "@/components/admin/media-picker/TagFilter";
import { MediaGrid } from "@/components/admin/media-picker/MediaGrid";
import { SelectedMediaBar } from "@/components/admin/media-picker/SelectedMediaBar";
import { QuickUploadPanel } from "@/components/admin/media-picker/QuickUploadPanel";
import type { MediaPickerMode, MediaPickerPurpose, MediaPickerTargetType } from "@/components/admin/media-picker/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ADMIN_MEDIA_QUERY_KEY, useAdminMedia, type AdminMediaListItem } from "@/hooks/useAdminMedia";
import type { AdminAlbumsListResponse } from "@/hooks/useAdminAlbums";
import type { AdminTagsListResponse } from "@/hooks/useAdminTags";
import { ApiError, fetchJson, postFormData, postJson } from "@/lib/infra/api";
import { attachMediaToTarget, isMediaPickerTargetLinkable } from "@/lib/admin/media-picker-attach";
import { titleFromUploadedFilename } from "@/lib/admin/media-upload-title";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 36;

function pickMediaCategory(
  allowed?: readonly ("photo" | "document" | "video")[],
): "photo" | "document" | "video" | undefined {
  if (!allowed || allowed.length !== 1) return undefined;
  return allowed[0];
}

export function MediaPickerModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  mode = "multiple",
  purpose: _purpose,
  allowedTypes,
  initialSelectedIds,
  excludeMediaIds,
  onAttach,
  onUploadComplete,
  canUpload = true,
  canLink = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: MediaPickerTargetType;
  targetId: string;
  mode?: MediaPickerMode;
  purpose?: MediaPickerPurpose;
  allowedTypes?: readonly ("photo" | "document" | "video")[];
  initialSelectedIds?: readonly string[];
  excludeMediaIds?: ReadonlySet<string>;
  onAttach?: (media: AdminMediaListItem[]) => void;
  onUploadComplete?: (media: AdminMediaListItem[]) => void;
  canUpload?: boolean;
  canLink?: boolean;
}) {
  void _purpose;
  const qc = useQueryClient();
  const baseId = useId();
  const [q, setQ] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [tagId, setTagId] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [merged, setMerged] = useState<AdminMediaListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []));

  const debouncedQ = useDebouncedValue(q.trim(), 280);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setAlbumId("");
    setTagId("");
    setSelected(new Set(mode === "single" && initialSelectedIds?.[0] ? [initialSelectedIds[0]] : []));
  }, [open, mode, initialSelectedIds]);

  const mediaCategory = useMemo(() => pickMediaCategory(allowedTypes), [allowedTypes]);

  useEffect(() => {
    if (!open) return;
    setListOffset(0);
    setMerged([]);
  }, [open, debouncedQ, albumId, tagId, mediaCategory]);

  const listOpts = useMemo(
    () => ({
      q: debouncedQ || undefined,
      albumId: albumId || undefined,
      tagId: tagId || undefined,
      mediaCategory,
      limit: PAGE_SIZE,
      offset: listOffset,
    }),
    [debouncedQ, albumId, tagId, mediaCategory, listOffset],
  );

  const { data, isLoading, isFetching } = useAdminMedia(listOpts, open);

  const albumsQs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "200");
    p.set("offset", "0");
    return p.toString();
  }, []);
  const tagsQs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "300");
    p.set("offset", "0");
    return p.toString();
  }, []);

  const { data: albumsRes } = useQuery({
    queryKey: ["admin", "albums", albumsQs],
    queryFn: () => fetchJson<AdminAlbumsListResponse>(`/api/admin/albums?${albumsQs}`),
    enabled: open,
  });
  const { data: tagsRes } = useQuery({
    queryKey: ["admin", "tags", tagsQs],
    queryFn: () => fetchJson<AdminTagsListResponse>(`/api/admin/tags?${tagsQs}`),
    enabled: open,
  });

  useEffect(() => {
    if (!data?.media) return;
    if (listOffset === 0) setMerged(data.media);
    else setMerged((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev];
      for (const m of data.media) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          next.push(m);
        }
      }
      return next;
    });
  }, [data, listOffset]);

  const albums = albumsRes?.albums ?? [];
  const tags = tagsRes?.tags ?? [];

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (mode === "single") {
          next.clear();
          next.add(id);
          return next;
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [mode],
  );

  const [attaching, setAttaching] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAttach = async () => {
    if (!canLink) {
      toast.error("You do not have permission to link media here.");
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) {
      toast.message("Select at least one item.");
      return;
    }
    if (!isMediaPickerTargetLinkable(targetType)) {
      toast.error("Automatic linking is not configured for this record type yet.");
      const picked = merged.filter((m) => ids.includes(m.id));
      onAttach?.(picked);
      onOpenChange(false);
      return;
    }

    setAttaching(true);
    try {
      const picked: AdminMediaListItem[] = [];
      for (const mid of ids) {
        await attachMediaToTarget(mid, targetType, targetId);
        const row = merged.find((m) => m.id === mid);
        if (row) picked.push(row);
      }
      await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
      toast.success(ids.length === 1 ? "Media attached." : `${ids.length} items attached.`);
      onAttach?.(picked);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not attach media.";
      toast.error(msg);
    } finally {
      setAttaching(false);
    }
  };

  const quickLinkSupported = isMediaPickerTargetLinkable(targetType) && canLink;

  const handleQuickUploadFiles = async (files: FileList | null) => {
    if (!files?.length || !canUpload) return;
    if (!quickLinkSupported && targetType !== "story" && targetType !== "document") {
      toast.error("Upload is not available for this target until linking is supported.");
      return;
    }
    setUploading(true);
    const created: AdminMediaListItem[] = [];
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await postFormData<{
          fileRef: string;
          suggestedForm: string | null;
          originalName: string;
        }>("/api/admin/media/upload", fd);
        const title = titleFromUploadedFilename(up.originalName || file.name);
        const body: Record<string, unknown> = {
          fileRef: up.fileRef,
          form: up.suggestedForm ?? null,
          title,
        };
        if (targetType === "individual") body.linkedIndividualId = targetId;
        else if (targetType === "family") body.linkedFamilyId = targetId;
        else if (targetType === "event") body.linkedEventId = targetId;
        const res = await postJson<{ media: AdminMediaListItem }>("/api/admin/media", body);
        const mediaRow = res.media as AdminMediaListItem;
        if (targetType === "album") {
          await postJson(`/api/admin/media/${mediaRow.id}/album-links`, { albumId: targetId });
        } else if (targetType === "source") {
          await postJson(`/api/admin/media/${mediaRow.id}/source-media`, { sourceId: targetId });
        } else if (targetType === "place") {
          await postJson(`/api/admin/media/${mediaRow.id}/place-media`, { placeId: targetId });
        }
        created.push(mediaRow);
        if (mode === "single") setSelected(new Set([mediaRow.id]));
        else setSelected((s) => new Set(s).add(mediaRow.id));
      }
      await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
      if (targetType === "story" || targetType === "document") {
        toast.message(
          "Media created in the library. Link it from the story or document editor when that workflow is available.",
        );
      } else {
        toast.success(created.length === 1 ? "Upload complete." : `${created.length} files uploaded.`);
      }
      onUploadComplete?.(created);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const hasMore = Boolean(data?.hasMore);
  const gridLoading = isLoading || (isFetching && listOffset === 0 && merged.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0",
          "border-base-content/15 bg-[color-mix(in_oklch,var(--color-base-100)_88%,var(--color-warning)_12%)] shadow-xl shadow-black/20",
        )}
      >
        <div className="border-b border-base-content/10 bg-base-100/60 px-4 py-3 sm:px-5">
          <DialogTitle className="text-lg font-semibold tracking-tight text-base-content">Add media</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Browse the archive, filter by album or tag, or upload. Attach links this record; edit full details on the media page.
          </DialogDescription>
        </div>

        <div className="sticky top-0 z-[1] space-y-3 border-b border-base-content/10 bg-base-100/85 px-4 py-3 backdrop-blur-sm sm:px-5">
          <MediaSearchBar id={`${baseId}-q`} value={q} onChange={setQ} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <AlbumFilter
              id={`${baseId}-album`}
              className="min-w-0 flex-1"
              albums={albums}
              value={albumId}
              onChange={setAlbumId}
            />
            <TagFilter id={`${baseId}-tag`} className="min-w-0 flex-1" tags={tags} value={tagId} onChange={setTagId} />
            {canUpload ? (
              <QuickUploadPanel
                className="sm:shrink-0"
                disabled={!quickLinkSupported && targetType !== "story" && targetType !== "document"}
                busy={uploading}
                onFiles={(files) => void handleQuickUploadFiles(files)}
              />
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <SelectedMediaBar count={selected.size} onClear={() => setSelected(new Set())} className="mb-3" />
          <MediaGrid
            items={merged}
            selectedIds={selected}
            excludeIds={excludeMediaIds}
            loading={gridLoading}
            emptyLabel="No media matches these filters. Try another search or upload a new file."
            onToggle={toggle}
          />
          {hasMore ? (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => setListOffset(merged.length)}
              >
                {isFetching ? (
                  <>
                    <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-base-content/10 bg-base-100/90 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-5">
          <p className="mb-2 text-center text-xs text-muted-foreground sm:mb-0 sm:text-left">
            <Link href="/admin/media" className="link link-primary font-medium" onClick={() => onOpenChange(false)}>
              Open media library
            </Link>{" "}
            for full metadata editing.
          </p>
          <DialogFooter className="flex w-full flex-row gap-2 p-0 sm:w-auto">
            <DialogClose
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 sm:flex-none")}
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={attaching || selected.size === 0}
              onClick={() => void handleAttach()}
            >
              {attaching ? (
                <>
                  <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
                  Attaching…
                </>
              ) : (
                "Attach selected"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
