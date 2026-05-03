"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { StoryTipTapToolbar } from "@/components/admin/story-creator/StoryTipTapToolbar";
import {
  useStoryTiptapActiveEditorOptional,
  type StoryTiptapToolbarDensity,
} from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import { cn } from "@/lib/utils";

function preventToolbarMousedownDefault(e: ReactMouseEvent) {
  e.preventDefault();
}

/** Single shared formatting bar for whichever `StoryTipTapEditor` last had focus. */
export function StoryGlobalTipTapToolbar({
  toolbarDensity: toolbarDensityProp,
  className,
  frameClassName,
}: {
  /** Used when context is unavailable and for density fallback. */
  toolbarDensity: StoryTiptapToolbarDensity;
  className?: string;
  /** Classes for the inner bordered frame around the toolbar. */
  frameClassName?: string;
}) {
  const ctx = useStoryTiptapActiveEditorOptional();
  const activeEditor = ctx?.activeEditor ?? null;
  const toolbarDensity = ctx?.toolbarDensity ?? toolbarDensityProp;
  return (
    <div
      className={cn(
        "shrink-0 px-4 pb-3 pt-1 transition-opacity duration-150 lg:px-8 lg:pb-3 lg:pt-2",
        className,
      )}
      data-story-global-tiptap-toolbar
      onMouseDownCapture={preventToolbarMousedownDefault}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-base-content/12 bg-base-200/60 shadow-sm ring-1 ring-base-content/[0.06]",
          "transition-[box-shadow,border-color] duration-150",
          frameClassName,
        )}
      >
        <StoryTipTapToolbar editor={activeEditor} toolbarDensity={toolbarDensity} variant="global" />
      </div>
    </div>
  );
}
