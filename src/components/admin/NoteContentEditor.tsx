"use client";

import { useCallback, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading1,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSafeNoteLinkHref, markdownToSafeHtml, safeHtmlToMarkdown } from "@/lib/notes/sanitize-note-markdown";

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-base-content/[0.08] hover:text-foreground",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

function TiptapNoteEditorInner({
  initialMarkdown,
  onChange,
  placeholderText,
  className,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  placeholderText: string | null;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        isAllowedUri: (url) => isSafeNoteLinkHref(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      ...(placeholderText
        ? [
            Placeholder.configure({
              placeholder: placeholderText,
            }),
          ]
        : []),
    ],
    content: markdownToSafeHtml(initialMarkdown),
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] px-3 py-3 text-base-content outline-none [caret-color:var(--color-primary)] prose prose-sm max-w-none dark:prose-invert focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(safeHtmlToMarkdown(ed.getHTML()));
    },
  });

  const onAddLink = useCallback(() => {
    if (!editor) return;
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const raw = window.prompt("Enter URL", prev);
    if (raw == null) return;
    const url = raw.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!isSafeNoteLinkHref(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[280px] animate-pulse rounded-lg border border-base-content/10 bg-base-content/[0.04]",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border border-base-content/20 bg-base-100", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-base-content/10 bg-base-200/40 px-2 py-1.5">
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-base-content/20" />
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Paragraph"
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={onAddLink}>
          <Link2 className="size-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
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
  placeholder?: ReactNode;
  className?: string;
}) {
  const placeholderText = typeof placeholder === "string" ? placeholder : null;

  return (
    <div
      className={cn(
        "relative rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] bg-base-100 overflow-hidden",
        className,
      )}
    >
      {typeof placeholder === "string" ? null : placeholder ? (
        <div className="pointer-events-none absolute left-3 top-[52px] z-0 text-sm text-muted-foreground/60">{placeholder}</div>
      ) : null}
      <TiptapNoteEditorInner
        key={noteKey}
        initialMarkdown={value}
        onChange={onChange}
        placeholderText={placeholderText}
        className="border-0"
      />
    </div>
  );
}
