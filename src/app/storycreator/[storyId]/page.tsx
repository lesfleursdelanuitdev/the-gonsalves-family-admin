"use client";

import { useParams } from "next/navigation";
import { StoryCreatorClient } from "@/components/admin/story-creator/StoryCreatorClient";
import { StoryEditorStoreProvider } from "@/features/story-creator/state/storyEditorContext";

export default function StoryCreatorStandaloneEditorPage() {
  const params = useParams();
  const storyId = typeof params?.storyId === "string" ? params.storyId : "";

  if (!storyId) return null;
  return (
    <StoryEditorStoreProvider key={storyId}>
      <StoryCreatorClient storyId={storyId} />
    </StoryEditorStoreProvider>
  );
}

