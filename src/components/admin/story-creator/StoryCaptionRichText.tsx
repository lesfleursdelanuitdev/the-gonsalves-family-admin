"use client";

import { useEffect, useMemo, type CSSProperties, type MouseEvent } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Highlighter, Italic, Link2, Link2Off, Strikethrough, Underline as UnderlineIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateStoryLinkUrl } from "@/components/admin/story-creator/story-tiptap-toolbar-utils";
import { storyCaptionFromEditorHtml, storyCaptionToEditorHtml, storyCaptionToRenderableHtml } from "@/lib/admin/story-creator/story-caption-richtext";
import { StoryLink } from "@/components/admin/story-creator/story-tiptap-link-extension";
import { StoryEntityLinkToolbarButton } from "@/components/admin/story-creator/StoryEntityLinkToolbarButton";

function CaptionToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base-content/60 transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/20"
          : "hover:bg-base-content/[0.08] hover:text-base-content",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

function CaptionEditorToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      highlight: ed.isActive("highlight"),
      link: ed.isActive("link"),
      alignLeft: ed.isActive({ textAlign: "left" }),
      alignCenter: ed.isActive({ textAlign: "center" }),
      alignRight: ed.isActive({ textAlign: "right" }),
      alignJustify: ed.isActive({ textAlign: "justify" }),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const raw = window.prompt("Link URL", prev ?? "https://");
    if (raw === null) return;
    const next = raw.trim();
    if (!next) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!validateStoryLinkUrl(next)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
  };

  const preventFocusLoss = (e: MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-t-lg border-b border-base-content/10 bg-base-200/30 px-2 py-1.5" onMouseDownCapture={preventFocusLoss}>
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Caption formatting">
        <CaptionToolbarButton label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Highlight" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter className="size-4" />
        </CaptionToolbarButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-base-content/12" aria-hidden />
        <CaptionToolbarButton label="Align left" active={s.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Align center" active={s.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Align right" active={s.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </CaptionToolbarButton>
        <CaptionToolbarButton label="Justify" active={s.alignJustify} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </CaptionToolbarButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-base-content/12" aria-hidden />
        <CaptionToolbarButton label="Link" active={s.link} onClick={setLink}>
          <Link2 className="size-4" />
        </CaptionToolbarButton>
        <StoryEntityLinkToolbarButton editor={editor} size="caption" />
        <CaptionToolbarButton
          label="Remove link"
          disabled={!s.link}
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Link2Off className="size-4" />
        </CaptionToolbarButton>
      </div>
    </div>
  );
}

export function StoryCaptionRichTextEditor({
  caption,
  placeholder,
  onChange,
  touchComfort,
}: {
  caption: string | undefined;
  placeholder: string;
  onChange: (next: string | undefined) => void;
  touchComfort?: boolean;
}) {
  const initialHtml = useMemo(() => storyCaptionToEditorHtml(caption), [caption]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          link: false,
        }),
        StoryLink.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            class: "text-primary underline underline-offset-2",
          },
        }),
        Underline,
        Highlight.configure({
          multicolor: false,
          HTMLAttributes: {
            class: "bg-warning/35 text-base-content",
          },
        }),
        TextAlign.configure({
          types: ["paragraph"],
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: initialHtml,
      editorProps: {
        attributes: {
          class: cn(
            "ProseMirror min-h-[96px] w-full rounded-b-lg border-0 bg-base-100 px-3 py-2.5 text-sm leading-relaxed outline-none",
            "prose prose-sm max-w-none prose-p:my-0 prose-p:leading-relaxed prose-a:text-primary prose-a:underline prose-a:underline-offset-2",
            touchComfort && "min-h-[112px] text-[15px]",
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(storyCaptionFromEditorHtml(ed.getHTML()));
      },
    },
    [initialHtml, onChange, placeholder, touchComfort],
  );

  useEffect(() => {
    if (!editor) return;
    const next = storyCaptionToEditorHtml(caption);
    const current = storyCaptionToEditorHtml(editor.getHTML());
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, caption]);

  if (!editor) {
    return <div className="rounded-lg border border-base-content/12 bg-base-100 px-3 py-5 text-sm text-base-content/55">Loading caption editor…</div>;
  }

  return (
    <div className="rounded-lg border border-base-content/12 bg-base-100" onPointerDown={(e) => e.stopPropagation()}>
      <CaptionEditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function StoryCaptionRichTextDisplay({
  caption,
  className,
  style,
}: {
  caption: string | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const html = storyCaptionToRenderableHtml(caption);
  if (!html) return null;
  return (
    <div
      className={cn(
        "text-xs leading-relaxed",
        "[&_p]:m-0 [&_p]:leading-relaxed [&_p+p]:mt-1.5",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_mark]:rounded-[2px] [&_mark]:px-0.5",
        className,
      )}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
