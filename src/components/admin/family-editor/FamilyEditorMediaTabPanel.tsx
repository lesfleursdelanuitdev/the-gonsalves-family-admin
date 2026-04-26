"use client";

import Link from "next/link";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { MediaPicker } from "@/components/admin/media-picker";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FamilyEditMediaJoin } from "@/components/admin/family-editor/family-editor-types";

export type FamilyEditorMediaTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  familyId: string;
  familyNewEventLabel: string;
  linkedFamilyMediaIds: ReadonlySet<string>;
  familyMedia: FamilyEditMediaJoin[];
  onMediaAttached: () => void;
};

export function FamilyEditorMediaTabPanel({
  hidden,
  mode,
  familyId,
  familyNewEventLabel,
  linkedFamilyMediaIds,
  familyMedia,
  onMediaAttached,
}: FamilyEditorMediaTabPanelProps) {
  const returnTo =
    mode === "create"
      ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
      : `/admin/families/${familyId}/edit`;

  return (
    <div
      id="family-editor-panel-media"
      role="tabpanel"
      aria-labelledby="family-editor-tab-media"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">OBJE records linked to this family.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <Link
              href={`/admin/media/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(returnTo)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add media
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {familyMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media linked to this family.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
              </p>
              <AssociatedMediaThumbnailGrid items={familyMedia} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
