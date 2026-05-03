"use client";

import { cn } from "@/lib/utils";
import type { StoryDividerBlock } from "@/lib/admin/story-creator/story-types";
import { getStoryDividerPreset } from "@/lib/admin/story-creator/story-types";

/**
 * Editor-only divider / spacer chrome. Published preview must not reuse label copy here.
 */
export function StoryDividerEditorChrome({ block }: { block: StoryDividerBlock }) {
  const preset = getStoryDividerPreset(block);
  const thickness = Math.min(6, Math.max(1, block.dividerThicknessPx ?? 1));

  if (preset === "spacer") {
    return (
      <div
        className="flex min-w-0 items-center justify-center rounded-md border border-dashed border-base-content/20 bg-base-content/[0.03] py-2"
        style={{ minHeight: `${block.spacerRem ?? 2}rem` }}
      >
        <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-base-content/40">
          Spacer — whitespace only when published
        </span>
      </div>
    );
  }

  if (preset === "ornamental") {
    const diamonds = block.ornamentalStyle !== "dots";
    return (
      <div className="flex min-w-0 items-center justify-center gap-3 py-5" aria-hidden>
        <div
          className="h-px min-w-[2.5rem] flex-1 max-w-[6rem] rounded-full bg-gradient-to-r from-transparent to-base-content/35"
          style={{ height: thickness }}
        />
        {diamonds ? (
          <span className="select-none text-base leading-none text-base-content/35">◇</span>
        ) : (
          <span className="select-none text-xs tracking-widest text-base-content/35">···</span>
        )}
        <div
          className="h-px min-w-[2.5rem] flex-1 max-w-[6rem] rounded-full bg-gradient-to-l from-transparent to-base-content/35"
          style={{ height: thickness }}
        />
      </div>
    );
  }

  if (preset === "sectionBreak") {
    return (
      <div className="space-y-4 py-10">
        <div className="h-px w-full bg-base-content/20" style={{ height: thickness }} />
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/35">Section break</p>
        <div className="h-px w-full bg-base-content/20" style={{ height: thickness }} />
      </div>
    );
  }

  return (
    <div className={cn("py-3")}>
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-base-content/25 to-transparent"
        style={{ height: thickness }}
      />
    </div>
  );
}
