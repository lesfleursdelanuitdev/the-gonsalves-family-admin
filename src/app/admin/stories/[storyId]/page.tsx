"use client";

import { useParams, useSearchParams } from "next/navigation";
import { StoryCreatorClient } from "@/components/admin/story-creator/StoryCreatorClient";

export default function AdminStoryEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storyId = typeof params?.storyId === "string" ? params.storyId : "";
  const initialBlockId = searchParams?.get("block") ?? undefined;
  const rawMode = searchParams?.get("mode");
  const initialMode = rawMode === "preview" ? "preview" : rawMode === "edit" ? "edit" : undefined;

  if (!storyId) return null;
  return (
    <StoryCreatorClient
      key={storyId}
      storyId={storyId}
      initialSelectedBlockId={initialBlockId}
      initialMode={initialMode}
    />
  );
}
