"use client";

import { UsersRound } from "lucide-react";
import { EmbedBlockShell, type EmbedComponentProps } from "@/components/admin/story-creator/embeds/shared";

export function FamilyGroupEmbed({ block, variant, compact, onConfigure, onPatchBlock }: EmbedComponentProps) {
  const asset = (
    <div className="rounded-2xl border border-base-content/10 bg-gradient-to-br from-base-100/80 to-base-200/55 p-4 shadow-sm ring-1 ring-base-content/[0.04] sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-base-content/10 bg-base-100/75 text-primary/80 shadow-sm">
          <UsersRound className="size-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">Family group</p>
          <div className="mt-2 h-3.5 w-48 max-w-full rounded-full bg-base-content/10" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-base-content/10 bg-base-100/55 p-3">
            <div className="mx-auto size-9 rounded-full bg-base-content/[0.08]" />
            <div className="mx-auto mt-3 h-2 w-14 rounded-full bg-base-content/[0.08]" />
          </div>
        ))}
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
