"use client";

import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { cn } from "@/lib/utils";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

const DEFERRED_EMBED_NOTE = "Map and tree embeds are planned for a later phase.";

export function TreeEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div
      className={cn(
        storyEmbedMediaFrameClassNames(block.heightPreset),
        "flex items-center justify-center border border-dashed border-base-content/20 bg-base-content/[0.04] ring-1 ring-base-content/[0.06]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-[14%] inset-y-[18%] flex flex-col items-center justify-center gap-5" aria-hidden>
        <div className="h-px w-28 bg-base-content/10" />
        <div className="grid w-full max-w-sm grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-full border border-base-content/10 bg-base-100/50 shadow-sm" />
          ))}
        </div>
        <div className="h-px w-40 bg-base-content/10" />
      </div>
      <p className="relative rounded-full border border-base-content/10 bg-base-100/75 px-4 py-2 text-center text-xs font-medium text-base-content/55 shadow-sm">
        Coming in a later phase
      </p>
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
