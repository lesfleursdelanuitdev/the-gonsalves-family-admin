"use client";

import { useCallback, useMemo, type MouseEvent } from "react";
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
  Bold,
  Braces,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  MoreHorizontal,
  Minus,
  PanelLeft,
  PanelTop,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Rows3,
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
import type { StoryTiptapToolbarDensity } from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import {
  StoryTipTapGlobalToolbar,
  ToolbarButton,
  ToolbarSeparator,
} from "@/components/admin/story-creator/story-tiptap-editor-toolbar";
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
import { getStoryEditorSemanticPreset } from "@/components/admin/story-creator/story-tiptap-semantic-preset";
import type { StoryRichTextTextPreset } from "@/lib/admin/story-creator/story-types";

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
        "inline-flex shrink-0 items-center justify-center rounded-lg text-base-content/55 transition-colors duration-150",
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

function StoryTipTapToolbarIdle({
  toolbarDensity,
  variant,
}: {
  toolbarDensity: StoryTiptapToolbarDensity;
  variant: "inline" | "global";
}) {
  if (variant === "inline") return null;
  const touchUi = toolbarDensity === "touch";
  const scrollRow =
    "flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const noop = () => {};
  const preventToolbarFocusLoss = (e: MouseEvent) => {
    e.preventDefault();
  };
  return (
    <div className="border-0 bg-transparent" onMouseDownCapture={preventToolbarFocusLoss}>
      <div
        className={cn(scrollRow, touchUi ? "gap-1 px-2 py-2.5" : "gap-1 px-2 py-2")}
        role="toolbar"
        aria-label="Formatting toolbar (focus a text block to enable)"
      >
        <ToolbarButton touch={touchUi} disabled label="Bold" onClick={noop}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Italic" onClick={noop}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Underline" onClick={noop}>
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Strikethrough" onClick={noop}>
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Inline code" onClick={noop}>
          <Code className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton touch={touchUi} disabled label="Highlight" onClick={noop}>
          <Highlighter className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Link" onClick={noop}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton touch={touchUi} disabled label="Align left" onClick={noop}>
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Align center" onClick={noop}>
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Align right" onClick={noop}>
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Justify" onClick={noop}>
          <AlignJustify className="size-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton touch={touchUi} disabled label="Undo" onClick={noop}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton touch={touchUi} disabled label="Redo" onClick={noop}>
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function StoryTipTapToolbarLive({
  editor,
  toolbarDensity,
  variant,
  semanticRichTextPreset,
}: {
  editor: Editor;
  toolbarDensity: StoryTiptapToolbarDensity;
  variant: "inline" | "global";
  semanticRichTextPreset?: StoryRichTextTextPreset;
}) {
  const hideListToolbar =
    (semanticRichTextPreset ?? getStoryEditorSemanticPreset(editor) ?? "paragraph") === "list";

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
        inlineCode: ed.isActive("code"),
        h1: ed.isActive("heading", { level: 1 }),
        h2: ed.isActive("heading", { level: 2 }),
        h3: ed.isActive("heading", { level: 3 }),
        h4: ed.isActive("heading", { level: 4 }),
        h5: ed.isActive("heading", { level: 5 }),
        h6: ed.isActive("heading", { level: 6 }),
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

  const blockLabel = useMemo(() => {
    if (s.h1) return "Heading 1";
    if (s.h2) return "Heading 2";
    if (s.h3) return "Heading 3";
    if (s.h4) return "Heading 4";
    if (s.h5) return "Heading 5";
    if (s.h6) return "Heading 6";
    return "Paragraph";
  }, [s.h1, s.h2, s.h3, s.h4, s.h5, s.h6]);

  const scrollRow =
    "flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  const preventToolbarFocusLoss = (e: MouseEvent) => {
    e.preventDefault();
  };

  const wrapClass =
    variant === "global"
      ? "border-0 bg-transparent"
      : "border-b border-base-content/10 bg-base-200/40";

  if (variant === "global") {
    return <StoryTipTapGlobalToolbar editor={editor} isTouch={toolbarDensity === "touch"} />;
  }

  if (toolbarDensity === "touch" && variant === "inline") {
    return (
      <div className={wrapClass} onMouseDownCapture={preventToolbarFocusLoss}>
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
          <ToolbarBtn
            touch
            label="Heading 3"
            active={s.h3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="size-4" />
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
          {hideListToolbar ? null : (
            <>
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
            </>
          )}
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
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              >
                Heading 4
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              >
                Heading 5
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-10 py-2.5"
                onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
              >
                Heading 6
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
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
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
    <div className={wrapClass} onMouseDownCapture={preventToolbarFocusLoss}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-2" role="toolbar" aria-label="Formatting">
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
        <ToolbarBtn
          label="Heading 4"
          active={s.h4}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Heading 5"
          active={s.h5}
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        >
          <Heading5 className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Heading 6"
          active={s.h6}
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
        >
          <Heading6 className="size-4" />
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
        {hideListToolbar ? null : (
          <>
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
          </>
        )}
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
          <ToolbarBtn label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
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

export function StoryTipTapToolbar({
  editor,
  toolbarDensity = "default",
  variant = "inline",
  semanticRichTextPreset,
}: {
  editor: Editor | null;
  toolbarDensity?: StoryTiptapToolbarDensity;
  variant?: "inline" | "global";
  /** When set (or bound on the editor), list toggle buttons are hidden — the block preset owns list structure. */
  semanticRichTextPreset?: StoryRichTextTextPreset;
}) {
  if (!editor || editor.isDestroyed) {
    return <StoryTipTapToolbarIdle toolbarDensity={toolbarDensity} variant={variant} />;
  }
  return (
    <StoryTipTapToolbarLive
      editor={editor}
      toolbarDensity={toolbarDensity}
      variant={variant}
      semanticRichTextPreset={semanticRichTextPreset}
    />
  );
}
