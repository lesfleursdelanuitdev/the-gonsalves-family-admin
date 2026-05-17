"use client";

import { useMemo } from "react";
import type { StoryFlowNodeSelection } from "@/features/story-creator/state/storyEditorTypes";
import type { StoryFlowAlign, StoryFlowDisplayMode, StoryFlowEmbedAttrs, StoryFlowMediaAttrs, StoryFlowSize, StoryRichTextBlock } from "@/lib/admin/story-creator/story-types";
import {
  STORY_FLOW_ALIGNS,
  STORY_FLOW_DISPLAY_MODES,
  STORY_FLOW_EMBED_KINDS,
  STORY_FLOW_SIZES,
  defaultStoryFlowEmbedData,
  findStoryFlowNodeAttrs,
  normalizeStoryFlowEmbedAttrs,
  normalizeStoryFlowMediaAttrs,
} from "@/lib/admin/story-creator/story-flow-nodes";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { FieldLabel, HelperCard } from "@/components/admin/story-creator/StoryCreatorInspector";
import { MediaPicker } from "@/components/admin/media-picker";
import { cn } from "@/lib/utils";

function optionButton(active: boolean, touchComfort?: boolean) {
  return cn(
    "rounded-lg border text-center text-xs font-semibold uppercase tracking-wide transition-colors",
    touchComfort ? "min-h-11 px-3 py-2.5 text-sm" : "px-2.5 py-2",
    active
      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
      : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
  );
}

function allowedAligns(mode: StoryFlowDisplayMode): StoryFlowAlign[] {
  return mode === "wrapped" ? ["left", "right"] : STORY_FLOW_ALIGNS;
}

function allowedSizes(mode: StoryFlowDisplayMode): StoryFlowSize[] {
  return mode === "wrapped" ? ["small", "medium", "large"] : STORY_FLOW_SIZES;
}

