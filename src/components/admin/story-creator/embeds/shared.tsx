"use client";

import type { ReactNode } from "react";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryCaptionRichTextDisplay } from "@/components/admin/story-creator/StoryCaptionRichText";
import { isStoryEmbedUnconfigured } from "@/lib/admin/story-creator/story-block-config-status";
import { effectiveMediaEmbedInspectorRowLayout, storyRowInnerTextAlignClass } from "@/lib/admin/story-creator/story-block-layout";
import { StoryAssetWithTitleCaption } from "@/lib/admin/story-creator/story-block-text-layout";
import type { StoryEmbedBlock } from "@/lib/admin/story-creator/story-types";
import { cn } from "@/lib/utils";

export type EmbedBlockContentVariant = "editor" | "preview";

export type EmbedComponentProps = {
  block: StoryEmbedBlock;
  variant: EmbedBlockContentVariant;
  compact?: boolean;
  onConfigure?: () => void;
  onPatchBlock?: (patch: Partial<StoryEmbedBlock>) => void;
};

export const EMBED_KIND_LABEL: Record<StoryEmbedBlock["embedKind"], string> = {
  document: "Document",
  timeline: "Timeline",
  map: "Map",
  tree: "Tree",
  graph: "Graph",
  gallery: "Gallery",
  personSpotlight: "Person spotlight",
  familyGroup: "Family group",
  event: "Event",
  recipe: "Recipe",
};

type EmbedBlockShellProps = EmbedComponentProps & {
  asset: ReactNode;
  helper?: ReactNode | null;
  titleClassName?: string;
  captionClassName?: string;
};

export function EmbedBlockShell({
  block,
  variant,
  compact,
  onConfigure,
  asset,
  helper,
  titleClassName = "min-w-0 max-w-full sm:max-w-[min(100%,22rem)]",
  captionClassName = "min-w-0 max-w-full sm:max-w-[min(100%,22rem)]",
}: EmbedBlockShellProps) {
  const isEditor = variant === "editor";
  const unsetTitle = isStoryEmbedUnconfigured(block);
  const alignClass = storyRowInnerTextAlignClass(effectiveMediaEmbedInspectorRowLayout(block));
  const displayTitle = unsetTitle && isEditor ? "Embed block" : block.title?.trim() || block.label.trim() || EMBED_KIND_LABEL[block.embedKind];
  const helperContent =
    helper !== undefined
      ? helper
      : unsetTitle && isEditor
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

  const captionForLayout = !block.hideCaption && block.caption?.trim() ? (
    <StoryCaptionRichTextDisplay caption={block.caption} className="italic text-base-content/55" />
  ) : null;

  const titleInner =
    block.hideTitle ? null : unsetTitle && !isEditor ? (
      <p className="text-center text-xs text-muted-foreground/80">Embed block is not configured.</p>
    ) : (
      <div className="space-y-2 px-0.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold leading-snug tracking-tight text-base-content">{displayTitle}</h3>
          {unsetTitle && isEditor && onConfigure ? (
            <span className="shrink-0 text-[11px] font-medium text-base-content/45">Click to configure</span>
          ) : null}
        </div>
        {helperContent ? <p className="max-w-prose text-xs leading-relaxed text-base-content/55">{helperContent}</p> : null}
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
        titleClassName={titleClassName}
        captionClassName={captionClassName}
        asset={asset}
        title={titleInner}
        caption={captionForLayout}
      />
    </figure>
  );
}
