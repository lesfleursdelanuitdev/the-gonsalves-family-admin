"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError, deleteJson, patchJson } from "@/lib/infra/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { AlbumCoverBanner } from "@/components/admin/AlbumCoverBanner";
import { AlbumMediaGridSection } from "@/components/admin/AlbumMediaGridSection";
import { MediaPickerModal } from "@/components/admin/media-picker/MediaPickerModal";
import { useAdminAlbum } from "@/hooks/useAdminAlbums";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import { cn } from "@/lib/utils";

const textareaClass = cn(
  "textarea textarea-bordered w-full min-h-[5.5rem] text-sm",
  "border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] app-light:border-[color-mix(in_oklch,var(--color-base-content)_26%,var(--color-base-300))]",
  "placeholder:text-base-content/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-50",
);

export default function AdminEditAlbumPage() {
  const params = useParams();
  const albumId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useAdminAlbum(albumId || undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    const a = data?.album;
    if (!a) return;
    setName(a.name);
    setDescription(a.description ?? "");
    setIsPublic(a.isPublic);
  }, [data?.album]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.error("Name is required.");
      return;
    }
    setPending(true);
    try {
      await patchJson(`/api/admin/albums/${albumId}`, {
        name: n,
        description: description.trim() ? description.trim() : null,
        isPublic,
      });
      await qc.invalidateQueries({ queryKey: ["admin", "albums"] });
      await qc.invalidateQueries({ queryKey: ["admin", "albums", "detail", albumId] });
      toast.success("Album saved.");
      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not save.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  async function onClearCover() {
    setPending(true);
    try {
      await patchJson(`/api/admin/albums/${albumId}`, { coverMediaId: null });
      await qc.invalidateQueries({ queryKey: ["admin", "albums"] });
      await qc.invalidateQueries({ queryKey: ["admin", "albums", "detail", albumId] });
      toast.success("Cover cleared.");
      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not clear cover.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete this album? Linked media remains in the archive.`)) return;
    setPendingDelete(true);
    try {
      await deleteJson(`/api/admin/albums/${albumId}`);
      await qc.invalidateQueries({ queryKey: ["admin", "albums"] });
      toast.success("Album deleted.");
      router.push("/admin/albums");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not delete.";
      toast.error(msg);
    } finally {
      setPendingDelete(false);
    }
  }

  async function onCoverPicked(items: AdminMediaListItem[]) {
    const mid = items[0]?.id;
    if (!mid) return;
    setPending(true);
    try {
      await patchJson(`/api/admin/albums/${albumId}`, { coverMediaId: mid });
      await qc.invalidateQueries({ queryKey: ["admin", "albums"] });
      await qc.invalidateQueries({ queryKey: ["admin", "albums", "detail", albumId] });
      toast.success("Cover updated.");
      setCoverPickerOpen(false);
      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not set cover.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

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

  return shell(
    <div className="space-y-6">
      <h1 className="sr-only">
        Edit album {album.name}
      </h1>

      <AlbumCoverBanner
        name={album.name}
        coverMediaId={album.coverMediaId}
        coverFileRef={album.coverFileRef ?? null}
        coverForm={album.coverForm ?? null}
        isPublic={album.isPublic}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 pb-4">
        <div>
          <p className="text-sm font-medium text-base-content">Album settings</p>
          <p className="text-xs text-muted-foreground">Name, description, visibility, cover, and danger zone below.</p>
        </div>
        <Link
          href={`/admin/albums/${albumId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0")}
        >
          View album
        </Link>
      </div>

      <AlbumMediaGridSection albumId={albumId} />

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="edit-album-name">Name</Label>
          <Input
            id="edit-album-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-album-description">Description</Label>
          <textarea
            id="edit-album-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </div>
        <div className="flex items-start gap-3 rounded-md border border-base-content/10 p-3">
          <Checkbox
            id="edit-album-public"
            checked={isPublic}
            onCheckedChange={(v) => setIsPublic(v === true)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="edit-album-public" className="cursor-pointer font-medium">
              Public album
            </Label>
            <p className="text-xs text-muted-foreground">
              Public album names must be unique for your account. Personal albums can share the same name.
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-base-content/10 pt-4">
          <Label>Cover image</Label>
          <p className="text-xs text-muted-foreground">
            Pick a photo from this tree. Choosing cover can also attach it to this album if it was not already linked.
          </p>
          {album.coverMediaId ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Media:</span>{" "}
              <Link
                href={`/admin/media/${album.coverMediaId}`}
                className="font-mono text-xs text-primary underline-offset-4 hover:underline"
              >
                {album.coverMediaId}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No cover set.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCoverPickerOpen(true)} disabled={pending}>
              <ImageIcon className="mr-1.5 size-4" />
              Choose cover…
            </Button>
            {album.coverMediaId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void onClearCover()} disabled={pending}>
                Clear cover
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/admin/albums" className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
      </form>

      <div className="rounded-box border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Danger zone</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleting an album removes its media links, not the media files.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={pendingDelete || pending}
          onClick={() => void onDelete()}
        >
          {pendingDelete ? "Deleting…" : "Delete album"}
        </Button>
      </div>

      <MediaPickerModal
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        targetType="album"
        targetId={albumId}
        mode="single"
        canLink
        allowedTypes={["photo"]}
        onAttach={(items) => void onCoverPicked(items)}
      />
    </div>,
  );
}
