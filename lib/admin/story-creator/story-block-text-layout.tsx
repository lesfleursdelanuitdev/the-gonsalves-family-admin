import type { ReactNode } from "react";
import type { StoryBlockTextPlacement } from "@/lib/admin/story-creator/story-types";

export const STORY_TEXT_PLACEMENT_OPTIONS: { value: StoryBlockTextPlacement; label: string }[] = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export function resolveStoryBlockTextPlacement(
  raw: StoryBlockTextPlacement | undefined,
  fallback: StoryBlockTextPlacement,
): StoryBlockTextPlacement {
  if (raw === "above" || raw === "below" || raw === "left" || raw === "right") return raw;
  return fallback;
}

type SlotBuckets = {
  above: ReactNode[];
  below: ReactNode[];
  left: ReactNode[];
  right: ReactNode[];
};

/**
 * Arranges optional title and caption around a central asset (image, video, embed chrome)
 * using independent placements per field.
 */
export function StoryAssetWithTitleCaption({
  asset,
  title,
  caption,
  titlePlacement,
  captionPlacement,
  titleClassName,
  captionClassName,
}: {
  asset: ReactNode;
  title?: ReactNode | null;
  caption?: ReactNode | null;
  titlePlacement?: StoryBlockTextPlacement;
  captionPlacement?: StoryBlockTextPlacement;
  titleClassName?: string;
  captionClassName?: string;
}) {
  const tp = resolveStoryBlockTextPlacement(titlePlacement, "above");
  const cp = resolveStoryBlockTextPlacement(captionPlacement, "below");

  const slots: SlotBuckets = { above: [], below: [], left: [], right: [] };

  if (title != null) {
    slots[tp].push(
      <div key="story-block-title" className={titleClassName}>
        {title}
      </div>,
    );
  }
  if (caption != null) {
    slots[cp].push(
      <div key="story-block-caption" className={captionClassName}>
        {caption}
      </div>,
    );
  }

  const band = (nodes: ReactNode[]) =>
    nodes.length > 0 ? <div className="flex min-w-0 flex-col gap-1">{nodes}</div> : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {band(slots.above)}
      <div className="flex min-w-0 flex-row items-start gap-3">
        {band(slots.left)}
        <div className="min-w-0 shrink-0">{asset}</div>
        {band(slots.right)}
      </div>
      {band(slots.below)}
    </div>
  );
}
