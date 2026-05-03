"use client";

import { useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  AtSign,
  Bold,
  ChevronDown,
  ChevronRight,
  Code,
  Code2,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  PanelLeft,
  PanelTop,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Rows3,
  Sparkles,
  Strikethrough,
  Table,
  TableColumnsSplit,
  Trash2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StoryEditorBottomSheet } from "@/components/admin/story-creator/story-creator-mobile";
import {
  adjustStoryFontSize,
  blockTextAlign,
  insertStoryField,
  parseFontSizePx,
  STORY_FONT_SIZE_MAX,
  STORY_FONT_SIZE_MIN,
  STORY_FONT_SIZE_STEP,
  validateStoryLinkUrl,
} from "@/components/admin/story-creator/story-tiptap-toolbar-utils";

const scrollRow =
  "flex max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const menuSurface =
  "rounded-xl border border-base-content/12 bg-base-300/95 p-2 text-base-content shadow-lg ring-1 ring-base-content/[0.06] backdrop-blur-md";

const menuItemRow =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors";

const menuItemDestructive = "text-error focus:bg-error/10 focus:text-error";

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

function MenuSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-base-content/45 first:pt-0">{children}</p>
  );
}

function useStoryToolbarEditorState(editor: Editor) {
  return useEditorState({
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
        inlineCode: ed.isActive("code"),
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
}

function BlockTypeDropdown({ editor, blockLabel, touch }: { editor: Editor; blockLabel: string; touch?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "shrink-0 gap-1 rounded-lg font-medium text-base-content/85 hover:bg-base-content/[0.08]",
          touch ? "h-11 min-h-[44px] px-3 text-sm" : "h-8 px-2.5 text-sm",
        )}
      >
        {blockLabel}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn("min-w-48", menuSurface)}>
        <DropdownMenuItem className={menuItemRow} onClick={() => editor.chain().focus().setParagraph().run()}>
          <Type className="size-4 opacity-80" aria-hidden />
          Paragraph
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemRow}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="size-4 opacity-80" aria-hidden />
          Heading 1
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemRow}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4 opacity-80" aria-hidden />
          Heading 2
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemRow}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <span className="flex size-4 items-center justify-center text-xs font-bold opacity-80" aria-hidden>
            H3
          </span>
          Heading 3
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InsertMenuItems({ editor, onDone }: { editor: Editor; onDone?: () => void }) {
  const run = (fn: () => void) => {
    fn();
    onDone?.();
  };
  return (
    <>
      <DropdownMenuItem className={menuItemRow} onClick={() => run(() => insertStoryField(editor, "title"))}>
        <Heading1 className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="flex-1">Page title</span>
        <ChevronRight className="size-4 shrink-0 opacity-40" aria-hidden />
      </DropdownMenuItem>
      <DropdownMenuItem className={menuItemRow} onClick={() => run(() => insertStoryField(editor, "subtitle"))}>
        <Heading2 className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="flex-1">Page subtitle</span>
        <ChevronRight className="size-4 shrink-0 opacity-40" aria-hidden />
      </DropdownMenuItem>
      <DropdownMenuItem className={menuItemRow} onClick={() => run(() => insertStoryField(editor, "author"))}>
        <AtSign className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="flex-1">Author</span>
        <ChevronRight className="size-4 shrink-0 opacity-40" aria-hidden />
      </DropdownMenuItem>
      <DropdownMenuItem
        className={menuItemRow}
        onClick={() =>
          run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())
        }
      >
        <Table className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="flex-1">Table</span>
        <ChevronRight className="size-4 shrink-0 opacity-40" aria-hidden />
      </DropdownMenuItem>
    </>
  );
}

