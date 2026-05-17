"use client";

import { Network } from "lucide-react";
import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { cn } from "@/lib/utils";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function GraphEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className={cn(storyEmbedMediaFrameClassNames(block.heightPreset), "flex items-center justify-center ring-1 ring-base-content/[0.06]")}>
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_center,rgba(0,0,0,0.14)_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="pointer-events-none absolute inset-[18%]" aria-hidden>
        <div className="absolute left-[12%] top-[32%] size-5 rounded-full bg-primary/25 ring-1 ring-primary/20" />
        <div className="absolute left-[44%] top-[12%] size-7 rounded-full bg-base-content/15 ring-1 ring-base-content/10" />
        <div className="absolute right-[14%] top-[40%] size-5 rounded-full bg-primary/20 ring-1 ring-primary/15" />
        <div className="absolute bottom-[12%] left-[35%] size-6 rounded-full bg-base-content/15 ring-1 ring-base-content/10" />
        <div className="absolute bottom-[22%] right-[30%] size-4 rounded-full bg-base-content/15 ring-1 ring-base-content/10" />
      </div>
      <div className="relative flex items-center gap-2 rounded-xl border border-base-content/10 bg-base-100/65 px-4 py-3 text-xs font-medium text-base-content/55 shadow-sm">
        <Network className="size-4 text-primary/70" aria-hidden />
        Graph embed placeholder
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
