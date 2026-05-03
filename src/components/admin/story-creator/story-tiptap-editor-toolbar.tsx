"use client";

import { useCallback, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Bold, Code, Highlighter, Italic, Link2, Redo2, Strikethrough, Underline, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateStoryLinkUrl } from "@/components/admin/story-creator/story-tiptap-toolbar-utils";

const scrollRow =
  "flex max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function preventToolbarFocusLoss(e: ReactMouseEvent) {
  e.preventDefault();
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return <span className={cn("mx-0.5 h-6 w-px shrink-0 bg-base-content/12", className)} aria-hidden />;
}

export function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  touch,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  touch?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg text-base-content/60 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-base-200",
        touch ? "h-11 w-11 min-h-[44px] min-w-[44px]" : "h-8 w-8 min-h-8 min-w-8",
        active
          ? "bg-primary/20 text-primary ring-1 ring-primary/25"
          : "hover:bg-base-content/[0.08] hover:text-base-content",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

function useStoryInlineToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      highlight: ed.isActive("highlight"),
      inlineCode: ed.isActive("code"),
      link: ed.isActive("link"),
    }),
  });
}

function useStoryLinkSetter(editor: Editor) {
  return useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const raw = window.prompt("Link URL", prev ?? "https://");
    if (raw === null) return;
    const url = raw.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!validateStoryLinkUrl(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);
}

function InlineFormattingRow({ editor, touch }: { editor: Editor; touch?: boolean }) {
  const s = useStoryInlineToolbarState(editor);
  const setLink = useStoryLinkSetter(editor);
  return (
    <div className="border-0 bg-transparent" onMouseDownCapture={preventToolbarFocusLoss}>
      <div className={cn(scrollRow, "items-center gap-0.5 px-2 py-2")} role="toolbar" aria-label="Text formatting">
        <ToolbarButton touch={touch} label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touch} label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          touch={touch}
          label="Underline"
          active={s.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touch} label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          touch={touch}
          label="Inline code"
          active={s.inlineCode}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton touch={touch} label="Highlight" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touch} label="Link" active={s.link} onClick={setLink}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton touch={touch} label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touch} label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function DesktopGlobalToolbar({ editor }: { editor: Editor }) {
  return <InlineFormattingRow editor={editor} />;
}

function MobileGlobalToolbar({ editor }: { editor: Editor }) {
  return <InlineFormattingRow editor={editor} touch />;
}

/** Global Story Creator rich-text toolbar (desktop + mobile layouts). */
export function StoryTipTapGlobalToolbar({ editor, isTouch }: { editor: Editor; isTouch: boolean }) {
  if (isTouch) return <MobileGlobalToolbar editor={editor} />;
  return <DesktopGlobalToolbar editor={editor} />;
}
