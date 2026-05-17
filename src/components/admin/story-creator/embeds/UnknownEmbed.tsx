"use client";

import { Code2 } from "lucide-react";
import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { cn } from "@/lib/utils";
import { EMBED_KIND_LABEL, EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function UnknownEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className={cn(storyEmbedMediaFrameClassNames(block.heightPreset), "flex items-center justify-center ring-1 ring-base-content/[0.06]")}>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.035)_50%,transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-2 rounded-xl border border-base-content/10 bg-base-100/45 px-5 py-4 text-center shadow-sm">
        <Code2 className="size-5 text-primary/75" aria-hidden />
        <p className="text-xs font-medium text-base-content/55">{EMBED_KIND_LABEL[block.embedKind]} embed placeholder</p>
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