function DesktopInsertDropdown({ editor }: { editor: Editor }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 shrink-0 gap-1 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-primary/15",
        )}
        aria-label="Insert"
      >
        <Plus className="size-4" strokeWidth={2.25} aria-hidden />
        Insert
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={cn("min-w-[280px]", menuSurface)}>
        <MenuSectionLabel>Insert</MenuSectionLabel>
        <InsertMenuItems editor={editor} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopMoreDropdown({ editor, s }: { editor: Editor; s: ReturnType<typeof useStoryToolbarEditorState> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 w-8 shrink-0 rounded-lg p-0 text-base-content/60 hover:bg-base-content/[0.08] hover:text-base-content",
        )}
        aria-label="More formatting"
      >
        <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={cn("min-w-[min(420px,calc(100vw-2rem))] p-3", menuSurface)}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <MenuSectionLabel>Text</MenuSectionLabel>
            <div className="flex flex-col gap-0.5">
              <DropdownMenuItem
                className={menuItemRow}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              >
                <Sparkles className="size-4 shrink-0 opacity-80" aria-hidden />
                Highlight
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemRow}
                disabled={s.fontSizePx !== null && s.fontSizePx <= STORY_FONT_SIZE_MIN}
                onClick={() => adjustStoryFontSize(editor, -STORY_FONT_SIZE_STEP)}
              >
                <Minus className="size-4 shrink-0 opacity-80" aria-hidden />
                Smaller text
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemRow}
                disabled={s.fontSizePx !== null && s.fontSizePx >= STORY_FONT_SIZE_MAX}
                onClick={() => adjustStoryFontSize(editor, STORY_FONT_SIZE_STEP)}
              >
                <Plus className="size-4 shrink-0 opacity-80" aria-hidden />
                Larger text
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemRow}
                disabled={!s.fontSizeAttr}
                onClick={() => editor.chain().focus().unsetFontSize().run()}
              >
                <RotateCcw className="size-4 shrink-0 opacity-80" aria-hidden />
                Reset text size
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemRow}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                <Code2 className="size-4 shrink-0 opacity-80" aria-hidden />
                Verse (code block)
              </DropdownMenuItem>
            </div>
          </div>
          <div>
            <MenuSectionLabel>Cleanup</MenuSectionLabel>
            <div className="flex flex-col gap-0.5">
              <DropdownMenuItem
                className={menuItemRow}
                disabled={!s.link}
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Link2Off className="size-4 shrink-0 opacity-80" aria-hidden />
                Remove link
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(menuItemRow, menuItemDestructive)}
                disabled={!s.table}
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 className="size-4 shrink-0" aria-hidden />
                Delete table
              </DropdownMenuItem>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableToolbarStrip({ editor, touch }: { editor: Editor; touch?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-primary/20 bg-base-200/40 px-2",
        touch ? "py-2.5" : "py-2",
      )}
      role="toolbar"
      aria-label="Table structure"
      onMouseDownCapture={preventToolbarFocusLoss}
    >
      <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-base-content/45">Table</span>
      <ToolbarButton touch={touch} label="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <ArrowUpToLine className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <ArrowDownToLine className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
        <Rows3 className="size-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton touch={touch} label="Add column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <ArrowLeftToLine className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <ArrowRightToLine className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <TableColumnsSplit className="size-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton touch={touch} label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
        <PanelTop className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Toggle header column" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>
        <PanelLeft className="size-4" />
      </ToolbarButton>
    </div>
  );
}