function FlowLayoutEditor({
  value,
  onPatch,
  touchComfort,
}: {
  value: Pick<StoryFlowMediaAttrs, "displayMode" | "align" | "size">;
  onPatch: (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => void;
  touchComfort?: boolean;
}) {
  return (
    <CollapsibleFormSection title="Flow layout" defaultOpen>
      <div className="space-y-4">
        <div>
          <FieldLabel>Display mode</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {STORY_FLOW_DISPLAY_MODES.map((mode) => (
              <button key={mode} type="button" className={optionButton(value.displayMode === mode, touchComfort)} onClick={() => onPatch({ displayMode: mode })}>
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Alignment</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedAligns(value.displayMode).map((align) => (
              <button key={align} type="button" className={optionButton(value.align === align, touchComfort)} onClick={() => onPatch({ align })}>
                {align}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Size</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedSizes(value.displayMode).map((size) => (
              <button key={size} type="button" className={optionButton(value.size === size, touchComfort)} onClick={() => onPatch({ size })}>
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleFormSection>
  );
}

export function StoryFlowNodeInspector({
  storyId,
  richTextBlock,
  selection,
  onPatch,
  touchComfort,
}: {
  storyId: string;
  richTextBlock: StoryRichTextBlock;
  selection: StoryFlowNodeSelection;
  onPatch: (selection: StoryFlowNodeSelection, patch: Record<string, unknown>) => void;
  touchComfort?: boolean;
}) {
  const attrs = useMemo(
    () => findStoryFlowNodeAttrs(richTextBlock.doc, selection.nodeType, selection.nodeId),
    [richTextBlock.doc, selection.nodeId, selection.nodeType],
  );
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";

  if (!attrs) {
    return <HelperCard title="Flow object">This flow object is no longer present in the selected rich-text block.</HelperCard>;
  }

  if (selection.nodeType === "storyFlowMedia") {
    const media = normalizeStoryFlowMediaAttrs(attrs as Partial<StoryFlowMediaAttrs>);
    return (
      <div className="space-y-4">
        <HelperCard title="Flow media">This media lives inside the prose flow. Wrapped mode floats it beside following paragraphs.</HelperCard>
        <CollapsibleFormSection title="Media" defaultOpen>
          <div className="flex flex-wrap gap-2">
            <MediaPicker
              targetType="story"
              targetId={storyId}
              mode="single"
              purpose="storyIllustration"
              triggerLabel={media.mediaId ? "Replace media" : "Select media"}
              triggerClassName={cn("rounded-lg border-base-content/12 px-3 font-medium", controlH)}
              onAttach={(items) => {
                const item = items[0];
                if (!item) return;
                onPatch(selection, { mediaId: item.id, title: item.title ?? media.title });
              }}
            />
          </div>
        </CollapsibleFormSection>
        <CollapsibleFormSection title="Text" defaultOpen>
          <div className="space-y-3">
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Title" value={media.title ?? ""} onChange={(e) => onPatch(selection, { title: e.target.value })} />
            <textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg border-base-content/12 bg-base-100 text-sm" placeholder="Caption" value={media.caption ?? ""} onChange={(e) => onPatch(selection, { caption: e.target.value })} />
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Alt text" value={media.alt ?? ""} onChange={(e) => onPatch(selection, { alt: e.target.value })} />
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Credit" value={media.credit ?? ""} onChange={(e) => onPatch(selection, { credit: e.target.value })} />
          </div>
        </CollapsibleFormSection>
        <FlowLayoutEditor value={media} onPatch={(patch) => onPatch(selection, patch)} touchComfort={touchComfort} />
      </div>
    );
  }

  const embed = normalizeStoryFlowEmbedAttrs(attrs as Partial<StoryFlowEmbedAttrs>);
  const data = embed.data && typeof embed.data === "object" ? (embed.data as Record<string, unknown>) : {};
  const patchData = (patch: Record<string, unknown>) => onPatch(selection, { data: { ...data, ...patch } });

  return (
    <div className="space-y-4">
      <HelperCard title="Flow embed">This semantic embed lives inside the prose flow. Public styling can render it differently while preserving the same layout intent.</HelperCard>
      <CollapsibleFormSection title="Embed" defaultOpen>
        <div className="space-y-3">
          <div>
            <FieldLabel>Kind</FieldLabel>
            <select
              className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              value={embed.embedKind}
              onChange={(e) => {
                const embedKind = e.target.value as StoryFlowEmbedAttrs["embedKind"];
                onPatch(selection, { embedKind, data: defaultStoryFlowEmbedData(embedKind) });
              }}
            >
              {STORY_FLOW_EMBED_KINDS.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </div>
          <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Title" value={embed.title ?? ""} onChange={(e) => onPatch(selection, { title: e.target.value })} />
          <textarea className="textarea textarea-bordered min-h-20 w-full rounded-lg border-base-content/12 bg-base-100 text-sm" placeholder="Caption" value={embed.caption ?? ""} onChange={(e) => onPatch(selection, { caption: e.target.value })} />
        </div>
      </CollapsibleFormSection>
      <FlowLayoutEditor value={embed} onPatch={(patch) => onPatch(selection, patch)} touchComfort={touchComfort} />
      <CollapsibleFormSection title="Semantic configuration" defaultOpen>
        <div className="space-y-3">
          {embed.embedKind === "tree" ? (
            <>
              <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Root person label" value={String(data.rootPersonLabel ?? "")} onChange={(e) => patchData({ rootPersonLabel: e.target.value })} />
              <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} type="number" min={1} max={10} placeholder="Generations" value={String(data.generations ?? 4)} onChange={(e) => patchData({ generations: Number.parseInt(e.target.value, 10) || 4 })} />
            </>
          ) : embed.embedKind === "personSpotlight" ? (
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Person label" value={String(data.personLabel ?? "")} onChange={(e) => patchData({ personLabel: e.target.value })} />
          ) : embed.embedKind === "timeline" ? (
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Source label" value={String(data.sourceLabel ?? "")} onChange={(e) => patchData({ sourceLabel: e.target.value })} />
          ) : embed.embedKind === "gallery" ? (
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} type="number" min={1} placeholder="Limit" value={String(data.limit ?? 12)} onChange={(e) => patchData({ limit: Number.parseInt(e.target.value, 10) || 12 })} />
          ) : embed.embedKind === "map" ? (
            <input className={cn("input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100", controlH)} placeholder="Map mode" value={String(data.mapMode ?? "events")} onChange={(e) => patchData({ mapMode: e.target.value })} />
          ) : (
            <textarea className="textarea textarea-bordered min-h-28 w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs" value={JSON.stringify(data, null, 2)} onChange={(e) => {
              try {
                onPatch(selection, { data: JSON.parse(e.target.value) as Record<string, unknown> });
              } catch {
                /* keep typing until valid JSON */
              }
            }} />
          )}
        </div>
      </CollapsibleFormSection>
    </div>
  );
}
