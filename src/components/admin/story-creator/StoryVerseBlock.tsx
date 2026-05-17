"use client";

import { generateHTML } from "@tiptap/core";
import type { StoryRichTextBlock } from "@/lib/admin/story-creator/story-types";
import {
  storyTextAlignClass,
  storyVerseStaggerStyle,
  verseContentFromBlock,
  verseLineDocsFromTipTapDoc,
  verseTextFromTipTapDoc,
  verseTitleFromBlock,
} from "@/lib/admin/story-creator/story-verse";
import { cn } from "@/lib/utils";
import { createStoryTipTapExtensions } from "@/components/admin/story-creator/story-tiptap-extensions";

const storyVerseRenderExtensions = createStoryTipTapExtensions(null);

export function StoryVerseBlock({
  block,
  variant = "preview",
}: {
  block: StoryRichTextBlock;
  variant?: "editor" | "preview";
}) {
  const title = verseTitleFromBlock(block).trim();
  const docText = verseTextFromTipTapDoc(block.doc);
  const content = verseContentFromBlock(block);
  const fallbackLines = content.length > 0 ? content.split(/\r?\n/) : [];
  const richLineHtml = docText.trim()
    ? verseLineDocsFromTipTapDoc(block.doc).map((lineDoc) => generateHTML(lineDoc, storyVerseRenderExtensions))
    : [];
  const contentAlign = block.verseContentAlign ?? "center";
  const staggered = (block.verseLineLayout ?? "normal") === "staggered";
  const lineGap = (block.verseSpacing ?? "relaxed") === "compact" ? "gap-0.5" : "gap-2";
  const hasRichLines = richLineHtml.length > 0;
  const hasLines = hasRichLines || fallbackLines.length > 0;

  if (!title && !hasLines) {
    return (
      <div className="rounded-xl border border-dashed border-base-content/15 px-4 py-8 text-center text-sm text-base-content/45">
        Add verse title and content in the inspector.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "story-verse-block min-w-0 font-serif",
        variant === "editor" ? "rounded-xl border border-base-content/10 bg-base-100/60 px-5 py-6 text-neutral-900 shadow-sm" : "text-neutral-900",
      )}
    >
      {title ? (
        <p className={cn("font-semibold leading-snug", storyTextAlignClass(block.verseTitleAlign ?? "center"))}>{title}</p>
      ) : null}
      {hasLines ? (
        <div
          className={cn(
            "flex flex-col whitespace-pre-wrap text-[0.98rem] italic leading-[1.75]",
            title && "mt-6",
            lineGap,
            storyTextAlignClass(contentAlign),
          )}
        >
          {hasRichLines
            ? richLineHtml.map((html, index) => (
                <div
                  key={`${index}-${html}`}
                  className="story-verse-line inline-block min-h-[1lh] [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/35 [&_a]:underline-offset-4 [&_p]:m-0 [&_p]:leading-[inherit]"
                  style={staggered ? storyVerseStaggerStyle(contentAlign, index) : undefined}
                  dangerouslySetInnerHTML={{ __html: html || "<p>&nbsp;</p>" }}
                />
              ))
            : fallbackLines.map((line, index) => (
                <span
                  // The line text can repeat in poems, so index is the stable identity inside this fixed sequence.
                  key={`${index}-${line}`}
                  className="inline-block min-h-[1lh]"
                  style={staggered ? storyVerseStaggerStyle(contentAlign, index) : undefined}
                >
                  {line || "\u00A0"}
                </span>
              ))}
        </div>
      ) : null}
    </div>
  );
}