function MobileInsertSheet({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editor: Editor;
}) {
  return (
    <StoryEditorBottomSheet open={open} onOpenChange={onOpenChange} title="Insert">
      <div className="flex flex-col gap-1 pb-2">
        <MenuSectionLabel>Story fields</MenuSectionLabel>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-100/80 px-4 py-3 text-left text-sm font-medium text-base-content transition-colors hover:bg-base-content/[0.06]"
          onClick={() => {
            insertStoryField(editor, "title");
            onOpenChange(false);
          }}
        >
          <span className="flex items-center gap-3">
            <Heading1 className="size-5 opacity-80" aria-hidden />
            Page title
          </span>
          <ChevronRight className="size-4 opacity-40" aria-hidden />
        </button>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-100/80 px-4 py-3 text-left text-sm font-medium text-base-content transition-colors hover:bg-base-content/[0.06]"
          onClick={() => {
            insertStoryField(editor, "subtitle");
            onOpenChange(false);
          }}
        >
          <span className="flex items-center gap-3">
            <Heading2 className="size-5 opacity-80" aria-hidden />
            Page subtitle
          </span>
          <ChevronRight className="size-4 opacity-40" aria-hidden />
        </button>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-100/80 px-4 py-3 text-left text-sm font-medium text-base-content transition-colors hover:bg-base-content/[0.06]"
          onClick={() => {
            insertStoryField(editor, "author");
            onOpenChange(false);
          }}
        >
          <span className="flex items-center gap-3">
            <AtSign className="size-5 opacity-80" aria-hidden />
            Author
          </span>
          <ChevronRight className="size-4 opacity-40" aria-hidden />
        </button>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-100/80 px-4 py-3 text-left text-sm font-medium text-base-content transition-colors hover:bg-base-content/[0.06]"
          onClick={() => {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            onOpenChange(false);
          }}
        >
          <span className="flex items-center gap-3">
            <Table className="size-5 opacity-80" aria-hidden />
            Table
          </span>
          <ChevronRight className="size-4 opacity-40" aria-hidden />
        </button>
      </div>
    </StoryEditorBottomSheet>
  );
}

