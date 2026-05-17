"use client";

import { FileText } from "lucide-react";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function DocumentEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className="rounded-2xl border border-base-content/10 bg-base-100/75 p-4 shadow-sm ring-1 ring-base-content/[0.04] sm:p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-base-content/10 bg-base-200/60 text-primary/75 shadow-sm">
          <FileText className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Document</p>
          <div className="mt-2 h-4 w-56 max-w-full rounded-full bg-base-content/10" />
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-full max-w-md rounded-full bg-base-content/[0.08]" />
            <div className="h-2.5 w-5/6 max-w-sm rounded-full bg-base-content/[0.07]" />
            <div className="h-2.5 w-2/3 max-w-xs rounded-full bg-base-content/[0.06]" />
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
