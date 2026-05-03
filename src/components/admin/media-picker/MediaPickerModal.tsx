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
import { ADMIN_MODAL_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { ADMIN_MEDIA_QUERY_KEY, useAdminMedia, type AdminMediaListItem } from "@/hooks/useAdminMedia";
import type { AdminAlbumsListResponse } from "@/hooks/useAdminAlbums";
import type { AdminTagsListResponse } from "@/hooks/useAdminTags";
import { ApiError, fetchJson, postFormDataWithUploadProgress, postJson, putJson } from "@/lib/infra/api";
import type { MediaEditorUploadProgressState } from "@/hooks/useMediaEditorUploadAndMeta";
import { attachMediaToTarget, isMediaPickerTargetLinkable } from "@/lib/admin/media-picker-attach";
import { titleFromUploadedFilename } from "@/lib/admin/media-upload-title";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 36;

/** Profile/cover flows that browse the family-tree archive only (no album/tag filters). */
function isProfileCoverFamilyTreeMode(
  purpose: MediaPickerPurpose | undefined,
  targetType: MediaPickerTargetType,
): boolean {
  return (
    purpose === "profileCover" &&
    (targetType === "individual" ||
      targetType === "family" ||
      targetType === "event" ||
      targetType === "tag")
  );
}

function pickMediaCategory(
  allowed?: readonly ("photo" | "document" | "video" | "audio")[],
): "photo" | "document" | "video" | "audio" | undefined {
  if (!allowed || allowed.length !== 1) return undefined;
  return allowed[0];
}

export function MediaPickerModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  mode = "multiple",
  purpose,
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
  allowedTypes?: readonly ("photo" | "document" | "video" | "audio")[];
  initialSelectedIds?: readonly string[];
  excludeMediaIds?: ReadonlySet<string>;
  onAttach?: (media: AdminMediaListItem[]) => void;
  onUploadComplete?: (media: AdminMediaListItem[]) => void;
  canUpload?: boolean;
  canLink?: boolean;
}) {
  const qc = useQueryClient();
  const baseId = useId();
  const [q, setQ] = useState("");
  const [sourceScope, setSourceScope] = useState<"all" | "family-tree" | "site-assets" | "my-media">("all");
  const [albumId, setAlbumId] = useState("");
  const [tagId, setTagId] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [merged, setMerged] = useState<AdminMediaListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []));

  const debouncedQ = useDebouncedValue(q.trim(), ADMIN_MODAL_DEBOUNCE_MS);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setAlbumId("");
    setTagId("");
    if (isProfileCoverFamilyTreeMode(purpose, targetType)) {
      setSourceScope("family-tree");
    } else {
      setSourceScope("all");
    }
    setSelected(new Set(mode === "single" && initialSelectedIds?.[0] ? [initialSelectedIds[0]] : []));
  }, [open, mode, initialSelectedIds, purpose, targetType]);

  const mediaCategory = useMemo(() => pickMediaCategory(allowedTypes), [allowedTypes]);

  const profileCoverFamilyTree = isProfileCoverFamilyTreeMode(purpose, targetType);

  const linkedEntityFilter = useMemo((): {
    linkedIndividualId?: string;
    linkedFamilyId?: string;
    linkedEventId?: string;
  } | null => {
    if (!profileCoverFamilyTree) return null;
    if (targetType === "individual") return { linkedIndividualId: targetId };
    if (targetType === "family") return { linkedFamilyId: targetId };
    if (targetType === "event") return { linkedEventId: targetId };
    return null;
  }, [profileCoverFamilyTree, targetType, targetId]);

  useEffect(() => {
    if (!open) return;
    setListOffset(0);
    setMerged([]);
  }, [open, debouncedQ, albumId, tagId, mediaCategory, sourceScope, linkedEntityFilter]);

  const listOpts = useMemo(
    () => ({
      scope: profileCoverFamilyTree ? ("family-tree" as const) : sourceScope,
      q: debouncedQ || undefined,
      albumId: profileCoverFamilyTree ? undefined : albumId || undefined,
      tagId: profileCoverFamilyTree ? undefined : tagId || undefined,
      mediaCategory,
      limit: PAGE_SIZE,
      offset: listOffset,
      ...(linkedEntityFilter ?? {}),
    }),
    [
      profileCoverFamilyTree,
      sourceScope,
      debouncedQ,
      albumId,
      tagId,
      mediaCategory,
      listOffset,
      linkedEntityFilter,
    ],
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
    enabled: open && !profileCoverFamilyTree,
  });
  const { data: tagsRes } = useQuery({
    queryKey: ["admin", "tags", tagsQs],
    queryFn: () => fetchJson<AdminTagsListResponse>(`/api/admin/tags?${tagsQs}`),
    enabled: open && !profileCoverFamilyTree,
  });

  useEffect(() => {
    if (!open) return;
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
  }, [open, data, listOffset]);

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
  const [uploadProgress, setUploadProgress] = useState<MediaEditorUploadProgressState | null>(null);
  const isLg = useMediaQueryMinLg();

  const handleAttach = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.message("Select at least one item.");
      return;
    }
    /** Story/document: no GEDCOM junction API — parent stores `mediaId` locally via `onAttach` only. */
    if (!isMediaPickerTargetLinkable(targetType)) {
      let picked = merged.filter((m) => ids.includes(m.id));
      if (picked.length === 0 && ids.length > 0) {
        try {
          picked = await Promise.all(
            ids.map(async (id) => {
              const res = await fetchJson<{ media: AdminMediaListItem }>(`/api/admin/media/${id}`);
              return res.media;
            }),
          );
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : "Could not load selected media.";
          toast.error(msg);
          return;
        }
      }
      if (picked.length === 0) {
        toast.error("Could not resolve the selected media. Try selecting it again.");
        return;
      }
      onAttach?.(picked);
      onOpenChange(false);
      toast.success(ids.length === 1 ? "Media selected." : `${ids.length} items selected.`);
      return;
    }
    const isProfileCoverPurpose =
      purpose === "profileCover" &&
      (targetType === "individual" ||
        targetType === "family" ||
        targetType === "event" ||
        targetType === "tag");

    if (isProfileCoverPurpose) {
      if (!canLink) {
        toast.error("You do not have permission to link media here.");
        return;
      }
      if (ids.length !== 1) {
        toast.message("Pick a single photo.");
        return;
      }
      setAttaching(true);
      try {
        const mid = ids[0]!;
        const base =
          targetType === "individual"
            ? `/api/admin/individuals/${targetId}/profile-media`
            : targetType === "family"
              ? `/api/admin/families/${targetId}/profile-media`
              : targetType === "event"
                ? `/api/admin/events/${targetId}/profile-media`
                : `/api/admin/tags/${targetId}/profile-media`;
        await putJson(base, { mediaId: mid });
        const row = merged.find((m) => m.id === mid);
        let picked: AdminMediaListItem[] = [];
        if (row) {
          picked = [row];
        } else {
          const res = await fetchJson<{ media: AdminMediaListItem }>(`/api/admin/media/${mid}`);
          picked = [res.media];
        }
        await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        if (targetType === "tag") {
          await qc.invalidateQueries({ queryKey: ["admin", "tags", "detail", targetId] });
        }
        toast.success("Cover image saved.");
        onAttach?.(picked);
        onOpenChange(false);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not save cover image.";
        toast.error(msg);
      } finally {
        setAttaching(false);
      }
      return;
    }
    if (!canLink) {
      toast.error("You do not have permission to link media here.");
      return;
    }
    setAttaching(true);
    try {
      const picked: AdminMediaListItem[] = [];
      for (const mid of ids) {
        const row = merged.find((m) => m.id === mid);
        const alreadyInThisAlbum =
          targetType === "album" &&
          Boolean(row?.albumLinks?.some((l) => l.album.id === targetId));
        if (!alreadyInThisAlbum) {
          try {
            await attachMediaToTarget(mid, targetType, targetId);
          } catch (e) {
            // Duplicate link (e.g. row missing `albumLinks` in list payload).
            if (
              targetType === "album" &&
              e instanceof ApiError &&
              e.status === 409
            ) {
              /* already linked — continue */
            } else {
              throw e;
            }
          }
        }
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
    const scopedSiteOrUser = sourceScope === "site-assets" || sourceScope === "my-media";
    const targetNeedsGedcomJunction = ["individual", "family", "event", "source", "place"].includes(targetType);
    if (scopedSiteOrUser && targetNeedsGedcomJunction) {
      toast.error("Linking to this record requires Family Tree media. Switch the scope tab to Family Tree, then upload.");
      return;
    }
    if (!quickLinkSupported && targetType !== "story" && targetType !== "document") {
      toast.error("Upload is not available for this target until linking is supported.");
      return;
    }
    setUploading(true);
    const created: AdminMediaListItem[] = [];
    const fileArr = Array.from(files);
    try {
      let index = 0;
      for (const file of fileArr) {
        index += 1;
        const fd = new FormData();
        fd.set("file", file);
        const label = file.name?.trim() || `File ${index}`;
        setUploadProgress({
          loaded: 0,
          total: null,
          expectedBytes: file.size,
          caption: `${index} of ${fileArr.length}: ${label}`,
          subCaption: "Uploading…",
        });
        const uploadScope =
          sourceScope === "site-assets" || sourceScope === "my-media" ? sourceScope : "family-tree";
        const uploadUrl =
          uploadScope === "family-tree"
            ? "/api/admin/media/upload"
            : `/api/admin/media/upload?scope=${encodeURIComponent(uploadScope)}`;
        const up = await postFormDataWithUploadProgress<{
          fileRef: string;
          suggestedForm: string | null;
          originalName: string;
          mimeType: string | null;
        }>(uploadUrl, fd, (p) => {
          setUploadProgress({
            loaded: p.loaded,
            total: p.total,
            expectedBytes: file.size,
            caption: `${index} of ${fileArr.length}: ${label}`,
            subCaption: "Uploading…",
          });
        });
        setUploadProgress({
          loaded: file.size,
          total: file.size,
          expectedBytes: file.size,
          caption: `${index} of ${fileArr.length}: ${label}`,
          subCaption: "Saving and linking…",
        });
        const title = titleFromUploadedFilename(up.originalName || file.name);
        const baseCreate = {
          fileRef: up.fileRef,
          form: up.suggestedForm ?? null,
          title,
          mimeType: up.mimeType ?? null,
          storageKey: up.fileRef ?? null,
        };
        let mediaRow: AdminMediaListItem;
        if (sourceScope === "site-assets") {
          const res = await postJson<{ media: AdminMediaListItem }>("/api/admin/site-media", baseCreate);
          mediaRow = res.media;
          if (targetType === "album") {
            await postJson(`/api/admin/site-media/${mediaRow.id}/album-links`, { albumId: targetId });
          }
        } else if (sourceScope === "my-media") {
          const res = await postJson<{ media: AdminMediaListItem }>("/api/admin/user-media", baseCreate);
          mediaRow = res.media;
          if (targetType === "album") {
            await postJson(`/api/admin/user-media/${mediaRow.id}/album-links`, { albumId: targetId });
          }
        } else {
          const body: Record<string, unknown> = { ...baseCreate };
          if (targetType === "individual") body.linkedIndividualId = targetId;
          else if (targetType === "family") body.linkedFamilyId = targetId;
          else if (targetType === "event") body.linkedEventId = targetId;
          const res = await postJson<{ media: AdminMediaListItem }>("/api/admin/media", body);
          mediaRow = res.media;
          if (targetType === "album") {
            await postJson(`/api/admin/media/${mediaRow.id}/album-links`, { albumId: targetId });
          } else if (targetType === "source") {
            await postJson(`/api/admin/media/${mediaRow.id}/source-media`, { sourceId: targetId });
          } else if (targetType === "place") {
            await postJson(`/api/admin/media/${mediaRow.id}/place-media`, { placeId: targetId });
          }
        }
        created.push(mediaRow);
        if (mode === "single") setSelected(new Set([mediaRow.id]));
        else setSelected((s) => new Set(s).add(mediaRow.id));
      }
      if (
        purpose === "profileCover" &&
        sourceScope !== "site-assets" &&
        sourceScope !== "my-media" &&
        (targetType === "individual" || targetType === "family" || targetType === "event") &&
        created.length > 0
      ) {
        const last = created[created.length - 1]!;
        const base =
          targetType === "individual"
            ? `/api/admin/individuals/${targetId}/profile-media`
            : targetType === "family"
              ? `/api/admin/families/${targetId}/profile-media`
              : `/api/admin/events/${targetId}/profile-media`;
        await putJson(base, { mediaId: last.id });
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
      setUploadProgress(null);
      setUploading(false);
    }
  };

  const hasMore = Boolean(data?.hasMore);
  const gridLoading = isLoading || (isFetching && listOffset === 0 && merged.length === 0);

  const gridEmptyLabel = profileCoverFamilyTree
    ? targetType === "individual"
      ? "No linked photos yet. On the Media tab, use “Choose existing” or “Upload new” to attach images to this person, then return here."
      : targetType === "family"
        ? "No linked photos yet. Link images to this family on the Media tab, then return here."
        : "No linked photos yet. Link images to this event on the Media tab, then return here."
    : "No media matches these filters. Try another search or upload a new file.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0",
          "border-base-content/15 bg-[color-mix(in_oklch,var(--color-base-100)_88%,var(--color-warning)_12%)] shadow-xl shadow-black/20",
          !isLg && "h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-x-0 border-t-0",
        )}
      >
        <div className="border-b border-base-content/10 bg-base-100/60 px-4 py-3 sm:px-5">
          <DialogTitle className="text-lg font-semibold tracking-tight text-base-content">
            {profileCoverFamilyTree ? "Choose profile picture" : "Add media"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {profileCoverFamilyTree
              ? targetType === "individual"
                ? "Only photos already linked to this person (from the Media tab) can be chosen here."
                : targetType === "family"
                  ? "Only photos already linked to this family can be chosen here."
                  : "Only photos already linked to this event can be chosen here."
              : "Browse the archive, filter by album or tag, or upload. Attach links this record; edit full details on the media page."}
          </DialogDescription>
        </div>

        <div className="sticky top-0 z-[1] space-y-3 border-b border-base-content/10 bg-base-100/85 px-4 py-3 backdrop-blur-sm sm:px-5">
          <MediaSearchBar id={`${baseId}-q`} value={q} onChange={setQ} />
          {!profileCoverFamilyTree ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["family-tree", "Family Tree"],
                  ["site-assets", "Site Assets"],
                  ["my-media", "My Media"],
                ] as const
              ).map(([scope, label]) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => {
                    setSourceScope(scope);
                    setSelected(new Set());
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    sourceScope === scope
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-base-content/15 bg-base-200/35 text-muted-foreground hover:border-base-content/30 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {!profileCoverFamilyTree ? (
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
                  disabled={
                    !quickLinkSupported && targetType !== "story" && targetType !== "document"
                  }
                  busy={uploading}
                  uploadProgress={uploadProgress}
                  onFiles={(files) => void handleQuickUploadFiles(files)}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <SelectedMediaBar count={selected.size} onClear={() => setSelected(new Set())} className="mb-3" />
          <MediaGrid
            items={merged}
            selectedIds={selected}
            excludeIds={excludeMediaIds}
            loading={gridLoading}
            emptyLabel={gridEmptyLabel}
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
                  {profileCoverFamilyTree ? "Saving…" : "Attaching…"}
                </>
              ) : profileCoverFamilyTree ? (
                "Use selected photo"
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
