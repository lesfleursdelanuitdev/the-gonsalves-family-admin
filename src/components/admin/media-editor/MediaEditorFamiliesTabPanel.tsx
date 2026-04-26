"use client";

import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { MediaLinkSection } from "@/components/admin/media-editor/MediaLinkSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedFamilyMedia } from "@/components/admin/media-editor/media-editor-types";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";

export type MediaEditorFamiliesTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mediaIdOrNew: string;
  stagedFamilies: StagedFamilyMedia[];
  stagedFamilyIdSet: Set<string>;
  submitting: boolean;
  onRemoveFamily: (row: StagedFamilyMedia) => void;
  onPickFamily: (fam: AdminFamilyListItem) => void;
};

export function MediaEditorFamiliesTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mediaIdOrNew,
  stagedFamilies,
  stagedFamilyIdSet,
  submitting,
  onRemoveFamily,
  onPickFamily,
}: MediaEditorFamiliesTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <MediaLinkSection
        description="Link this media to family records. Uses the same family search as elsewhere in admin."
        label="Linked families"
        pills={
          <>
            {stagedFamilies.map((t) => (
              <MediaEditorPill
                key={t.familyId}
                label={t.label}
                onRemove={() => void onRemoveFamily(t)}
                disabled={submitting}
              />
            ))}
            {stagedFamilies.length === 0 ? (
              <span className="text-sm text-muted-foreground">None linked.</span>
            ) : null}
          </>
        }
      >
        <FamilySearchPicker
          idPrefix={`media-fam-${mediaIdOrNew}`}
          excludeIds={stagedFamilyIdSet}
          onPick={(fam) => void onPickFamily(fam)}
          limit={30}
        />
      </MediaLinkSection>
    </div>
  );
}
