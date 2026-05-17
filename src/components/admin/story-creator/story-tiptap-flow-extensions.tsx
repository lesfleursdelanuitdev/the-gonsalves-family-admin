"use client";

import { mergeAttributes, Node, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { StoryFlowEmbedAttrs, StoryFlowMediaAttrs } from "@/lib/admin/story-creator/story-types";
import {
  STORY_FLOW_EMBED_NODE,
  STORY_FLOW_MEDIA_NODE,
  normalizeStoryFlowEmbedAttrs,
  normalizeStoryFlowMediaAttrs,
  storyFlowObjectClassName,
} from "@/lib/admin/story-creator/story-flow-nodes";
import { StoryFlowEmbedNodeView, StoryFlowMediaNodeView } from "@/components/admin/story-creator/StoryFlowNodeViews";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    storyFlowMedia: {
      insertStoryFlowMedia: (attrs: Partial<StoryFlowMediaAttrs>) => ReturnType;
      updateStoryFlowMedia: (id: string, attrs: Partial<StoryFlowMediaAttrs>) => ReturnType;
    };
    storyFlowEmbed: {
      insertStoryFlowEmbed: (attrs: Partial<StoryFlowEmbedAttrs>) => ReturnType;
      updateStoryFlowEmbed: (id: string, attrs: Partial<StoryFlowEmbedAttrs>) => ReturnType;
    };
  }
}

type FlowExtensionOptions = {
  richTextBlockId?: string;
  nodeViews?: boolean;
  resolveMediaForHtml?: (attrs: StoryFlowMediaAttrs) => { src: string | null; title?: string | null } | null;
};

function setNodeAttrsById(
  nodeType: typeof STORY_FLOW_MEDIA_NODE | typeof STORY_FLOW_EMBED_NODE,
  id: string,
  attrs: Partial<StoryFlowMediaAttrs> | Partial<StoryFlowEmbedAttrs>,
  props: CommandProps,
): boolean {
  let found = false;
  const { state, tr, dispatch } = props;
  state.doc.descendants((node, pos) => {
    if (found || node.type.name !== nodeType || node.attrs.id !== id) return true;
    const nextAttrs =
      nodeType === STORY_FLOW_MEDIA_NODE
        ? normalizeStoryFlowMediaAttrs({ ...(node.attrs as Partial<StoryFlowMediaAttrs>), ...(attrs as Partial<StoryFlowMediaAttrs>), id })
        : normalizeStoryFlowEmbedAttrs({ ...(node.attrs as Partial<StoryFlowEmbedAttrs>), ...(attrs as Partial<StoryFlowEmbedAttrs>), id });
    tr.setNodeMarkup(pos, undefined, nextAttrs);
    found = true;
    return false;
  });
  if (!found) return false;
  dispatch?.(tr);
  return true;
}

export function createStoryFlowMediaExtension(options: FlowExtensionOptions = {}) {
  return Node.create({
    name: STORY_FLOW_MEDIA_NODE,
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    defining: true,

    addAttributes() {
      return {
        id: { default: null },
        mediaId: { default: "" },
        mediaType: { default: "image" },
        title: { default: null },
        caption: { default: null },
        alt: { default: null },
        credit: { default: null },
        displayMode: { default: "block" },
        align: { default: "center" },
        size: { default: "medium" },
      };
    },

    parseHTML() {
      return [{ tag: `figure[data-story-flow-node="${STORY_FLOW_MEDIA_NODE}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      const attrs = normalizeStoryFlowMediaAttrs(HTMLAttributes as Partial<StoryFlowMediaAttrs>);
      const media = options.resolveMediaForHtml?.(attrs) ?? null;
      const title = attrs.title || media?.title || "Media";
      const mediaContent = media?.src
        ? ["img", { src: media.src, alt: attrs.alt ?? "", class: "story-flow-object__img", decoding: "async", loading: "lazy" }]
        : ["div", { class: "media-preview story-flow-object__placeholder" }, title];
      return [
        "figure",
        mergeAttributes(HTMLAttributes, {
          "data-story-flow-node": STORY_FLOW_MEDIA_NODE,
          "data-story-flow-node-id": attrs.id,
          class: storyFlowObjectClassName(attrs),
        }),
        ["div", { class: "story-flow-object__inner" }, mediaContent],
        attrs.caption ? ["figcaption", {}, attrs.caption] : ["figcaption", { hidden: "hidden" }, ""],
      ];
    },

    addNodeView() {
      if (options.nodeViews === false) return null;
      const richTextBlockId = options.richTextBlockId;
      return ReactNodeViewRenderer((props) => <StoryFlowMediaNodeView {...props} richTextBlockId={richTextBlockId} />);
    },

    addCommands() {
      return {
        insertStoryFlowMedia:
          (attrs) =>
          ({ commands }) => {
            const nextAttrs = normalizeStoryFlowMediaAttrs(attrs);
            return commands.insertContent([{ type: STORY_FLOW_MEDIA_NODE, attrs: nextAttrs }, { type: "paragraph" }]);
          },
        updateStoryFlowMedia:
          (id, attrs) =>
          (props) =>
            setNodeAttrsById(STORY_FLOW_MEDIA_NODE, id, attrs, props),
      };
    },
  });
}

export function createStoryFlowEmbedExtension(options: FlowExtensionOptions = {}) {
  return Node.create({
    name: STORY_FLOW_EMBED_NODE,
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    defining: true,

    addAttributes() {
      return {
        id: { default: null },
        title: { default: null },
        caption: { default: null },
        embedKind: { default: "timeline" },
        data: { default: {} },
        presentation: { default: { chrome: "minimal", controls: false } },
        displayMode: { default: "block" },
        align: { default: "center" },
        size: { default: "medium" },
      };
    },

    parseHTML() {
      return [{ tag: `figure[data-story-flow-node="${STORY_FLOW_EMBED_NODE}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      const attrs = normalizeStoryFlowEmbedAttrs(HTMLAttributes as Partial<StoryFlowEmbedAttrs>);
      const label = attrs.title || `${attrs.embedKind} embed`;
      return [
        "figure",
        mergeAttributes(HTMLAttributes, {
          "data-story-flow-node": STORY_FLOW_EMBED_NODE,
          "data-story-flow-node-id": attrs.id,
          class: storyFlowObjectClassName(attrs),
        }),
        ["div", { class: "story-flow-object__inner" }, ["div", { class: "story-flow-object__placeholder" }, label]],
        attrs.caption ? ["figcaption", {}, attrs.caption] : ["figcaption", { hidden: "hidden" }, ""],
      ];
    },

    addNodeView() {
      if (options.nodeViews === false) return null;
      const richTextBlockId = options.richTextBlockId;
      return ReactNodeViewRenderer((props) => <StoryFlowEmbedNodeView {...props} richTextBlockId={richTextBlockId} />);
    },

    addCommands() {
      return {
        insertStoryFlowEmbed:
          (attrs) =>
          ({ commands }) => {
            const nextAttrs = normalizeStoryFlowEmbedAttrs(attrs);
            return commands.insertContent([{ type: STORY_FLOW_EMBED_NODE, attrs: nextAttrs }, { type: "paragraph" }]);
          },
        updateStoryFlowEmbed:
          (id, attrs) =>
          (props) =>
            setNodeAttrsById(STORY_FLOW_EMBED_NODE, id, attrs, props),
      };
    },
  });
}

export function createStoryFlowNodeExtensions(options: FlowExtensionOptions = {}) {
  return [createStoryFlowMediaExtension(options), createStoryFlowEmbedExtension(options)];
}
