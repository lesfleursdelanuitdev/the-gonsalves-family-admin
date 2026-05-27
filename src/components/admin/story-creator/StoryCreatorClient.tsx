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
  type StoryCreatorFullscreenState,
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

type Props = {
  storyId: string;
  initialSelectedBlockId?: string;
  initialMode?: "edit" | "preview";
  /** Override back navigation. Pass null to use router.back(). Omit to navigate to /admin/stories/[storyId]. */
  onBackOverride?: ((state: StoryCreatorFullscreenState) => void) | null;
  /** If true, hides the fullscreen button (e.g. standalone route is already fullscreen). */
  hideFullscreen?: boolean;
};

export function StoryCreatorClient({ storyId, initialSelectedBlockId, initialMode, onBackOverride, hideFullscreen }: Props) {
  const router = useRouter();

  const defaultHandleBack = useCallback(
    ({ selectedBlockId, mode }: StoryCreatorFullscreenState) => {
      const params = new URLSearchParams();
      if (selectedBlockId) params.set("block", selectedBlockId);
      params.set("mode", mode);
      router.push(`/admin/stories/${storyId}?${params.toString()}`);
    },
    [router, storyId],
  );

  const routerBackFn = useCallback((_state: StoryCreatorFullscreenState) => router.back(), [router]);

  const handleBack = onBackOverride === null ? routerBackFn : onBackOverride ?? defaultHandleBack;

  const handleEnterFullscreen = useCallback(
    ({ selectedBlockId, mode }: StoryCreatorFullscreenState) => {
      const params = new URLSearchParams({ from: "admin" });
      if (selectedBlockId) params.set("block", selectedBlockId);
      params.set("mode", mode);
      router.push(`/storycreator/${storyId}?${params.toString()}`);
    },
    [router, storyId],
  );

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
            onEnterFullscreen={hideFullscreen ? undefined : handleEnterFullscreen}
            initialSelectedBlockId={initialSelectedBlockId}
            initialMode={initialMode}
          />
        </StoryEditorTimelineProvider>
      </StoryEditorMediaProvider>
    </StoryEditorPickersProvider>
  );
}
