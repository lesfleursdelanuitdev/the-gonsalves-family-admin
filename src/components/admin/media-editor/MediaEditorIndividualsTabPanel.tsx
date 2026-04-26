"use client";

import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { MediaLinkSection } from "@/components/admin/media-editor/MediaLinkSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedIndividualMedia } from "@/components/admin/media-editor/media-editor-types";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";

export type MediaEditorIndividualsTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mediaIdOrNew: string;
  stagedIndividuals: StagedIndividualMedia[];
  stagedIndividualIdSet: Set<string>;
  submitting: boolean;
  onRemoveIndividual: (row: StagedIndividualMedia) => void;
  onPickIndividual: (ind: AdminIndividualListItem) => void;
};

export function MediaEditorIndividualsTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mediaIdOrNew,
  stagedIndividuals,
  stagedIndividualIdSet,
  submitting,
  onRemoveIndividual,
  onPickIndividual,
}: MediaEditorIndividualsTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <MediaLinkSection
        description="Link this media to individuals using the same GEDCOM slash-aware name search as elsewhere in admin. Links are stored on the junction table."
        label="Linked individuals"
        pills={
          <>
            {stagedIndividuals.map((t) => (
              <MediaEditorPill
                key={t.individualId}
                label={t.label}
                onRemove={() => void onRemoveIndividual(t)}
                disabled={submitting}
              />
            ))}
            {stagedIndividuals.length === 0 ? (
              <span className="text-sm text-muted-foreground">None linked.</span>
            ) : null}
          </>
        }
      >
        <IndividualSearchPicker
          idPrefix={`media-indiv-${mediaIdOrNew}`}
          excludeIds={stagedIndividualIdSet}
          onPick={(ind) => void onPickIndividual(ind)}
          limit={30}
        />
      </MediaLinkSection>
    </div>
  );
}
