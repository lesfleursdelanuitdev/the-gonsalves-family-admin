"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  GripVertical,
  MoreHorizontal,
  PanelRight,
  Plus,
  Trash2,
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
import type { StoryBlock } from "@/lib/admin/story-creator/story-types";
import { StoryBlockSettingsBottomSheet } from "@/components/admin/story-creator/story-creator-mobile";
import {
  storyActiveBlockFrame,
  storyBlockFrameHover,
  storyBlockFrameQuietHover,
  storyFloatingBlockToolbar,
  storyFloatingMenuContent,
  storyIdleBlockFrame,
  storyToolbarIcon,
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

function ToolbarIconButton({
  className,
  ...props
}: React.ComponentProps<"button"> & { className?: string }) {
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
          : "border-base-content/12 bg-base-200/80 text-base-content hover:bg-primary/10",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Content-first block chrome: idle is borderless; hover (desktop) or selection reveals a floating toolbar.
 */
export function StoryEditorBlockFrame({
  block,
  frameLabel,
  selected,
  isLg,
  visualQuietContainer,
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
      <div
        data-story-block-toolbar
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-1/2 justify-center",
          "transition-opacity duration-150",
          selected
            ? "pointer-events-auto opacity-100"
            : isLg
              ? "opacity-0 lg:pointer-events-none lg:group-hover:pointer-events-auto lg:group-hover:opacity-100"
              : "pointer-events-none opacity-0",
        )}
      >
        {isLg ? (
          <div className={cn("flex items-center gap-0.5", storyFloatingBlockToolbar)}>
            <ToolbarIconButton aria-label="Move block up" onClick={(e) => (e.stopPropagation(), onMove(-1))}>
              <ArrowUp className="size-3.5" strokeWidth={2.25} aria-hidden />
            </ToolbarIconButton>
            <ToolbarIconButton aria-label="Move block down" onClick={(e) => (e.stopPropagation(), onMove(1))}>
              <ArrowDown className="size-3.5" strokeWidth={2.25} aria-hidden />
            </ToolbarIconButton>
            <span className="mx-0.5 h-5 w-px shrink-0 bg-base-content/12" aria-hidden />
            <span className="inline-flex items-center text-base-content/40" title="Reorder" aria-hidden>
              <GripVertical className="size-3.5" strokeWidth={2} />
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "size-8 shrink-0 rounded-full p-0",
                  storyToolbarIcon,
                )}
                aria-label="Add block"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="size-3.5" strokeWidth={2.25} aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className={storyFloatingMenuContent}>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddAbove())}>
                  Add block above
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddBelow())}>
                  Add block below
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolbarIconButton aria-label="Duplicate block" onClick={(e) => (e.stopPropagation(), onDuplicate())}>
              <Copy className="size-3.5" strokeWidth={2} aria-hidden />
            </ToolbarIconButton>
            <ToolbarIconButton
              aria-label="Delete block"
              className={storyToolbarIconDanger}
              onClick={(e) => (e.stopPropagation(), onDelete())}
            >
              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
            </ToolbarIconButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "size-8 shrink-0 rounded-full p-0",
                  storyToolbarIcon,
                )}
                aria-label="More block actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" strokeWidth={2} aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={storyFloatingMenuContent}>
                <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onOpenInspector())}>
                  <PanelRight className="size-3.5 opacity-80" aria-hidden />
                  Open inspector
                </DropdownMenuItem>
                {onAddInsideContainer ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 font-medium" onClick={(e) => (e.stopPropagation(), onAddInsideContainer())}>
                      Add block inside container
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1 px-3 text-xs font-semibold text-base-content/70 backdrop-blur-md transition-opacity",
              storyFloatingBlockToolbar,
              storyToolbarIcon,
              selected ? "opacity-100" : "opacity-0",
            )}
            aria-label="Block actions"
            onClick={(e) => {
              e.stopPropagation();
              setMobileSheetOpen(true);
            }}
          >
            <ChevronDown className="size-4 opacity-80" aria-hidden />
            Block
          </button>
        )}
      </div>

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
