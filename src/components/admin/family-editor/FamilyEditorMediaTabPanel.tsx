"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { MediaPicker } from "@/components/admin/media-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FamilyEditMediaJoin } from "@/components/admin/family-editor/family-editor-types";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import {
  EntityGedcomProfileMediaSection,
  type ProfileMediaSelectionShape,
} from "@/components/admin/EntityGedcomProfileMediaSection";
import { ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";

export type FamilyEditorMediaTabPanelProps = {
  noCardShell?: boolean;
  mode: "create" | "edit";
  familyId: string;
  familyNewEventLabel: string;
  linkedFamilyMediaIds: ReadonlySet<string>;
  familyMedia: FamilyEditMediaJoin[];
  profileMediaSelection: ProfileMediaSelectionShape;
  onMediaAttached: () => void;
};

export function FamilyEditorMediaTabPanel({
  noCardShell = true,
  mode,
  familyId,
  familyNewEventLabel,
  linkedFamilyMediaIds,
  familyMedia,
  profileMediaSelection,
  onMediaAttached,
}: FamilyEditorMediaTabPanelProps) {
  const returnTo =
    mode === "create"
      ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
      : `/admin/families/${familyId}/edit`;

  const addMediaHref =
    mode === "edit" && familyId
      ? `/admin/media/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`
      : null;

  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Finish creating the family before attaching media.</p>
    ) : familyMedia.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No media added yet.</p>
      </div>
    ) : (
      <>
        <p className="text-sm text-muted-foreground">
          Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
        </p>
        <AssociatedMediaThumbnailGrid items={familyMedia} />
      </>
    );

  const actions =
    mode === "edit" && familyId ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {addMediaHref ? (
          <Link
            href={addMediaHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-dashed sm:flex-none",
            )}
          >
            <Plus className="size-4" aria-hidden />
            Add media
          </Link>
        ) : null}
        <MediaPicker
          targetType="family"
          targetId={familyId}
          mode="multiple"
          triggerLabel="Choose from archive"
          excludeMediaIds={linkedFamilyMediaIds}
          onAttach={() => {
            onMediaAttached();
          }}
        />
        <ViewAsAlbumLink
          entityType="family"
          entityId={familyId}
          label="View family media"
          count={familyMedia.length}
        />
      </div>
    ) : null;

  const profileBlock =
    mode === "edit" && familyId ? (
      <EntityGedcomProfileMediaSection
        entity="family"
        entityId={familyId}
        heading="Family cover image"
        profileMediaSelection={profileMediaSelection}
        invalidateQueryKeys={[[...ADMIN_FAMILIES_QUERY_KEY, "detail", familyId]]}
        emptyHint="No family cover image set."
        chooseTriggerLabel="Choose family cover image"
        onAfterMutation={onMediaAttached}
      />
    ) : null;

  const inner = (
    <div className="space-y-4">
      {profileBlock}
      {listBlock}
      {actions}
    </div>
  );

  if (noCardShell) {
    return (
      <div role="region" aria-label="Media" className="space-y-3">
        {inner}
      </div>
    );
  }

  return <div role="region" aria-label="Media">{inner}</div>;
}
