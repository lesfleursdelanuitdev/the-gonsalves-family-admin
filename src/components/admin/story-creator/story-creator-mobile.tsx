"use client";

import { useCallback, useRef } from "react";
import { LayoutList, Plus, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogPopup,
  DialogViewport,
} from "@/components/ui/dialog";

export type StoryMobileShellTab = "add-block" | "structure" | "settings";

type SideTab = Exclude<StoryMobileShellTab, "add-block">;

/** Sticky dock: Structure · Add block · Settings (mobile + large screens). */
export function StoryEditorBottomDock({
  active,
  onNavigate,
  emphasizeAddBlockFab,
}: {
  /** When `null`, side tabs show no selection; FAB uses {@link emphasizeAddBlockFab}. */
  active: StoryMobileShellTab | null;
  onNavigate: (t: StoryMobileShellTab) => void;
  /** When active is null (desktop dock), keep the center FAB visibly primary. */
  emphasizeAddBlockFab?: boolean;
}) {
  const Item = ({
    id,
    label,
    icon: Icon,
  }: {
    id: SideTab;
    label: string;
    icon: typeof LayoutList;
  }) => {
    const selected = active !== null && active === id;
    return (
      <button
        type="button"
        onClick={() => onNavigate(id)}
        className={cn(
          "group flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold uppercase tracking-wide transition-[color,transform,background-color,box-shadow] duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100",
          "lg:active:scale-[0.97]",
          "lg:hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)]",
          selected
            ? "text-primary lg:hover:bg-primary/10"
            : "text-base-content/50 lg:hover:bg-base-content/[0.07] lg:hover:text-base-content/90",
        )}
        aria-current={selected ? "page" : undefined}
      >
        <Icon
          className={cn(
            "size-6 shrink-0 transition-[transform,opacity] duration-200 lg:group-hover:scale-105",
            !selected && "lg:opacity-90 lg:group-hover:opacity-100",
          )}
          strokeWidth={selected ? 2.25 : 1.75}
          aria-hidden
        />
        <span className="leading-tight">{label}</span>
      </button>
    );
  };

  const addSelected = active === "add-block";
  const fabPrimary = addSelected || Boolean(emphasizeAddBlockFab);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-base-content/10 bg-base-100/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md shadow-[0_-6px_28px_rgba(0,0,0,0.28)] lg:z-30"
      aria-label="Story editor navigation"
    >
      <div className="mx-auto flex w-full max-w-lg items-end justify-between gap-2 px-2 lg:max-w-none lg:px-4">
        <Item id="structure" label="Structure" icon={LayoutList} />
        <div className="flex min-w-0 shrink-0 flex-col items-center justify-end pb-[2px] pt-0.5">
          <button
            type="button"
            onClick={() => onNavigate("add-block")}
            aria-current={fabPrimary ? "page" : undefined}
            className="group flex flex-col items-center gap-1 rounded-2xl px-1 pb-0.5 pt-0.5 transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 lg:active:scale-[0.98]"
          >
            <span
              className={cn(
                "flex size-[52px] min-h-[48px] min-w-[48px] items-center justify-center rounded-full border-2 shadow-lg transition-[transform,background-color,color,border-color,box-shadow,filter] duration-200 ease-out active:scale-[0.96]",
                "lg:group-hover:shadow-xl",
                fabPrimary
                  ? "border-transparent bg-primary text-primary-content shadow-primary/30 lg:group-hover:scale-105 lg:group-hover:shadow-primary/45 lg:group-hover:brightness-[1.06]"
                  : "border-base-content/14 bg-base-200/95 text-primary lg:group-hover:scale-105 lg:group-hover:border-primary/35 lg:group-hover:bg-base-300/90 lg:group-hover:shadow-md",
              )}
            >
              <Plus
                className="size-7 shrink-0 transition-transform duration-200 ease-out lg:group-hover:scale-110"
                strokeWidth={2.5}
                aria-hidden
              />
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide transition-colors duration-200",
                fabPrimary
                  ? "text-primary lg:group-hover:text-primary/90"
                  : "text-base-content/50 lg:group-hover:text-primary/90",
              )}
            >
              Add block
            </span>
          </button>
        </div>
        <Item id="settings" label="Settings" icon={Settings} />
      </div>
    </nav>
  );
}

/** @deprecated Use {@link StoryEditorBottomDock} */
export const StoryMobileBottomNav = StoryEditorBottomDock;

function StoryMobileBottomSheetFrame({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const dragY0 = useRef<number | null>(null);

  const endDrag = useCallback(
    (clientY: number) => {
      const y0 = dragY0.current;
      dragY0.current = null;
      if (y0 != null && clientY - y0 > 64) onOpenChange(false);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport className="fixed inset-0 z-50 flex min-h-full w-full items-end justify-center p-0">
          <DialogPopup
            className={cn(
              "flex max-h-[min(92dvh,920px)] w-full max-w-full flex-col overflow-hidden rounded-t-3xl rounded-b-none border border-base-content/12 border-b-0 bg-base-200/95 p-0 shadow-2xl ring-1 ring-base-content/[0.06]",
              "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
              "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            )}
          >
            <div className="flex shrink-0 flex-col items-center border-b border-base-content/10 bg-base-100/70 px-3 pb-3 pt-2">
              <div
                role="button"
                tabIndex={0}
                aria-label="Drag down to close"
                className="h-1.5 w-11 shrink-0 cursor-grab rounded-full bg-base-content/25 active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragY0.current = e.clientY;
                }}
                onPointerUp={(e) => endDrag(e.clientY)}
                onPointerCancel={() => {
                  dragY0.current = null;
                }}
              />
              <div className="mt-3 flex w-full items-center justify-between gap-3">
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-base-content">{title}</h2>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-base-content/60 transition-colors hover:bg-base-content/[0.08] hover:text-base-content"
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">{children}</div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * Block inspector as a bottom sheet (mobile). Drag handle is a light affordance;
 * swipe-down-to-close uses a simple vertical threshold on the handle.
 */
export function StoryBlockSettingsBottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <StoryMobileBottomSheetFrame open={open} onOpenChange={onOpenChange} title={title}>
      {children}
    </StoryMobileBottomSheetFrame>
  );
}

/** Add-block type picker — same chrome as {@link StoryBlockSettingsBottomSheet}. */
export function StoryAddBlockBottomSheet({
  open,
  onOpenChange,
  title = "Add block",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <StoryMobileBottomSheetFrame open={open} onOpenChange={onOpenChange} title={title}>
      {children}
    </StoryMobileBottomSheetFrame>
  );
}

export function StoryMobileFullScreenPanel({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport className="fixed inset-0 z-50 flex min-h-full w-full items-stretch justify-center p-0">
          <DialogPopup
            className={cn(
              "flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-base-100 p-0 shadow-none",
              "data-[closed]:animate-out data-[closed]:fade-out-0",
              "data-[open]:animate-in data-[open]:fade-in-0",
            )}
          >
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-base-content/10 bg-base-200/40 px-3">
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-base-content/70 hover:bg-base-content/[0.08]"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-5" strokeWidth={2} />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-tight text-base-content">
                {title}
              </h2>
              <span className="size-11 shrink-0" aria-hidden />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
