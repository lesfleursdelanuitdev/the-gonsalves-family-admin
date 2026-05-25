"use client";

// Thin adapter: wires the admin's storage, pickers, and media/timeline hooks
// into the @ligneous/story-creator/editor shell. The old 4200-line file that
// this replaces has been extracted into the package; all canvas, inspector, and
// state logic now lives there.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  StoryCreatorClient as PkgStoryCreatorClient,
  StoryEditorPickersProvider,
  StoryEditorMediaProvider,
  StoryEditorTimelineProvider,
} from "@ligneous/story-creator/editor";
import { loadStoryDocument, saveStoryDocument } from "@/lib/admin/story-creator/story-storage";
import { useStoryMediaById, useStoryMediaByIds } from "@/hooks/useStoryMediaById";
import { useStoryTimelineEmbedData } from "@/hooks/useStoryTimelineEmbedData";
import { useTimelineEventResolution } from "@/hooks/useTimelineEventResolution";
import {
  AdminIndividualPickerAdapter,
  AdminFamilyPickerAdapter,
  AdminEventPickerModalAdapter,
  AdminPlacePickerAdapter,
  AdminTagsPickerAdapter,
  AdminAlbumsManagerAdapter,
  AdminMediaPickerButtonAdapter,
  AdminMediaPickerModalAdapter,
  AdminEditorPillAdapter,
  AdminNotesPickerAdapter,
} from "./story-creator-admin-pickers";

export function StoryCreatorClient({ storyId }: { storyId: string }) {
  const router = useRouter();
  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <StoryEditorPickersProvider
      IndividualSearchPicker={AdminIndividualPickerAdapter}
      FamilySearchPicker={AdminFamilyPickerAdapter}
      EventPickerModal={AdminEventPickerModalAdapter}
      PlaceSearchPicker={AdminPlacePickerAdapter}
      TagsPicker={AdminTagsPickerAdapter}
      AlbumsManager={AdminAlbumsManagerAdapter}
      MediaPickerButton={AdminMediaPickerButtonAdapter}
      MediaPickerModal={AdminMediaPickerModalAdapter}
      EditorPill={AdminEditorPillAdapter}
      NotesPicker={AdminNotesPickerAdapter}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <StoryEditorMediaProvider useMediaById={useStoryMediaById as any} useMediaByIds={useStoryMediaByIds}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <StoryEditorTimelineProvider useTimelineEmbedData={useStoryTimelineEmbedData as any} useTimelineEventResolution={useTimelineEventResolution as any}>
          <PkgStoryCreatorClient
            storyId={storyId}
            onLoad={loadStoryDocument}
            onSave={saveStoryDocument}
            onBack={handleBack}
          />
        </StoryEditorTimelineProvider>
      </StoryEditorMediaProvider>
    </StoryEditorPickersProvider>
  );
}
