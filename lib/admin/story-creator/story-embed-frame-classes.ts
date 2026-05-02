import { cn } from "@/lib/utils";
import type { StoryEmbedHeightPreset } from "@/lib/admin/story-creator/story-types";

const FRAME_BASE =
  "relative isolate w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-base-300 via-base-300/90 to-base-200/80 shadow-inner";

/**
 * Tailwind classes for the embed / media frame (placeholder until real media is wired).
 */
const HEIGHT_FRAME: Record<StoryEmbedHeightPreset, string> = {
  auto: cn(FRAME_BASE, "aspect-video"),
  compact: cn(FRAME_BASE, "aspect-video max-h-32"),
  default: cn(FRAME_BASE, "aspect-video max-h-48"),
  tall: cn(FRAME_BASE, "aspect-video max-h-72 sm:max-h-96"),
  hero: cn(FRAME_BASE, "aspect-video max-h-[min(75vh,720px)] min-h-[180px]"),
};

export function storyEmbedMediaFrameClassNames(heightPreset: StoryEmbedHeightPreset | undefined): string {
  const p = heightPreset ?? "default";
  return HEIGHT_FRAME[p];
}
