"use client";

import { StoryTimelineEmbedCanvas } from "@/components/admin/story-creator/StoryTimelineEmbedCanvas";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function TimelineEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const isEditor = variant === "editor";
  const asset = (
    <StoryTimelineEmbedCanvas
      block={block}
      isEditing={isEditor}
      onHeightChange={isEditor && onPatchBlock ? (next) => onPatchBlock({ heightPx: next }) : undefined}
      onPatchBlock={isEditor && onPatchBlock ? onPatchBlock : undefined}
    />
  );

  return (
    <EmbedBlockShell
      block={block}
      variant={variant}
      compact={compact}
      onConfigure={onConfigure}
      onPatchBlock={onPatchBlock}
      asset={asset}
    />
  );
}
