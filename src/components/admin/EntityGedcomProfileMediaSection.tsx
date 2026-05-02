"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inferAdminMediaCategory } from "@/lib/admin/infer-admin-media-category";
import { ApiError, deleteJson } from "@/lib/infra/api";

type Entity = "individual" | "family" | "event";

export type ProfileMediaSelectionShape = {
  media?: {
    id?: unknown;
    fileRef?: unknown;
    form?: unknown;
    title?: unknown;
  } | null;
} | null;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function photoUrlFromProfileRow(row: ProfileMediaSelectionShape): string | null {
  const m = row?.media;
  if (!m) return null;
  const ref = typeof m.fileRef === "string" ? m.fileRef.trim() : "";
  if (!ref || !isHttpUrl(ref)) return null;
  const form = typeof m.form === "string" ? m.form : null;
  if (inferAdminMediaCategory(form, ref) !== "photo") return null;
  return ref;
}

function profileApiBase(entity: Entity, entityId: string): string {
  if (entity === "individual") return `/api/admin/individuals/${entityId}/profile-media`;
  if (entity === "family") return `/api/admin/families/${entityId}/profile-media`;
  return `/api/admin/events/${entityId}/profile-media`;
}

export type EntityGedcomProfileMediaSectionProps = {
  entity: Entity;
  entityId: string;
  heading: string;
  profileMediaSelection: ProfileMediaSelectionShape;
  invalidateQueryKeys: readonly (readonly string[])[];
  enabled?: boolean;
  /** Shown when no profile media is set (defaults to a generic line). */
  emptyHint?: string;
  /** MediaPicker trigger when empty (defaults to “Choose profile picture”). */
  chooseTriggerLabel?: string;
  /** Called after a successful save or remove (e.g. `router.refresh`). */
  onAfterMutation?: () => void;
};

export function EntityGedcomProfileMediaSection({
  entity,
  entityId,
  heading,
  profileMediaSelection,
  invalidateQueryKeys,
  enabled = true,
  emptyHint = "No profile picture set.",
  chooseTriggerLabel = "Choose profile picture",
  onAfterMutation,
}: EntityGedcomProfileMediaSectionProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const photoUrl = useMemo(() => photoUrlFromProfileRow(profileMediaSelection), [profileMediaSelection]);
  const mediaId =
    profileMediaSelection?.media && typeof profileMediaSelection.media.id === "string"
      ? profileMediaSelection.media.id.trim()
      : "";

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl, mediaId]);

  const invalidate = useCallback(async () => {
    for (const key of invalidateQueryKeys) {
      await qc.invalidateQueries({ queryKey: [...key] });
    }
    onAfterMutation?.();
  }, [qc, invalidateQueryKeys, onAfterMutation]);

  const onRemove = async () => {
    if (!mediaId || !enabled) return;
    setBusy(true);
    try {
      await deleteJson(profileApiBase(entity, entityId));
      await invalidate();
      toast.success("Removed.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02] p-4">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Preferred image for album views and previews. Removing this does not delete the file from the archive.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "relative flex size-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted",
            photoUrl && !imgFailed ? "bg-background" : "",
          )}
        >
          {photoUrl && !imgFailed ? (
            <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setImgFailed(true)} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
              {mediaId && (!photoUrl || imgFailed) ? <span>Preview unavailable</span> : <span>No image set</span>}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {!enabled ? (
            <p className="text-sm text-muted-foreground">Save this record first, then you can set a cover image.</p>
          ) : mediaId ? (
            <>
              <div className="flex flex-wrap gap-2">
                <MediaPicker
                  targetType={entity}
                  targetId={entityId}
                  mode="single"
                  purpose="profileCover"
                  allowedTypes={["photo"]}
                  triggerLabel="Replace"
                  triggerClassName="min-h-9"
                  onAttach={invalidate}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  disabled={busy}
                  onClick={() => void onRemove()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Remove"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Media record:{" "}
                <Link href={`/admin/media/${mediaId}`} className="link link-primary font-mono break-all">
                  {mediaId}
                </Link>
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{emptyHint}</p>
              <MediaPicker
                targetType={entity}
                targetId={entityId}
                mode="single"
                purpose="profileCover"
                allowedTypes={["photo"]}
                triggerLabel={chooseTriggerLabel}
                triggerClassName="min-h-9"
                onAttach={invalidate}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
