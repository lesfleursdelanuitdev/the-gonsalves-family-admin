"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  storyFloatingBlockToolbar,
  storyToolbarIcon,
} from "@/components/admin/story-creator/story-creator-editor-chrome";

/** Re-export for dropdown panels that anchor to this toolbar (same paper chrome). */
export { storyFloatingMenuContent } from "@/components/admin/story-creator/story-creator-editor-chrome";

/**
 * Absolutely positioned shell for block-level floating controls on the story canvas.
 * Visible only for the **selected** block (no hover reveal), so at most one toolbar shows at a time.
 */
export function StoryCanvasFloatingToolbarAnchor({
  selected,
  isLg: _isLg,
  /** Nesting depth for block chrome (containers, columns). Higher = higher z-index and slightly lower placement to reduce overlap with parent toolbars. */
  chromeDepth = 0,
  children,
}: {
  selected: boolean;
  /** Kept for API stability with callers; hover reveal is intentionally disabled. */
  isLg: boolean;
  chromeDepth?: number;
  children: ReactNode;
}) {
  const d = Math.min(Math.max(0, chromeDepth), 12);
  return (
    <div
      data-story-block-toolbar
      className={cn(
        "pointer-events-none absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 justify-center",
        "transition-[opacity,top] duration-150",
        selected ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{
        top: d * 10,
        zIndex: 30 + d,
      }}
    >
      {children}
    </div>
  );
}

/** Light pill container (document “paper” tone). */
export function StoryCanvasFloatingToolbarBar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex items-center gap-0.5", storyFloatingBlockToolbar, className)}>{children}</div>;
}

export function StoryCanvasFloatingToolbarIconButton({
  className,
  ...props
}: ComponentProps<"button"> & { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "size-8 min-h-8 min-w-8 shrink-0 rounded-full p-0 lg:size-8",
        storyToolbarIcon,
        className,
      )}
      {...props}
    />
  );
}

/** Matches icon buttons visually; use as {@link DropdownMenuTrigger} for + / … menus. */
export function StoryCanvasFloatingToolbarMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "size-8 shrink-0 rounded-full p-0",
        storyToolbarIcon,
        className,
      )}
      {...props}
    />
  );
}

export function StoryCanvasFloatingToolbarRule() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200" aria-hidden />;
}

export function StoryCanvasFloatingToolbarGrip() {
  return (
    <span className="inline-flex items-center text-neutral-400" title="Reorder" aria-hidden>
      <GripVertical className="size-3.5" strokeWidth={2} />
    </span>
  );
}

/** Small-screen affordance: opens the same actions in a bottom sheet (caller provides sheet). */
export function StoryCanvasFloatingToolbarMobileTrigger({
  selected,
  onOpen,
}: {
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-1 px-3 text-xs font-semibold text-neutral-600 backdrop-blur-md transition-opacity",
        storyFloatingBlockToolbar,
        storyToolbarIcon,
        selected ? "opacity-100" : "opacity-0",
      )}
      aria-label="Block actions"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <ChevronDown className="size-4 opacity-80" aria-hidden />
      Block
    </button>
  );
}