function MobileMoreSheet({
  open,
  onOpenChange,
  editor,
  s,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editor: Editor;
  s: ReturnType<typeof useStoryToolbarEditorState>;
}) {
  const close = () => onOpenChange(false);
  return (
    <StoryEditorBottomSheet open={open} onOpenChange={onOpenChange} title="More">
      <MenuSectionLabel>Text</MenuSectionLabel>
      <div className="grid grid-cols-2 gap-3 pb-4">
        <button
          type="button"
          className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/80 p-3 text-center text-xs font-semibold text-base-content shadow-sm transition-colors hover:bg-base-content/[0.06]"
          onClick={() => {
            editor.chain().focus().toggleHighlight().run();
            close();
          }}
        >
          <Sparkles className="size-7 text-primary opacity-90" aria-hidden />
          Highlight
        </button>
        <button
          type="button"
          disabled={s.fontSizePx !== null && s.fontSizePx <= STORY_FONT_SIZE_MIN}
          className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/80 p-3 text-center text-xs font-semibold text-base-content shadow-sm transition-colors hover:bg-base-content/[0.06] disabled:opacity-35"
          onClick={() => {
            adjustStoryFontSize(editor, -STORY_FONT_SIZE_STEP);
            close();
          }}
        >
          <Minus className="size-7 text-primary opacity-90" aria-hidden />
          Smaller
        </button>
        <button
          type="button"
          disabled={s.fontSizePx !== null && s.fontSizePx >= STORY_FONT_SIZE_MAX}
          className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/80 p-3 text-center text-xs font-semibold text-base-content shadow-sm transition-colors hover:bg-base-content/[0.06] disabled:opacity-35"
          onClick={() => {
            adjustStoryFontSize(editor, STORY_FONT_SIZE_STEP);
            close();
          }}
        >
          <Plus className="size-7 text-primary opacity-90" aria-hidden />
          Larger
        </button>
        <button
          type="button"
          disabled={!s.fontSizeAttr}
          className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/80 p-3 text-center text-xs font-semibold text-base-content shadow-sm transition-colors hover:bg-base-content/[0.06] disabled:opacity-35"
          onClick={() => {
            editor.chain().focus().unsetFontSize().run();
            close();
          }}
        >
          <RotateCcw className="size-7 text-primary opacity-90" aria-hidden />
          Reset size
        </button>
      </div>
      <MenuSectionLabel>Cleanup</MenuSectionLabel>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!s.link}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/80 px-4 text-sm font-semibold text-base-content transition-colors hover:bg-base-content/[0.06] disabled:opacity-35"
          onClick={() => {
            editor.chain().focus().unsetLink().run();
            close();
          }}
        >
          <Link2Off className="size-4 opacity-80" aria-hidden />
          Remove link
        </button>
        <button
          type="button"
          disabled={!s.table}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 text-sm font-semibold text-error transition-colors hover:bg-error/15 disabled:opacity-35"
          onClick={() => {
            editor.chain().focus().deleteTable().run();
            close();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete table
        </button>
      </div>
    </StoryEditorBottomSheet>
  );
}

function DesktopGlobalToolbar({ editor }: { editor: Editor }) {
  const s = useStoryToolbarEditorState(editor);
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

  const blockLabel = useMemo(() => {
    if (s.h1) return "Heading 1";
    if (s.h2) return "Heading 2";
    if (s.h3) return "Heading 3";
    return "Paragraph";
  }, [s.h1, s.h2, s.h3]);

  return (
    <div className="border-0 bg-transparent" onMouseDownCapture={preventToolbarFocusLoss}>
      <div className={cn(scrollRow, "items-center gap-0.5 px-2 py-2")} role="toolbar" aria-label="Formatting">
        <BlockTypeDropdown editor={editor} blockLabel={blockLabel} />
        <ToolbarSeparator />
        <ToolbarButton label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Inline code" active={s.inlineCode} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Insert link" active={s.link} onClick={setLink}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton label="Bullet list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Blockquote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton label="Align left" active={s.textAlign === "left"} onClick={() => editor.chain().focus().unsetTextAlign().run()}>
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={s.textAlign === "center"}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Align right" active={s.textAlign === "right"} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Justify" active={s.textAlign === "justify"} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" />
        </ToolbarButton>
        <span className="min-w-2 flex-1" aria-hidden />
        <DesktopInsertDropdown editor={editor} />
        <DesktopMoreDropdown editor={editor} s={s} />
      </div>
      {s.table ? <TableToolbarStrip editor={editor} /> : null}
    </div>
  );
}

function MobileGlobalToolbar({ editor }: { editor: Editor }) {
  const s = useStoryToolbarEditorState(editor);
  const [insertOpen, setInsertOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  const blockLabel = useMemo(() => {
    if (s.h1) return "Heading 1";
    if (s.h2) return "Heading 2";
    if (s.h3) return "Heading 3";
    return "Paragraph";
  }, [s.h1, s.h2, s.h3]);

  return (
    <div className="border-0 bg-transparent" onMouseDownCapture={preventToolbarFocusLoss}>
      <div className={cn(scrollRow, "items-center gap-0.5 px-2 py-2")} role="toolbar" aria-label="Formatting">
        <BlockTypeDropdown editor={editor} blockLabel={blockLabel} touch />
        <ToolbarButton touch label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Insert link" active={s.link} onClick={setLink}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Bullet list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Align left" touch active={s.textAlign === "left"} onClick={() => editor.chain().focus().unsetTextAlign().run()}>
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          touch
          label="Align center"
          active={s.textAlign === "center"}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Align right" active={s.textAlign === "right"} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Justify" active={s.textAlign === "justify"} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch label="Insert" onClick={() => setInsertOpen(true)}>
          <Plus className="size-4" strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton touch label="More formatting" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="size-4" strokeWidth={2} />
        </ToolbarButton>
      </div>
      {s.table ? <TableToolbarStrip editor={editor} touch /> : null}
      <MobileInsertSheet open={insertOpen} onOpenChange={setInsertOpen} editor={editor} />
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} editor={editor} s={s} />
    </div>
  );
}

/** Global Story Creator rich-text toolbar (desktop + mobile layouts). */
export function StoryTipTapGlobalToolbar({ editor, isTouch }: { editor: Editor; isTouch: boolean }) {
  if (isTouch) return <MobileGlobalToolbar editor={editor} />;
  return <DesktopGlobalToolbar editor={editor} />;
}
