"use client";

import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { cn } from "@/lib/utils";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function GalleryEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className={cn(storyEmbedMediaFrameClassNames(block.heightPreset), "ring-1 ring-base-content/[0.06]")}>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.035)_50%,transparent_65%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-[10%] inset-y-[20%] flex items-stretch justify-center gap-1.5 sm:gap-2" aria-hidden>
        <div className="flex-[0.55] rounded-md bg-base-content/[0.1] ring-1 ring-base-content/[0.06]" />
        <div className="flex-1 rounded-md bg-base-content/[0.14] ring-1 ring-base-content/[0.07]" />
        <div className="flex-[0.65] rounded-md bg-base-content/[0.1] ring-1 ring-base-content/[0.06]" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center" aria-hidden>
        <div className="flex gap-1 rounded-full bg-base-100/20 px-2.5 py-1 ring-1 ring-base-content/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="size-1.5 rounded-full bg-base-content/30" />
          ))}
        </div>
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
    />
  );
}
