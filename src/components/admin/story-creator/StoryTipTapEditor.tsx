"use client";

import { useEffect, useMemo, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  createStoryTipTapExtensions,
  STORY_RICH_TEXT_DEFAULT_PLACEHOLDER,
} from "@/components/admin/story-creator/story-tiptap-extensions";
import { normalizeStoryDocContent, storyDocJsonEquals } from "@/components/admin/story-creator/story-tiptap-doc";
import { StoryField } from "@/lib/admin/story-creator/story-tiptap-story-field-extension";
import { StoryFieldChipNodeView } from "@/components/admin/story-creator/StoryFieldChipNodeView";
import { StoryTipTapToolbar } from "@/components/admin/story-creator/StoryTipTapToolbar";
import { useStoryTiptapActiveEditorOptional } from "@/components/admin/story-creator/story-tiptap-active-editor-context";

function StoryTipTapEditorInner({
  content,
  onChange,
  placeholder,
  editable,
  className,
  toolbarDensity = "default",
  surface = "card",
}: {
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
  /** `canvas`: flat shell inside {@link StoryEditorBlockFrame} (no inner card border). `card`: bordered standalone chrome. */
  surface?: "card" | "canvas";
}) {
  const tiptapChrome = useStoryTiptapActiveEditorOptional();
  const useGlobalToolbar = Boolean(tiptapChrome);
  /** Context value identity changes when `activeEditor` updates; keep a ref so we do not re-run mount/unmount effects and accidentally clear the active editor. */
  const tiptapChromeRef = useRef(tiptapChrome);
  tiptapChromeRef.current = tiptapChrome;

  const initialDoc = useMemo(() => normalizeStoryDocContent(content), [content]);

  const storyFieldWithNodeView = useMemo(
    () =>
      StoryField.extend({
        addNodeView() {
          return ReactNodeViewRenderer(StoryFieldChipNodeView, { as: "span" });
        },
      }).configure({
        resolveFieldForHtml: () => "",
      }),
    [],
  );

  const extensions = useMemo(
    () =>
      createStoryTipTapExtensions(placeholder ?? STORY_RICH_TEXT_DEFAULT_PLACEHOLDER, {
        storyFieldExtension: storyFieldWithNodeView,
      }),
    [placeholder, storyFieldWithNodeView],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialDoc,
      editable,
      editorProps: {
        attributes: {
          class: cn(
            "story-tiptap ProseMirror max-w-none outline-none",
            toolbarDensity === "touch"
              ? "min-h-[220px] px-3 py-4 text-[16px] leading-relaxed prose-headings:my-2.5 prose-p:my-2"
              : "min-h-[280px] px-5 py-5 text-[15px] leading-relaxed prose-p:my-2 prose-headings:my-3",
            "prose prose-sm prose-invert prose-headings:font-heading prose-li:my-0.5",
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getJSON());
      },
    },
    [extensions, editable],
  );

  useEffect(() => {
    if (!editor || !editable) return;
    const chrome = tiptapChromeRef.current;
    if (!chrome) return;
    chrome.mountEditor(editor);
    const onFocus = () => tiptapChromeRef.current?.notifyEditorFocused(editor);
    const onBlur = () => tiptapChromeRef.current?.notifyEditorBlurred();
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
      tiptapChromeRef.current?.unmountEditor(editor);
    };
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: cn(
            "story-tiptap ProseMirror max-w-none outline-none",
            toolbarDensity === "touch"
              ? "min-h-[220px] px-3 py-4 text-[16px] leading-relaxed prose-headings:my-2.5 prose-p:my-2"
              : "min-h-[280px] px-5 py-5 text-[15px] leading-relaxed prose-p:my-2 prose-headings:my-3",
            "prose prose-sm prose-invert prose-headings:font-heading prose-li:my-0.5",
          ),
        },
      },
    });
  }, [editor, toolbarDensity]);

  useEffect(() => {
    if (!editor) return;
    const next = normalizeStoryDocContent(content);
    const cur = editor.getJSON();
    if (!storyDocJsonEquals(cur, next)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div
        className={cn(
          "px-3 py-8 text-center text-sm text-muted-foreground",
          surface === "canvas"
            ? "rounded-none border-0 bg-transparent"
            : "rounded-lg border border-base-content/15 bg-base-100",
          className,
        )}
      >
        Loading editor…
      </div>
    );
  }

  const showInlineToolbar = editable && !useGlobalToolbar;

  return (
    <div
      className={cn(
        "story-tiptap overflow-hidden",
        surface === "canvas"
          ? "rounded-none border-0 bg-transparent shadow-none ring-0"
          : "rounded-xl border border-base-content/12 bg-base-100 shadow-sm ring-1 ring-base-content/[0.04]",
        className,
      )}
    >
      {showInlineToolbar ? <StoryTipTapToolbar editor={editor} toolbarDensity={toolbarDensity} variant="inline" /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Controlled TipTap editor for genealogy **Story Creator** rich-text blocks.
 * Persists as TipTap JSON (`contentJson` / block payload), not arbitrary HTML/CSS.
 *
 * Remount with a distinct `editorKey` when switching sections or rich-text blocks
 * so ProseMirror state stays aligned with the active block.
 *
 * When wrapped in {@link StoryTiptapActiveEditorProvider}, the formatting toolbar is omitted here
 * and rendered once globally (see {@link StoryGlobalTipTapToolbar}).
 */
export function StoryTipTapEditor({
  editorKey,
  content,
  onChange,
  placeholder,
  editable = true,
  className,
  toolbarDensity = "default",
  surface = "card",
}: {
  editorKey: string;
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
  surface?: "card" | "canvas";
}) {
  return (
    <StoryTipTapEditorInner
      key={editorKey}
      content={content}
      onChange={onChange}
      placeholder={placeholder}
      editable={editable}
      className={className}
      toolbarDensity={toolbarDensity}
      surface={surface}
    />
  );
}

export { EMPTY_STORY_DOC, normalizeStoryDocContent, storyDocJsonEquals } from "./story-tiptap-doc";
export { STORY_RICH_TEXT_DEFAULT_PLACEHOLDER } from "./story-tiptap-extensions";
