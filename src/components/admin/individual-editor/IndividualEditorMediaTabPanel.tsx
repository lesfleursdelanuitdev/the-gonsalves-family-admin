"use client";

import Link from "next/link";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { MediaPicker } from "@/components/admin/media-picker";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IndividualEditMediaJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorMediaTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  individualId: string;
  individualNewEventLabel: string;
  linkedMediaIds: ReadonlySet<string>;
  individualMedia: IndividualEditMediaJoin[];
  onMediaAttached: () => void;
};

export function IndividualEditorMediaTabPanel({
  hidden,
  mode,
  individualId,
  individualNewEventLabel,
  linkedMediaIds,
  individualMedia,
  onMediaAttached,
}: IndividualEditorMediaTabPanelProps) {
  const returnTo = `/admin/individuals/${individualId}/edit`;

  return (
    <div
      id="individual-editor-panel-media"
      role="tabpanel"
      aria-labelledby="individual-editor-tab-media"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">OBJE records linked to this person.</p>
          </div>
          {mode === "edit" && individualId ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <MediaPicker
                targetType="individual"
                targetId={individualId}
                mode="multiple"
                triggerLabel="Choose from archive"
                excludeMediaIds={linkedMediaIds}
                onAttach={() => {
                  onMediaAttached();
                }}
              />
              <Link
                href={`/admin/media/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                Add media
              </Link>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              Save this person first to see media linked to their record.
            </p>
          ) : individualMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media linked to this individual.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
              </p>
              <AssociatedMediaThumbnailGrid items={individualMedia} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
