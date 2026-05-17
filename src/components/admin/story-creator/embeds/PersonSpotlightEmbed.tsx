"use client";

import { UserRound } from "lucide-react";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function PersonSpotlightEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className="rounded-2xl border border-base-content/10 bg-base-100/70 p-4 shadow-sm ring-1 ring-base-content/[0.04] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-base-content/10 bg-base-200/70 text-primary/80 shadow-inner">
          <UserRound className="size-9" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Person spotlight</p>
          <div className="mt-2 h-4 w-44 max-w-full rounded-full bg-base-content/10" />
          <div className="mt-3 space-y-2">
            <div className="h-2.5 w-full max-w-sm rounded-full bg-base-content/[0.08]" />
            <div className="h-2.5 w-4/5 max-w-xs rounded-full bg-base-content/[0.07]" />
          </div>
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
