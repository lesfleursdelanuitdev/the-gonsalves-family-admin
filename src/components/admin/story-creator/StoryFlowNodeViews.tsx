"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageIcon, Network, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { mediaThumbSrc, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import {
  STORY_FLOW_EMBED_NODE,
  STORY_FLOW_MEDIA_NODE,
  normalizeStoryFlowEmbedAttrs,
  normalizeStoryFlowMediaAttrs,
  storyFlowObjectClassName,
} from "@/lib/admin/story-creator/story-flow-nodes";
import type { StoryFlowEmbedAttrs, StoryFlowMediaAttrs } from "@/lib/admin/story-creator/story-types";
import { useStoryMediaById } from "@/hooks/useStoryMediaById";
import { useStoryEditorStore } from "@/features/story-creator/state/storyEditorContext";

function stopEditorClick(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function useSelectFlowNode(
  richTextBlockId: string | undefined,
  nodeType: "storyFlowMedia" | "storyFlowEmbed",
  nodeId: string,
  getPos: NodeViewProps["getPos"],
) {
  const selectFlowNode = useStoryEditorStore((s) => s.selectFlowNode);
  return (e: React.MouseEvent) => {
    stopEditorClick(e);
    if (!richTextBlockId) return;
    const pos = typeof getPos === "function" ? getPos() : undefined;
    selectFlowNode({
      richTextBlockId,
      nodeType,
      nodeId,
      pos: typeof pos === "number" ? pos : undefined,
    });
  };
}

export function StoryFlowMediaNodeView({
  node,
  selected,
  getPos,
  richTextBlockId,
}: NodeViewProps & { richTextBlockId?: string }) {
  const attrs = normalizeStoryFlowMediaAttrs(node.attrs as Partial<StoryFlowMediaAttrs>);
  const { data, isLoading } = useStoryMediaById(attrs.mediaId || undefined);
  const thumb =
    data?.fileRef != null && data.fileRef !== ""
      ? mediaThumbSrc(data.fileRef, data.form, 480) ?? resolveMediaImageSrc(data.fileRef)
      : null;
  const onClick = useSelectFlowNode(richTextBlockId, STORY_FLOW_MEDIA_NODE, attrs.id, getPos);
  const title = attrs.title || data?.title || "Media";
  return (
    <NodeViewWrapper
      as="figure"
      className={cn(storyFlowObjectClassName({ ...attrs, selected }), "not-prose")}
      data-story-flow-node-id={attrs.id}
      aria-selected={selected}
      onClick={onClick}
    >
      <div contentEditable={false} className="story-flow-object__inner">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- editor preview for already-uploaded media
          <img src={thumb} alt={attrs.alt ?? ""} className="story-flow-object__img" decoding="async" />
        ) : (
          <div className="story-flow-object__placeholder">
            <ImageIcon className="size-5 opacity-50" aria-hidden />
            <span>{isLoading && attrs.mediaId ? "Loading media..." : title}</span>
            {attrs.mediaId ? <span className="font-mono text-[10px] opacity-60">{attrs.mediaId}</span> : null}
          </div>
        )}
        {attrs.title ? <div className="story-flow-object__title">{attrs.title}</div> : null}
        {attrs.caption ? <figcaption>{attrs.caption}</figcaption> : null}
      </div>
    </NodeViewWrapper>
  );
}

function flowEmbedSummary(attrs: StoryFlowEmbedAttrs): string {
  const data = attrs.data && typeof attrs.data === "object" ? (attrs.data as Record<string, unknown>) : {};
  switch (attrs.embedKind) {
    case "tree": {
      const label = typeof data.rootPersonLabel === "string" && data.rootPersonLabel.trim() ? ` rooted at ${data.rootPersonLabel}` : "";
      return `Tree - ${String(data.chartType ?? "pedigree")} chart${label}, ${String(data.generations ?? 4)} generations`;
    }
    case "timeline":
      return `Timeline - ${String(data.sourceLabel ?? data.sourceType ?? "story events")}`;
    case "gallery":
      return `Gallery - ${String(data.sourceLabel ?? data.sourceType ?? "custom source")}${data.limit ? `, limit ${String(data.limit)}` : ""}`;
    case "map":
      return `Map - ${Array.isArray(data.eventIds) ? data.eventIds.length : 0} selected events`;
    case "personSpotlight":
      return `Person Spotlight - ${String(data.personLabel ?? "select a person")}`;
    case "familyGroup":
      return "Family Group - configure in inspector";
    case "event":
      return "Event - configure in inspector";
    case "recipe":
      return `Recipe - ${String(data.cuisine ?? data.yield ?? "configure in inspector")}`;
  }
}

export function StoryFlowEmbedNodeView({
  node,
  selected,
  getPos,
  richTextBlockId,
}: NodeViewProps & { richTextBlockId?: string }) {
  const attrs = normalizeStoryFlowEmbedAttrs(node.attrs as Partial<StoryFlowEmbedAttrs>);
  const onClick = useSelectFlowNode(richTextBlockId, STORY_FLOW_EMBED_NODE, attrs.id, getPos);
  return (
    <NodeViewWrapper
      as="figure"
      className={cn(storyFlowObjectClassName({ ...attrs, selected }), "not-prose")}
      data-story-flow-node-id={attrs.id}
      aria-selected={selected}
      onClick={onClick}
    >
      <div contentEditable={false} className="story-flow-object__inner">
        <div className="story-flow-object__placeholder story-flow-object__placeholder--embed">
          {attrs.embedKind === "timeline" ? <Rows3 className="size-5 opacity-55" aria-hidden /> : <Network className="size-5 opacity-55" aria-hidden />}
          <span className="font-semibold">{attrs.title || flowEmbedSummary(attrs)}</span>
          {attrs.title ? <span>{flowEmbedSummary(attrs)}</span> : null}
        </div>
        {attrs.caption ? <figcaption>{attrs.caption}</figcaption> : null}
      </div>
    </NodeViewWrapper>
  );
}
