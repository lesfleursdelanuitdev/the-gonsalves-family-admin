"use client";

import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const layouts = {
  /** Fullscreen bar — large hit target (mobile). */
  touch: {
    track: "rounded-xl border border-base-content/10 bg-base-200/60 p-1 shadow-inner",
    thumb: "inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg",
    btn: "inline-flex h-10 min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
  },
  /** Main header — desktop default. */
  default: {
    track: "rounded-lg border border-base-content/10 bg-base-200/60 p-1 shadow-inner",
    thumb: "inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md",
    btn: "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-semibold",
  },
  /** Fullscreen bar — compact (lg). */
  compact: {
    track: "rounded-lg border border-base-content/12 bg-base-200/50 p-0.5 shadow-inner",
    thumb: "inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md",
    btn: "inline-flex h-8 min-h-8 flex-1 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold",
  },
  /** Fullscreen bar — small screens, slightly taller than compact. */
  dense: {
    track: "rounded-lg border border-base-content/12 bg-base-200/50 p-0.5 shadow-inner",
    thumb: "inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md",
    btn: "inline-flex h-9 min-h-9 flex-1 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors",
  },
} as const;

export type StoryEditPreviewModeToggleLayout = keyof typeof layouts;

export function StoryEditPreviewModeToggle({
  mode,
  onMode,
  layout = "default",
  className,
}: {
  mode: "edit" | "preview";
  onMode: (next: "edit" | "preview") => void;
  layout?: StoryEditPreviewModeToggleLayout;
  className?: string;
}) {
  const L = layouts[layout];
  return (
    <div
      className={cn("relative isolate flex min-w-[7.25rem] shrink-0", L.track, className)}
      role="group"
      aria-label="Editor or preview"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bg-base-100 shadow-sm ring-1 ring-base-content/[0.08] transition-transform duration-200 ease-out will-change-transform",
          L.thumb,
          mode === "preview" && "translate-x-full",
        )}
      />
      <button
        type="button"
        className={cn(
          L.btn,
          "relative z-10",
          mode === "edit" ? "text-base-content" : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
        )}
        aria-pressed={mode === "edit"}
        onClick={() => onMode("edit")}
      >
        <Pencil className="size-3.5 shrink-0 opacity-80" aria-hidden />
        Edit
      </button>
      <button
        type="button"
        className={cn(
          L.btn,
          "relative z-10",
          mode === "preview" ? "text-base-content" : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
        )}
        aria-pressed={mode === "preview"}
        onClick={() => onMode("preview")}
      >
        <Eye className="size-3.5 shrink-0 opacity-80" aria-hidden />
        Preview
      </button>
    </div>
  );
}
