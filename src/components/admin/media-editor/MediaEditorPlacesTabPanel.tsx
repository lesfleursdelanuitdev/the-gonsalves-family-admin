"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import { MediaLinkSection } from "@/components/admin/media-editor/MediaLinkSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedPlaceLink } from "@/components/admin/media-editor/media-editor-types";
import type { GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";

export type MediaEditorPlacesTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mediaIdOrNew: string;
  stagedPlaces: StagedPlaceLink[];
  placeDraft: GedcomPlaceFormSlice;
  setPlaceDraft: Dispatch<SetStateAction<GedcomPlaceFormSlice>>;
  submitting: boolean;
  onRemovePlace: (row: StagedPlaceLink) => void;
  onAddPlaceFromForm: () => void;
};

export function MediaEditorPlacesTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mediaIdOrNew,
  stagedPlaces,
  placeDraft,
  setPlaceDraft,
  submitting,
  onRemovePlace,
  onAddPlaceFromForm,
}: MediaEditorPlacesTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <MediaLinkSection
        description="Link this OBJE to canonical place records (same deduplicated rows as elsewhere in the tree). Fill the fields, optionally pick a suggestion, then add the link. Multiple places are allowed."
        label="Linked places"
        pills={
          <>
            {stagedPlaces.map((row) => (
              <MediaEditorPill
                key={row.key}
                label={row.label}
                onRemove={() => void onRemovePlace(row)}
                disabled={submitting}
              />
            ))}
            {stagedPlaces.length === 0 ? (
              <span className="text-sm text-muted-foreground">None linked.</span>
            ) : null}
          </>
        }
      >
        <GedcomPlaceInput
          idPrefix={`media-place-${mediaIdOrNew}`}
          value={placeDraft}
          onChange={(patch) => setPlaceDraft((prev) => ({ ...prev, ...patch }))}
          eventStyleHints
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={submitting}
          onClick={() => void onAddPlaceFromForm()}
        >
          Add place link
        </Button>
      </MediaLinkSection>
    </div>
  );
}
