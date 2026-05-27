"use client";

import { useParams, useSearchParams } from "next/navigation";
import { StoryCreatorClient } from "@/components/admin/story-creator/StoryCreatorClient";

export default function StoryCreatorStandaloneEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storyId = typeof params?.storyId === "string" ? params.storyId : "";
  const from = searchParams?.get("from");
  const initialBlockId = searchParams?.get("block") ?? undefined;
  const rawMode = searchParams?.get("mode");
  const initialMode = rawMode === "preview" ? "preview" : rawMode === "edit" ? "edit" : undefined;

  // If navigated from admin (from=admin), onBack returns to the admin route with state.
  // Otherwise, fall back to router.back().
  const onBackOverride = from === "admin" ? undefined : null;

  if (!storyId) return null;
  return (
    <StoryCreatorClient
      key={storyId}
      storyId={storyId}
      initialSelectedBlockId={initialBlockId}
      initialMode={initialMode}
      onBackOverride={onBackOverride}
      hideFullscreen
    />
  );
}

