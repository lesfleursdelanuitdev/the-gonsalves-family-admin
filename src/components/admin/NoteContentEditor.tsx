"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
} from "lexical";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  ELEMENT_TRANSFORMERS,
  LINK,
  TEXT_FORMAT_TRANSFORMERS,
} from "@lexical/markdown";
import { $createHeadingNode, HeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $createQuoteNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { Bold, Italic, List, ListOrdered, Quote, Redo2, Undo2, Link2, Heading1, Pilcrow } from "lucide-react";
import { cn } from "@/lib/utils";

const MARKDOWN_TRANSFORMERS = [
  ...ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  LINK,
];

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

function InitialMarkdownPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (markdown.trim()) {
        $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS);
      } else {
        root.append($createParagraphNode().append($createTextNode("")));
      }
    });
  }, [editor, markdown]);
  return null;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-base-content/[0.08] hover:text-foreground"
    >
      {children}
    </button>
  );
}

function LexicalToolbar() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<"paragraph" | "heading" | "quote">("paragraph");

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return;
          const anchorNode = sel.anchor.getNode();
          const top = anchorNode.getTopLevelElementOrThrow();
          if ($isHeadingNode(top)) {
            setBlockType("heading");
            return;
          }
          if (top.getType() === "quote") {
            setBlockType("quote");
            return;
          }
          setBlockType("paragraph");
        });
      }),
    [editor],
  );

  const setParagraph = useCallback(() => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      sel.getNodes().forEach((n) => {
        const top = n.getTopLevelElementOrThrow();
        top.replace($createParagraphNode(), true);
      });
    });
  }, [editor]);

  const setHeading = useCallback(() => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      sel.getNodes().forEach((n) => {
        const top = n.getTopLevelElementOrThrow();
        top.replace($createHeadingNode("h2"), true);
      });
    });
  }, [editor]);

  const setQuote = useCallback(() => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      sel.getNodes().forEach((n) => {
        const top = n.getTopLevelElementOrThrow();
        top.replace($createQuoteNode(), true);
      });
    });
  }, [editor]);

  const onAddLink = useCallback(() => {
    const raw = window.prompt("Enter URL");
    if (!raw) return;
    const url = raw.trim();
    if (!validateNoteLinkUrl(url)) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-base-content/10 bg-base-200/40 px-2 py-1.5">
      <ToolbarButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 className="size-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-base-content/20" />
      <ToolbarButton label="Bold" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading" onClick={setHeading}>
        <Heading1 className={cn("size-4", blockType === "heading" && "text-primary")} />
      </ToolbarButton>
      <ToolbarButton label="Paragraph" onClick={setParagraph}>
        <Pilcrow className={cn("size-4", blockType === "paragraph" && "text-primary")} />
      </ToolbarButton>
      <ToolbarButton label="Quote" onClick={setQuote}>
        <Quote className={cn("size-4", blockType === "quote" && "text-primary")} />
      </ToolbarButton>
      <ToolbarButton label="Bulleted list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Remove list" onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)}>
        <Pilcrow className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Link" onClick={onAddLink}>
        <Link2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function NoteContentEditor({
  value,
  onChange,
  noteKey,
  placeholder = null,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** Remount editor when switching notes (e.g. note UUID or \"new\"). */
  noteKey: string;
  /** Optional empty-state hint; keep short — editor shell is `relative` so this stays inside the box. */
  placeholder?: ReactNode;
  className?: string;
}) {
  const initialConfig = {
    namespace: `AdminNoteEditor-${noteKey}`,
    onError: (error: Error) => {
      console.error(error);
    },
    editable: true,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
  };

  const onStateChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        onChange($convertToMarkdownString(MARKDOWN_TRANSFORMERS));
      });
    },
    [onChange],
  );

  return (
    <div
      className={cn(
        "relative rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] bg-base-100 overflow-hidden",
        className,
      )}
    >
      <LexicalComposer key={noteKey} initialConfig={initialConfig}>
        <InitialMarkdownPlugin markdown={value} />
        <LexicalToolbar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[280px] px-3 py-3 text-base-content outline-none [caret-color:var(--color-primary)]"
              aria-label="Note body"
            />
          }
          placeholder={
            placeholder ? (
              <div className="pointer-events-none absolute left-3 top-[52px] z-0 text-sm text-muted-foreground/60">
                {placeholder}
              </div>
            ) : null
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin validateUrl={validateNoteLinkUrl} />
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <OnChangePlugin onChange={onStateChange} />
      </LexicalComposer>
    </div>
  );
}
