"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { useEditor, EditorContent, useEditorState, ReactNodeViewRenderer } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Braces,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  PanelLeft,
  PanelTop,
  Quote,
  Minus,
  MoreHorizontal,
  Plus,
  Rows3,
  Redo2,
  RotateCcw,
  Strikethrough,
  Table,
  TableColumnsSplit,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createStoryTipTapExtensions } from "@/components/admin/story-creator/story-tiptap-extensions";
import { normalizeStoryDocContent, storyDocJsonEquals } from "@/components/admin/story-creator/story-tiptap-doc";
import { StoryField } from "@/lib/admin/story-creator/story-tiptap-story-field-extension";
import type { StoryFieldKey } from "@/lib/admin/story-creator/story-field-resolve";
import { StoryFieldChipNodeView } from "@/components/admin/story-creator/StoryFieldChipNodeView";

/** Alignment for the nearest paragraph or heading (list items use inner paragraphs). */
function blockTextAlign(editor: Editor): "left" | "center" | "right" | "justify" {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      const ta = node.attrs.textAlign as string | undefined | null;
      if (ta === "center" || ta === "right" || ta === "justify" || ta === "left") return ta;
      return "left";
    }
  }
  return "left";
}

function insertStoryField(editor: Editor, field: StoryFieldKey) {
  editor.chain().focus().insertContent({ type: "storyField", attrs: { field } }).run();
}

