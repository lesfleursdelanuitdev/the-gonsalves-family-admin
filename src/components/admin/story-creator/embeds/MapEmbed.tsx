"use client";

import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { cn } from "@/lib/utils";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

const DEFERRED_EMBED_NOTE = "Map and tree embeds are planned for a later phase.";

export function MapEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div
      className={cn(
        storyEmbedMediaFrameClassNames(block.heightPreset),
        "flex items-center justify-center border border-dashed border-base-content/20 bg-base-content/[0.04] ring-1 ring-base-content/[0.06]",
      )}
    >
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(0,0,0,0.16)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative rounded-full border border-base-content/10 bg-base-100/75 px-4 py-2 text-center text-xs font-medium text-base-content/55 shadow-sm">
        Coming in a later phase
      </div>
    </div>
  );

  return (
    <EmbedBlockShell
      block={block}
      variant={variant}
      compact={compact}
      onConfigure={onConfigure}
      onPatchBlock={onPatchBlock}
      asset={asset}
      helper={DEFERRED_EMBED_NOTE}
    />
  );
}
