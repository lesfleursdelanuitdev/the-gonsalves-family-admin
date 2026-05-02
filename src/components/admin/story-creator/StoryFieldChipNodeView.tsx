"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import type { StoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";
import { isStoryFieldKey, resolveStoryField, STORY_FIELD_INSERT_LABELS } from "@/lib/admin/story-creator/story-field-resolve";
import { useStoryTipTapStoryDoc } from "@/components/admin/story-creator/story-tiptap-story-doc-context";

export function StoryFieldChipNodeView(props: ReactNodeViewProps) {
  const storyDoc = useStoryTipTapStoryDoc();
  const raw = props.node.attrs.field as string;
  const field: StoryFieldKey = isStoryFieldKey(raw) ? raw : "title";
  const label = STORY_FIELD_INSERT_LABELS[field];
  const resolved = storyDoc ? resolveStoryField(field, storyDoc).trim() : "";
  const titleAttr = resolved ? `${label}: ${resolved}` : `${label} (from story settings)`;
  const variantClass =
    field === "title" ? "story-field-title" : field === "subtitle" ? "story-field-subtitle" : "story-field-author";

  return (
    <NodeViewWrapper
      as="span"
      data-story-field-chip="1"
      data-story-field={field}
      className={cn(
        "story-field",
        variantClass,
        "not-prose mx-0.5 inline-flex max-w-[min(100%,14rem)] cursor-default select-none items-center gap-1 align-baseline",
        "rounded-md border border-primary/35 bg-primary/15 px-1.5 py-px text-[11px] font-semibold leading-tight text-primary/95",
        "shadow-sm ring-1 ring-primary/10",
        props.selected && "border-primary/60 bg-primary/25 ring-primary/25",
      )}
      contentEditable={false}
      title={titleAttr}
    >
      <span className="truncate">{label}</span>
    </NodeViewWrapper>
  );
}
