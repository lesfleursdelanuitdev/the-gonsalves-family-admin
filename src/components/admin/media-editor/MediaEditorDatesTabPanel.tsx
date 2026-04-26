"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { MediaLinkSection } from "@/components/admin/media-editor/MediaLinkSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedDateLink } from "@/components/admin/media-editor/media-editor-types";
import type { GedcomDateFormSlice } from "@/lib/forms/individual-editor-form";

export type MediaEditorDatesTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mediaIdOrNew: string;
  stagedDates: StagedDateLink[];
  dateDraft: GedcomDateFormSlice;
  setDateDraft: Dispatch<SetStateAction<GedcomDateFormSlice>>;
  submitting: boolean;
  onRemoveDate: (row: StagedDateLink) => void;
  onAddDateFromForm: () => void;
};

export function MediaEditorDatesTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mediaIdOrNew,
  stagedDates,
  dateDraft,
  setDateDraft,
  submitting,
  onRemoveDate,
  onAddDateFromForm,
}: MediaEditorDatesTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <MediaLinkSection
        description="Link this OBJE to canonical date records (structured + original text, same as events and key facts). Multiple dates are allowed."
        label="Linked dates"
        pills={
          <>
            {stagedDates.map((row) => (
              <MediaEditorPill
                key={row.key}
                label={row.label}
                onRemove={() => void onRemoveDate(row)}
                disabled={submitting}
              />
            ))}
            {stagedDates.length === 0 ? (
              <span className="text-sm text-muted-foreground">None linked.</span>
            ) : null}
          </>
        }
      >
        <GedcomDateInput
          idPrefix={`media-date-${mediaIdOrNew}`}
          value={dateDraft}
          onChange={(patch) => setDateDraft((prev) => ({ ...prev, ...patch }))}
          eventStyleHints
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={submitting}
          onClick={() => void onAddDateFromForm()}
        >
          Add date link
        </Button>
      </MediaLinkSection>
    </div>
  );
}
