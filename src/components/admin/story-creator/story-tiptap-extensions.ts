import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import type { StoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";
import { StoryField } from "@/lib/admin/story-creator/story-tiptap-story-field-extension";
import { StoryTable } from "@/lib/admin/story-creator/story-tiptap-story-table";

/** Empty rich-text hint in the Story Creator canvas (TipTap placeholder). */
export const STORY_RICH_TEXT_DEFAULT_PLACEHOLDER = "enter text or insert a table";

export type CreateStoryTipTapExtensionsOptions = {
  /** For `generateHTML` / preview: resolve inline story fields to text. Ignored when `storyFieldExtension` is set. */
  storyFieldHtml?: (field: StoryFieldKey) => string;
  /** Use a custom `StoryField` build (e.g. editor with React `NodeView`). */
  storyFieldExtension?: AnyExtension;
};

/**
 * Shared TipTap extensions for Story Creator (editor + `generateHTML` preview).
 * Pass `null` for `placeholder` when extensions are only used for static HTML export (no Placeholder plugin).
 */
export function createStoryTipTapExtensions(
  placeholder: string | null = STORY_RICH_TEXT_DEFAULT_PLACEHOLDER,
  opts?: CreateStoryTipTapExtensionsOptions,
): AnyExtension[] {
  const exts: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      },
      codeBlock: {
        HTMLAttributes: {
          class: "story-editor-codeblock",
        },
      },
    }),
    Highlight.configure({
      multicolor: false,
      HTMLAttributes: {
        class: "bg-warning/35 text-base-content",
      },
    }),
    TextStyle.configure({
      mergeNestedSpanStyles: true,
      HTMLAttributes: {
        class: "story-text-style",
      },
    }),
    FontSize.configure({
      types: ["textStyle"],
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    TableKit.configure({
      table: false,
      tableCell: {
        HTMLAttributes: { class: "story-table-cell" },
      },
      tableHeader: {
        HTMLAttributes: { class: "story-table-header-cell" },
      },
      tableRow: {
        HTMLAttributes: { class: "story-table-row" },
      },
    }),
    StoryTable.configure({
      resizable: false,
      HTMLAttributes: { class: "story-table" },
    }),
  ];

  if (placeholder !== null) {
    exts.splice(
      2,
      0,
      Placeholder.configure({
        placeholder,
      }),
    );
  }

  const storyFieldExt =
    opts?.storyFieldExtension ??
    StoryField.configure({
      resolveFieldForHtml: opts?.storyFieldHtml ?? (() => ""),
    });
  exts.push(storyFieldExt);

  return exts;
}
