"use client";

import Link from "next/link";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { MediaPicker } from "@/components/admin/media-picker";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IndividualEditMediaJoin } from "@/components/admin/individual-editor/individual-editor-types";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import {
  EntityGedcomProfileMediaSection,
  type ProfileMediaSelectionShape,
} from "@/components/admin/EntityGedcomProfileMediaSection";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";

export type IndividualEditorMediaTabPanelProps = {
  hidden: boolean;
  noCardShell?: boolean;
  mode: "create" | "edit";
  individualId: string;
  individualNewEventLabel: string;
  linkedMediaIds: ReadonlySet<string>;
  individualMedia: IndividualEditMediaJoin[];
  profileMediaSelection: ProfileMediaSelectionShape;
  onMediaAttached: () => void;
};

export function IndividualEditorMediaTabPanel({
  hidden,
  noCardShell = false,
  mode,
  individualId,
  individualNewEventLabel,
  linkedMediaIds,
  individualMedia,
  profileMediaSelection,
  onMediaAttached,
}: IndividualEditorMediaTabPanelProps) {
  const returnTo = `/admin/individuals/${individualId}/edit`;

  const actions =
    mode === "edit" && individualId ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ViewAsAlbumLink
          entityType="individual"
          entityId={individualId}
          label="View all media"
          count={individualMedia.length}
        />
        <MediaPicker
          targetType="individual"
          targetId={individualId}
          mode="multiple"
          triggerLabel="Choose existing"
          excludeMediaIds={linkedMediaIds}
          onAttach={() => {
            onMediaAttached();
          }}
        />
        <Link
          href={`/admin/media/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "min-h-11 shrink-0")}
        >
          Upload new
        </Link>
      </div>
    ) : null;

  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Save this person first to attach photos or documents.</p>
    ) : individualMedia.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No photos or documents added yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Upload a new file or pick something already in the archive.</p>
      </div>
    ) : (
      <>
        <p className="text-sm text-muted-foreground">Tap a tile to open the file.</p>
        <AssociatedMediaThumbnailGrid items={individualMedia} />
      </>
    );

  const profileBlock =
    mode === "edit" && individualId ? (
      <EntityGedcomProfileMediaSection
        entity="individual"
        entityId={individualId}
        heading="Profile picture"
        profileMediaSelection={profileMediaSelection}
        invalidateQueryKeys={[[...ADMIN_INDIVIDUALS_QUERY_KEY, "detail", individualId]]}
        onAfterMutation={onMediaAttached}
      />
    ) : null;

  const body = noCardShell ? (
    <>
      {profileBlock ? <div className="mb-4">{profileBlock}</div> : null}
      <div className="mb-4">{actions}</div>
      <div className="space-y-3">{listBlock}</div>
    </>
  ) : (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg">Media</CardTitle>
          <p className="text-sm text-muted-foreground">Photos and files linked to this person.</p>
        </div>
        {actions}
      </CardHeader>
      <CardContent className="space-y-3">
        {profileBlock}
        {listBlock}
      </CardContent>
    </Card>
  );

  return (
    <div role="region" aria-label="Media" hidden={hidden} className={noCardShell ? "space-y-3" : "space-y-8 pt-2"}>
      {body}
    </div>
  );
}
