"use client";

import { CalendarDays } from "lucide-react";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function EventEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className="rounded-2xl border border-base-content/10 bg-base-100/75 p-4 shadow-sm ring-1 ring-base-content/[0.04] sm:p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
          <CalendarDays className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Event record</p>
          <div className="mt-2 h-4 w-56 max-w-full rounded-full bg-base-content/10" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="h-9 rounded-lg border border-base-content/10 bg-base-200/45" />
            <div className="h-9 rounded-lg border border-base-content/10 bg-base-200/45" />
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