function validateStoryLinkUrl(url: string): boolean {
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

/** Body copy size in the editor chrome (`text-[15px]` / touch `text-[16px]`); used when no `textStyle` mark is set. */
const STORY_FONT_SIZE_BASE_PX = 15;
const STORY_FONT_SIZE_STEP = 2;
const STORY_FONT_SIZE_MIN = 10;
const STORY_FONT_SIZE_MAX = 56;

function parseFontSizePx(raw: unknown): number | null {
  if (raw == null || typeof raw !== "string") return null;
  const m = /^([\d.]+)\s*px\s*$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function adjustStoryFontSize(editor: Editor, deltaPx: number) {
  const cur = parseFontSizePx(editor.getAttributes("textStyle").fontSize);
  const base = cur ?? STORY_FONT_SIZE_BASE_PX;
  const next = Math.min(STORY_FONT_SIZE_MAX, Math.max(STORY_FONT_SIZE_MIN, base + deltaPx));
  editor.chain().focus().setFontSize(`${next}px`).run();
}

function ToolbarBtn({
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
  /** Larger hit targets for mobile / touch layouts */
  touch?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg text-base-content/55 transition-colors",
        touch ? "h-11 w-11 min-h-[44px] min-w-[44px]" : "h-9 w-9",
        active
          ? "bg-primary/20 text-primary shadow-sm ring-1 ring-primary/20"
          : "hover:bg-base-content/[0.08] hover:text-base-content",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function StoryTipTapToolbar({
  editor,
  toolbarDensity = "default",
}: {
  editor: Editor;
  toolbarDensity?: "default" | "touch";
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const fontSizeAttr = ed.getAttributes("textStyle").fontSize as string | undefined;
      const fontSizePx = parseFontSizePx(fontSizeAttr);
      return {
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        underline: ed.isActive("underline"),
        strike: ed.isActive("strike"),
        highlight: ed.isActive("highlight"),
        h1: ed.isActive("heading", { level: 1 }),
        h2: ed.isActive("heading", { level: 2 }),
        h3: ed.isActive("heading", { level: 3 }),
        bullet: ed.isActive("bulletList"),
        ordered: ed.isActive("orderedList"),
        quote: ed.isActive("blockquote"),
        codeBlock: ed.isActive("codeBlock"),
        link: ed.isActive("link"),
        table: ed.isActive("table"),
        textAlign: blockTextAlign(ed),
        fontSizePx,
        fontSizeAttr: fontSizeAttr?.trim() ? fontSizeAttr : undefined,
      };
    },
  });

  const setLink = useCallback(() => {
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

  const scrollRow =
    "flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  if (toolbarDensity === "touch") {
    return (
      <div className="border-b border-base-content/10 bg-base-200/40">
        <div className={cn(scrollRow, "px-2 py-2.5")} role="toolbar" aria-label="Formatting">
          <ToolbarBtn touch label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn touch label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="size-4" />
          </ToolbarBtn>
          <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
          <ToolbarBtn
            touch
            label="Heading 1"
            active={s.h1}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Heading 2"
            active={s.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="size-4" />
          </ToolbarBtn>
          <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
          <ToolbarBtn touch label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn touch label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Smaller text"
            disabled={s.fontSizePx !== null && s.fontSizePx <= STORY_FONT_SIZE_MIN}
            onClick={() => adjustStoryFontSize(editor, -STORY_FONT_SIZE_STEP)}
          >
            <Minus className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Larger text"
            disabled={s.fontSizePx !== null && s.fontSizePx >= STORY_FONT_SIZE_MAX}
            onClick={() => adjustStoryFontSize(editor, STORY_FONT_SIZE_STEP)}
          >
            <Plus className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Reset text size"
            disabled={!s.fontSizeAttr}
            onClick={() => editor.chain().focus().unsetFontSize().run()}
          >
            <RotateCcw className="size-4" />
          </ToolbarBtn>
          <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
          <ToolbarBtn
            touch
            label="Align left"
            active={s.textAlign === "left"}
            onClick={() => editor.chain().focus().unsetTextAlign().run()}
          >
            <AlignLeft className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Align center"
            active={s.textAlign === "center"}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Align right"
            active={s.textAlign === "right"}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Justify"
            active={s.textAlign === "justify"}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Bullet list"
            active={s.bullet}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn
            touch
            label="Numbered list"
            active={s.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn touch label="Insert link" active={s.link} onClick={setLink}>
            <Link2 className="size-4" />
          </ToolbarBtn>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-base-content/55 transition-colors hover:bg-base-content/[0.08] hover:text-base-content"
              aria-label="Insert story field"
            >
              <Braces className="size-4" strokeWidth={2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuItem className="min-h-10 py-2.5" onClick={() => insertStoryField(editor, "title")}>
                Page title
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10 py-2.5" onClick={() => insertStoryField(editor, "subtitle")}>
                Page subtitle
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10 py-2.5" onClick={() => insertStoryField(editor, "author")}>
                Author
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-base-content/55 transition-colors hover:bg-base-content/[0.08] hover:text-base-content"
              aria-label="More formatting"
            >
              <MoreHorizontal className="size-5" strokeWidth={2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                Heading 3
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                Underline
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10 py-2.5" onClick={() => editor.chain().focus().toggleStrike().run()}>
                Strikethrough
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              >
                Highlight
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                Blockquote
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                Verse (code block)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
              >
                Insert 3×3 table (header row)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                disabled={!s.link}
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                Remove link
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5 text-error focus:text-error"
                disabled={!s.table}
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                Delete table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {s.table ? (
          <div
            className={cn(scrollRow, "gap-x-1 gap-y-1 border-t border-base-content/10 px-2 py-2.5")}
            role="toolbar"
            aria-label="Table structure"
          >
            <span className="mr-1 shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-base-content/45">
              Table
            </span>
            <ToolbarBtn touch label="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
              <ArrowUpToLine className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn touch label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
              <ArrowDownToLine className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn touch label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
              <Rows3 className="size-4" />
            </ToolbarBtn>
            <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
            <ToolbarBtn touch label="Add column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
              <ArrowLeftToLine className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn touch label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <ArrowRightToLine className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn touch label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
              <TableColumnsSplit className="size-4" />
            </ToolbarBtn>
            <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
            <ToolbarBtn touch label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              <PanelTop className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn
              touch
              label="Toggle header column"
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
            >
              <PanelLeft className="size-4" />
            </ToolbarBtn>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-base-content/10 bg-base-200/40">
    <div
      className="flex flex-wrap items-center gap-1 px-2 py-2"
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarBtn label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn
        label="Heading 1"
        active={s.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Heading 2"
        active={s.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Heading 3"
        active={s.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Underline"
        active={s.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Strikethrough"
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Highlight"
        active={s.highlight}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn
        label="Smaller text"
        disabled={s.fontSizePx !== null && s.fontSizePx <= STORY_FONT_SIZE_MIN}
        onClick={() => adjustStoryFontSize(editor, -STORY_FONT_SIZE_STEP)}
      >
        <Minus className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Larger text"
        disabled={s.fontSizePx !== null && s.fontSizePx >= STORY_FONT_SIZE_MAX}
        onClick={() => adjustStoryFontSize(editor, STORY_FONT_SIZE_STEP)}
      >
        <Plus className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Reset text size"
        disabled={!s.fontSizeAttr}
        onClick={() => editor.chain().focus().unsetFontSize().run()}
      >
        <RotateCcw className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn
        label="Align left"
        active={s.textAlign === "left"}
        onClick={() => editor.chain().focus().unsetTextAlign().run()}
      >
        <AlignLeft className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Align center"
        active={s.textAlign === "center"}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Align right"
        active={s.textAlign === "right"}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Justify"
        active={s.textAlign === "justify"}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn
        label="Bullet list"
        active={s.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Numbered list"
        active={s.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Blockquote"
        active={s.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Verse (preserve whitespace)"
        active={s.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="size-4" />
      </ToolbarBtn>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn label="Insert link" active={s.link} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Remove link"
        disabled={!s.link}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="size-4" />
      </ToolbarBtn>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-9 w-9 shrink-0 rounded-lg p-0 text-base-content/55 hover:bg-base-content/[0.08] hover:text-base-content",
          )}
          aria-label="Insert story field"
        >
          <Braces className="size-4" strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuItem className="min-h-9 py-2" onClick={() => insertStoryField(editor, "title")}>
            Page title
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-9 py-2" onClick={() => insertStoryField(editor, "subtitle")}>
            Page subtitle
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-9 py-2" onClick={() => insertStoryField(editor, "author")}>
            Author
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
      <ToolbarBtn
        label="Insert 3×3 table with header row (use Table bar below to resize or change headers)"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        label="Delete table"
        disabled={!s.table}
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 className="size-4" />
      </ToolbarBtn>
    </div>
    {s.table ? (
      <div
        className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-base-content/10 px-2 py-2"
        role="toolbar"
        aria-label="Table structure"
      >
        <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-base-content/45">
          Table
        </span>
        <ToolbarBtn label="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
          <ArrowUpToLine className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
          <ArrowDownToLine className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
          <Rows3 className="size-4" />
        </ToolbarBtn>
        <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
        <ToolbarBtn label="Add column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
          <ArrowLeftToLine className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <ArrowRightToLine className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
          <TableColumnsSplit className="size-4" />
        </ToolbarBtn>
        <span className="mx-1 h-6 w-px shrink-0 bg-base-content/12" aria-hidden />
        <ToolbarBtn
          label="Toggle header row"
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        >
          <PanelTop className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Toggle header column"
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
        >
          <PanelLeft className="size-4" />
        </ToolbarBtn>
      </div>
    ) : null}
    </div>
  );
}

function StoryTipTapEditorInner({
  content,
  onChange,
  placeholder,
  editable,
  className,
  toolbarDensity = "default",
}: {
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
}) {
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
      createStoryTipTapExtensions(placeholder ?? "Write this section…", {
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
          "rounded-lg border border-base-content/15 bg-base-100 px-3 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "story-tiptap overflow-hidden rounded-xl border border-base-content/12 bg-base-100 shadow-sm ring-1 ring-base-content/[0.04]",
        className,
      )}
    >
      {editable ? <StoryTipTapToolbar editor={editor} toolbarDensity={toolbarDensity} /> : null}
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
 */
export function StoryTipTapEditor({
  editorKey,
  content,
  onChange,
  placeholder,
  editable = true,
  className,
  toolbarDensity = "default",
}: {
  editorKey: string;
  content: unknown;
  onChange: (json: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  toolbarDensity?: "default" | "touch";
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
    />
  );
}

export { EMPTY_STORY_DOC, normalizeStoryDocContent, storyDocJsonEquals } from "./story-tiptap-doc";
