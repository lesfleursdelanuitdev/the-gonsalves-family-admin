"use client";

import { useParams } from "next/navigation";
import { StoryCreatorClient } from "@/components/admin/story-creator/StoryCreatorClient";

export default function StoryCreatorStandaloneEditorPage() {
  const params = useParams();
  const storyId = typeof params?.storyId === "string" ? params.storyId : "";

  if (!storyId) return null;
  return <StoryCreatorClient key={storyId} storyId={storyId} />;
}

