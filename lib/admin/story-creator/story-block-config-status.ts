import type { StoryEmbedBlock, StoryMediaBlock } from "@/lib/admin/story-creator/story-types";

export function isStoryMediaUnconfigured(block: StoryMediaBlock): boolean {
  return !block.mediaId?.trim();
}

export function isStoryEmbedUnconfigured(block: StoryEmbedBlock): boolean {
  return block.label === "New embed" || block.label === "Embed block" || !block.label?.trim();
}
