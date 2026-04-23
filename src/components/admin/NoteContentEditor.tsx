"use client";

import { useMemo } from "react";
import "@mdxeditor/editor/style.css";
import {
  MDXEditor,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  UndoRedo,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import { cn } from "@/lib/utils";

function validateNoteLinkUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith("/") || t.startsWith("#") || t.startsWith("./") || t.startsWith("../")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function NoteContentEditor({
  value,
  onChange,
  noteKey,
  placeholder = "Write note content (Markdown). Use the toolbar for links, lists, and headings.",
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** Remount editor when switching notes (e.g. note UUID or \"new\"). */
  noteKey: string;
  placeholder?: string;
  className?: string;
}) {
  const plugins = useMemo(
    () => [
      diffSourcePlugin({ viewMode: "rich-text" }),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper>
            <UndoRedo />
            <Separator />
            <BoldItalicUnderlineToggles />
            <Separator />
            <CreateLink />
            <Separator />
            <ListsToggle />
            <Separator />
            <BlockTypeSelect />
            <Separator />
            <InsertThematicBreak />
          </DiffSourceToggleWrapper>
        ),
      }),
      listsPlugin(),
      quotePlugin(),
      headingsPlugin(),
      linkPlugin({ validateUrl: validateNoteLinkUrl }),
      linkDialogPlugin(),
      markdownShortcutPlugin(),
      thematicBreakPlugin(),
    ],
    [],
  );

  return (
    <div
      className={cn(
        "note-mdx-editor rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] lemonade:border-[color-mix(in_oklch,var(--color-base-content)_26%,var(--color-base-300))] bg-base-100 overflow-hidden",
        "[&_.mdxeditor]:bg-base-100 [&_.mdxeditor-toolbar]:bg-base-200/80 [&_.mdxeditor-toolbar]:border-base-content/10",
        "[&_.mdxeditor-popup-container]:z-50",
        className,
      )}
    >
      <MDXEditor
        key={noteKey}
        markdown={value}
        onChange={(md) => onChange(md)}
        placeholder={placeholder}
        plugins={plugins}
        contentEditableClassName="min-h-[280px] text-base-content [caret-color:var(--color-primary)]"
        suppressHtmlProcessing
        className="mdxeditor"
      />
    </div>
  );
}
