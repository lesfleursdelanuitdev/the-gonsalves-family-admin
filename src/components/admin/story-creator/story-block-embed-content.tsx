"use client";

import { cn } from "@/lib/utils";
import { isStoryEmbedUnconfigured } from "@/lib/admin/story-creator/story-block-config-status";
import { effectiveMediaEmbedInspectorRowLayout, storyRowInnerTextAlignClass } from "@/lib/admin/story-creator/story-block-layout";
import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { StoryAssetWithTitleCaption } from "@/lib/admin/story-creator/story-block-text-layout";
import type { StoryEmbedBlock } from "@/lib/admin/story-creator/story-types";
import { Button } from "@/components/ui/button";
import { Code2 } from "lucide-react";

export type EmbedBlockContentVariant = "editor" | "preview";

const EMBED_KIND_LABEL: Record<StoryEmbedBlock["embedKind"], string> = {
  document: "Document",
  timeline: "Timeline",
  map: "Map",
  tree: "Tree",
  graph: "Graph",
};

/**
 * Shared embed block body: chrome frame, title/sublabel/caption, height preset, row text alignment.
 * Editor variant may show layout badges and configure affordances; preview matches read-only output.
 */
export function EmbedBlockContentRenderer({
  block,
  variant,
  compact,
  onConfigure,
}: {
  block: StoryEmbedBlock;
  variant: EmbedBlockContentVariant;
  compact?: boolean;
  onConfigure?: () => void;
}) {
  const isEditor = variant === "editor";
  const unsetTitle = isStoryEmbedUnconfigured(block);
  const alignClass = storyRowInnerTextAlignClass(effectiveMediaEmbedInspectorRowLayout(block));

  const displayTitle = unsetTitle && isEditor ? "Embed block" : block.label.trim() || EMBED_KIND_LABEL[block.embedKind];
  const helper =
    unsetTitle && isEditor
      ? "Configure this block to add a slideshow, timeline, map, or external content."
      : block.sublabel?.trim() || null;

  if (compact && isEditor && unsetTitle && onConfigure) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/30 py-2 pl-2 pr-2 ring-1 ring-base-content/[0.04] sm:gap-2.5 sm:pl-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-base-content/10 bg-base-100/50">
          <Code2 className="size-4 text-primary/85" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-base-content">Embed</p>
          <p className="mt-0.5 text-[11px] leading-snug text-base-content/50">Not configured</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
        >
          Configure
        </Button>
      </div>
    );
  }

  const embedAsset = (
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

  const captionForLayout = block.caption?.trim() ? (
    <p className="text-xs italic leading-relaxed text-base-content/55">{block.caption}</p>
  ) : null;

  const titleInner =
    unsetTitle && !isEditor ? (
      <p className="text-center text-xs text-muted-foreground/80">Embed block is not configured.</p>
    ) : (
      <div className="space-y-2 px-0.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold leading-snug tracking-tight text-base-content">{displayTitle}</h3>
          {unsetTitle && isEditor && onConfigure ? (
            <span className="shrink-0 text-[11px] font-medium text-base-content/45">Click to configure</span>
          ) : null}
        </div>
        {helper ? <p className="max-w-prose text-xs leading-relaxed text-base-content/55">{helper}</p> : null}
        {isEditor && !unsetTitle ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="badge badge-ghost badge-sm h-6 border border-base-content/10 px-2 text-[10px] font-medium uppercase tracking-wide text-base-content/60">
              {block.layoutAlign ?? "center"}
            </span>
            <span className="badge badge-ghost badge-sm h-6 border border-base-content/10 px-2 text-[10px] font-medium uppercase tracking-wide text-base-content/60">
              {block.widthPreset ?? "medium"}
            </span>
            <span className="badge badge-ghost badge-sm h-6 border border-base-content/10 px-2 text-[10px] font-medium uppercase tracking-wide text-base-content/60">
              {block.heightPreset ?? "default"}
            </span>
            {block.textWrap ? (
              <span className="badge badge-sm h-6 border border-primary/35 bg-primary/10 px-2 text-[10px] font-medium uppercase tracking-wide text-primary">
                Wrap
              </span>
            ) : null}
            {block.fullWidth ? (
              <span className="badge badge-sm h-6 border border-primary/35 bg-primary/10 px-2 text-[10px] font-medium uppercase tracking-wide text-primary">
                Full width
              </span>
            ) : null}
          </div>
        ) : !isEditor && !unsetTitle ? (
          <p className="text-[11px] font-medium uppercase tracking-wide text-base-content/45">{EMBED_KIND_LABEL[block.embedKind]}</p>
        ) : null}
      </div>
    );

  return (
    <figure className={cn("min-w-0", alignClass)}>
      <StoryAssetWithTitleCaption
        titlePlacement={block.titlePlacement}
        captionPlacement={block.captionPlacement}
        titleClassName="min-w-0 max-w-full sm:max-w-[min(100%,22rem)]"
        captionClassName="min-w-0 max-w-full sm:max-w-[min(100%,22rem)]"
        asset={embedAsset}
        title={titleInner}
        caption={captionForLayout}
      />
    </figure>
  );
}
