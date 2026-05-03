"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, LayoutTemplate, MoreHorizontal, PanelRight, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StoryBlock } from "@/lib/admin/story-creator/story-types";
import { StoryBlockSettingsBottomSheet } from "@/components/admin/story-creator/story-creator-mobile";
import {
  StoryCanvasFloatingToolbarAnchor,
  StoryCanvasFloatingToolbarBar,
  StoryCanvasFloatingToolbarGrip,
  StoryCanvasFloatingToolbarIconButton,
  StoryCanvasFloatingToolbarMenuTrigger,
  StoryCanvasFloatingToolbarMobileTrigger,
  StoryCanvasFloatingToolbarRule,
  storyFloatingMenuContent,
} from "@/components/admin/story-creator/StoryCanvasFloatingToolbar";
import {
  storyActiveBlockFrame,
  storyBlockFrameHover,
  storyBlockFrameQuietHover,
  storyIdleBlockFrame,
  storyToolbarIconDanger,
} from "@/components/admin/story-creator/story-creator-editor-chrome";

export type StoryEditorBlockFrameProps = {
  block: StoryBlock;
  /** Screen reader / mobile sheet title (e.g. “Text block”). */
  frameLabel: string;
  selected: boolean;
  isLg: boolean;
  /** Softer idle chrome for containers / outer shells. */
  visualQuietContainer?: boolean;
  /** Nesting depth for floating toolbar stacking (containers, columns). */
  chromeDepth?: number;
  onSelect: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onAddInsideContainer?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenInspector: () => void;
  onMove: (direction: -1 | 1) => void;
  children: ReactNode;
  contentClassName?: string;
};

function MobileSheetRow({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors",
        danger
          ? "border-error/25 bg-error/10 text-error hover:bg-error/15"
          : "border-neutral-200/90 bg-neutral-50 text-neutral-800 hover:bg-primary/10 hover:border-primary/25",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Content-first block chrome: idle is borderless; hover may lightly frame the block on desktop; the floating toolbar shows only when the block is **selected**.
 */
export function StoryEditorBlockFrame({
  block,
  frameLabel,
  selected,
  isLg,
  visualQuietContainer,
  chromeDepth = 0,
  onSelect,
  onAddAbove,
  onAddBelow,
  onAddInsideContainer,
  onDuplicate,
  onDelete,
  onOpenInspector,
  onMove,
  children,
  contentClassName,
}: StoryEditorBlockFrameProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setMobileSheetOpen(false), []);

  return (
    <div
      role="group"
      aria-label={frameLabel}
      tabIndex={selected ? 0 : -1}
      data-story-editor-block-frame
      data-block-id={block.id}
      className={cn(
        "group relative mb-0.5 overflow-visible outline-none",
        "transition-[box-shadow,border-color,background-color] duration-200",
        selected
          ? storyActiveBlockFrame
          : cn(storyIdleBlockFrame, visualQuietContainer ? storyBlockFrameQuietHover : storyBlockFrameHover),
        "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0",
      )}
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest("[data-story-block-toolbar]")) return;
        onSelect();
      }}
    >
      <StoryCanvasFloatingToolbarAnchor selected={selected} isLg={isLg} chromeDepth={chromeDepth}>
        {isLg ? (
          <StoryCanvasFloatingToolbarBar>
            <StoryCanvasFloatingToolbarIconButton aria-label="Move block up" onClick={(e) => (e.stopPropagation(), onMove(-1))}>
              <ArrowUp className="size-3.5" strokeWidth={2.25} aria-hidden />
            </StoryCanvasFloatingToolbarIconButton>
            <StoryCanvasFloatingToolbarIconButton aria-label="Move block down" onClick={(e) => (e.stopPropagation(), onMove(1))}>
              <ArrowDown className="size-3.5" strokeWidth={2.25} aria-hidden />
            </StoryCanvasFloatingToolbarIconButton>
            <StoryCanvasFloatingToolbarRule />
            <StoryCanvasFloatingToolbarGrip />
            <DropdownMenu>
              <StoryCanvasFloatingToolbarMenuTrigger aria-label="Add block" onClick={(e) => e.stopPropagation()}>
                <Plus className="size-3.5" strokeWidth={2.25} aria-hidden />
              </StoryCanvasFloatingToolbarMenuTrigger>
              <DropdownMenuContent align="center" className={storyFloatingMenuContent}>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddAbove())}>
                  Add block above
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddBelow())}>
                  Add block below
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <StoryCanvasFloatingToolbarIconButton aria-label="Duplicate block" onClick={(e) => (e.stopPropagation(), onDuplicate())}>
              <Copy className="size-3.5" strokeWidth={2} aria-hidden />
            </StoryCanvasFloatingToolbarIconButton>
            <StoryCanvasFloatingToolbarIconButton
              aria-label="Delete block"
              className={storyToolbarIconDanger}
              onClick={(e) => (e.stopPropagation(), onDelete())}
            >
              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
            </StoryCanvasFloatingToolbarIconButton>
            <DropdownMenu>
              <StoryCanvasFloatingToolbarMenuTrigger aria-label="More block actions" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="size-3.5" strokeWidth={2} aria-hidden />
              </StoryCanvasFloatingToolbarMenuTrigger>
              <DropdownMenuContent align="end" className={storyFloatingMenuContent}>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onOpenInspector())}>
                  <PanelRight className="size-3.5 opacity-80" aria-hidden />
                  Open inspector
                </DropdownMenuItem>
                {onAddInsideContainer ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddInsideContainer())}>
                      <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
                      Add block inside container
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </StoryCanvasFloatingToolbarBar>
        ) : (
          <StoryCanvasFloatingToolbarMobileTrigger selected={selected} onOpen={() => setMobileSheetOpen(true)} />
        )}
      </StoryCanvasFloatingToolbarAnchor>

      <StoryBlockSettingsBottomSheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen} title={frameLabel}>
        <div className="grid gap-2 pb-2">
          <MobileSheetRow onClick={() => (onAddAbove(), closeSheet())}>Add block above</MobileSheetRow>
          <MobileSheetRow onClick={() => (onAddBelow(), closeSheet())}>Add block below</MobileSheetRow>
          {onAddInsideContainer ? (
            <MobileSheetRow onClick={() => (onAddInsideContainer(), closeSheet())}>Add inside container</MobileSheetRow>
          ) : null}
          <MobileSheetRow onClick={() => (onMove(-1), closeSheet())}>Move up</MobileSheetRow>
          <MobileSheetRow onClick={() => (onMove(1), closeSheet())}>Move down</MobileSheetRow>
          <MobileSheetRow onClick={() => (onDuplicate(), closeSheet())}>Duplicate</MobileSheetRow>
          <MobileSheetRow onClick={() => (onOpenInspector(), closeSheet())}>Inspector</MobileSheetRow>
          <MobileSheetRow danger onClick={() => (onDelete(), closeSheet())}>
            Delete
          </MobileSheetRow>
        </div>
      </StoryBlockSettingsBottomSheet>

      <div className={cn("relative z-0", contentClassName)}>{children}</div>
    </div>
  );
}
