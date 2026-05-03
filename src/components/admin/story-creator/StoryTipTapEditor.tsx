"use client";

import { useEffect, useMemo, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { createStoryTipTapExtensions } from "@/components/admin/story-creator/story-tiptap-extensions";
import { normalizeStoryDocContent, storyDocJsonEquals } from "@/components/admin/story-creator/story-tiptap-doc";
import { StoryField } from "@/lib/admin/story-creator/story-tiptap-story-field-extension";
import { StoryFieldChipNodeView } from "@/components/admin/story-creator/StoryFieldChipNodeView";
import { StoryTipTapToolbar } from "@/components/admin/story-creator/StoryTipTapToolbar";
import { useStoryTiptapActiveEditorOptional } from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import { useStoryTipTapCanvasTone } from "@/components/admin/story-creator/story-tiptap-canvas-tone";
import type { StoryRichTextTextPreset } from "@/lib/admin/story-creator/story-types";

function proseMirrorToneClass(
  tone: "admin" | "paper",
  toolbarDensity: "default" | "touch",
  richTextPreset: StoryRichTextTextPreset,
  verseSpacing: "compact" | "relaxed" | undefined,
  quoteStyle: "simple" | "card" | undefined,
) {
  const pad =
    toolbarDensity === "touch"
      ? "min-h-[220px] px-3 py-4 text-[16px] leading-relaxed prose-headings:my-2.5 prose-p:my-2"
      : "min-h-[280px] px-5 py-5 text-[15px] leading-relaxed prose-p:my-2 prose-headings:my-3";
  /** On the white document canvas, semantic `base-content` stays tied to the dark admin shell — use neutral ink instead. */
  const prose =
    tone === "paper"
      ? cn(
          "prose prose-sm prose-neutral max-w-none text-neutral-900",
          "prose-headings:font-heading prose-headings:text-neutral-900",
          "prose-strong:text-neutral-900 prose-p:text-neutral-800 prose-li:text-neutral-800 prose-li:my-0.5",
        )
      : "prose prose-sm prose-invert prose-headings:font-heading prose-li:my-0.5";
  const presetShell =
    richTextPreset === "heading"
      ? cn(
          "font-bold tracking-tight",
          tone === "paper" ? "text-neutral-900" : "text-base-content",
          toolbarDensity === "touch" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl",
        )
      : richTextPreset === "list"
        ? "prose-ul:my-1 prose-ol:my-1"
        : richTextPreset === "verse"
          ? cn(
              "whitespace-pre-wrap font-serif text-[0.98rem] leading-[1.75]",
              tone === "paper" && "text-neutral-900",
              verseSpacing === "compact" ? "space-y-0" : "space-y-1",
            )
          : richTextPreset === "quote"
            ? (quoteStyle ?? "simple") === "card"
              ? cn(
                  "italic prose-blockquote:border-none prose-blockquote:pl-0 prose-blockquote:italic",
                  tone === "paper" ? "text-neutral-800" : "text-base-content/95",
                )
              : cn(
                  "border-l-[3px] pl-4 italic prose-blockquote:border-none prose-blockquote:pl-0 prose-blockquote:italic",
                  tone === "paper"
                    ? "border-neutral-300 text-neutral-800"
                    : "border-base-content/25 text-base-content/95",
                )
            : "";
  return cn(
    "story-tiptap ProseMirror max-w-none outline-none",
    tone === "paper" && "story-tiptap--paper",
    pad,
    prose,
    presetShell,
  );
}

function defaultPlaceholderForPreset(preset: StoryRichTextTextPreset): string {
  switch (preset) {
    case "heading":
      return "Write a heading…";
    case "list":
      return "Add list items…";
    case "verse":
      return "Write verse…";
    case "quote":
      return "Add a quote…";
    default:
      return "Start writing…";
  }
}

function StoryTipTapEditorInner({
  content,
  onChange,
  placeholder,
  editable,
  className,
  toolbarDensity = "default",
  surface = "card",
  richTextPreset = "paragraph",
  quoteStyle,
  verseSpacing,
}: {
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
  /** `canvas`: flat shell inside {@link StoryEditorBlockFrame} (no inner card border). `card`: bordered standalone chrome. */
  surface?: "card" | "canvas";
  /** Semantic block preset from story JSON (drives chrome only; doc remains TipTap JSON). */
  richTextPreset?: StoryRichTextTextPreset;
  quoteStyle?: "simple" | "card";
  verseSpacing?: "compact" | "relaxed";
}) {
  const canvasTone = useStoryTipTapCanvasTone();
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

  const resolvedPlaceholder = placeholder ?? defaultPlaceholderForPreset(richTextPreset);

  const extensions = useMemo(
    () =>
      createStoryTipTapExtensions(resolvedPlaceholder, {
        storyFieldExtension: storyFieldWithNodeView,
      }),
    [resolvedPlaceholder, storyFieldWithNodeView],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialDoc,
      editable,
      editorProps: {
        attributes: {
          class: proseMirrorToneClass(canvasTone, toolbarDensity, richTextPreset, verseSpacing, quoteStyle),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getJSON());
      },
    },
    [extensions, editable, canvasTone, toolbarDensity, richTextPreset, verseSpacing, quoteStyle],
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
          class: proseMirrorToneClass(canvasTone, toolbarDensity, richTextPreset, verseSpacing, quoteStyle),
        },
      },
    });
  }, [editor, toolbarDensity, canvasTone, richTextPreset, verseSpacing, quoteStyle]);

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
  const quoteCard = richTextPreset === "quote" && (quoteStyle ?? "simple") === "card";

  const editorBody = (
    <>
      {showInlineToolbar ? <StoryTipTapToolbar editor={editor} toolbarDensity={toolbarDensity} variant="inline" /> : null}
      <EditorContent editor={editor} />
    </>
  );

  return (
    <div
      className={cn(
        "story-tiptap overflow-hidden",
        canvasTone === "paper" && "story-tiptap--paper",
        surface === "canvas"
          ? "rounded-none border-0 bg-transparent shadow-none ring-0"
          : "rounded-xl border border-base-content/12 bg-base-100 shadow-sm ring-1 ring-base-content/[0.04]",
        quoteCard &&
          (canvasTone === "paper"
            ? "rounded-lg border border-neutral-200/90 bg-neutral-50/90 p-3 ring-1 ring-neutral-900/[0.06]"
            : "rounded-lg border border-base-content/12 bg-base-content/[0.04] p-3 ring-1 ring-base-content/[0.06]"),
        className,
      )}
    >
      {quoteCard ? <div className={cn(!showInlineToolbar && "pt-0")}>{editorBody}</div> : editorBody}
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
  richTextPreset = "paragraph",
  quoteStyle,
  verseSpacing,
}: {
  editorKey: string;
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
  surface?: "card" | "canvas";
  richTextPreset?: StoryRichTextTextPreset;
  quoteStyle?: "simple" | "card";
  verseSpacing?: "compact" | "relaxed";
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
      richTextPreset={richTextPreset}
      quoteStyle={quoteStyle}
      verseSpacing={verseSpacing}
    />
  );
}

export { EMPTY_STORY_DOC, normalizeStoryDocContent, storyDocJsonEquals } from "./story-tiptap-doc";
export { STORY_RICH_TEXT_DEFAULT_PLACEHOLDER } from "./story-tiptap-extensions";
