import { mergeAttributes, Node } from "@tiptap/core";
import type { StoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";
import { isStoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";

export type StoryFieldExtensionOptions = {
  /** Used by `renderHTML` / `generateHTML` (preview). Editor uses a React node view instead. */
  resolveFieldForHtml: (field: StoryFieldKey) => string;
};

export const StoryField = Node.create<StoryFieldExtensionOptions>({
  name: "storyField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      resolveFieldForHtml: () => "",
    };
  },

  addAttributes() {
    return {
      field: {
        default: "title",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-story-field") || "title",
        renderHTML: (attrs) => ({ "data-story-field": attrs.field as string }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-story-field]",
        getAttrs: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-story-field") ?? "";
          return { field: isStoryFieldKey(raw) ? raw : "title" };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const raw = node.attrs.field as string;
    const field: StoryFieldKey = isStoryFieldKey(raw) ? raw : "title";
    const resolved = this.options.resolveFieldForHtml(field).trim();
    const empty = resolved.length === 0;
    const variantClass =
      field === "title" ? "story-field-title" : field === "subtitle" ? "story-field-subtitle" : "story-field-author";
    const cls = `story-field ${variantClass}${empty ? " story-field--empty" : ""}`;
    return [
      "span",
      mergeAttributes(
        {
          "data-story-field": field,
          class: cls,
        },
        HTMLAttributes,
      ),
      empty ? "\u2014" : resolved,
    ];
  },
});
