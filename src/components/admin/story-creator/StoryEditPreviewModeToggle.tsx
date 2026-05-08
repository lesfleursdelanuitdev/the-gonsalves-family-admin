"use client";

import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const layouts = {
  /** Main mobile header — icons only; outer height matches `h-11` icon buttons (e.g. structure / inspector). */
  touch: {
    track:
      "relative flex h-11 min-h-[44px] w-auto min-w-[5.75rem] shrink-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200/60 p-0 shadow-inner",
    thumb: "inset-y-0.5 left-0.5 w-[calc(50%-0.25rem)] rounded-lg",
    btn: "relative z-10 inline-flex h-full min-h-0 min-w-0 flex-1 items-center justify-center gap-0 rounded-md px-0 text-sm font-semibold",
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
  /** Fullscreen bar on small screens — icons only. */
  dense: {
    track: "min-w-0 rounded-lg border border-base-content/12 bg-base-200/50 p-0.5 shadow-inner",
    thumb: "inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md",
    btn: "inline-flex h-9 min-h-9 min-w-9 flex-1 items-center justify-center gap-0 rounded-md px-0 text-xs font-semibold transition-colors",
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
  const showLabels = layout === "default" || layout === "compact";
  return (
    <div
      className={cn("relative isolate flex shrink-0", showLabels && "min-w-[7.25rem]", L.track, className)}
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
        aria-label={showLabels ? undefined : "Edit"}
        aria-pressed={mode === "edit"}
        onClick={() => onMode("edit")}
      >
        <Pencil className={cn("shrink-0 opacity-80", showLabels ? "size-3.5" : "size-[1.125rem]")} aria-hidden />
        {showLabels ? "Edit" : null}
      </button>
      <button
        type="button"
        className={cn(
          L.btn,
          "relative z-10",
          mode === "preview" ? "text-base-content" : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
        )}
        aria-label={showLabels ? undefined : "Preview"}
        aria-pressed={mode === "preview"}
        onClick={() => onMode("preview")}
      >
        <Eye className={cn("shrink-0 opacity-80", showLabels ? "size-3.5" : "size-[1.125rem]")} aria-hidden />
        {showLabels ? "Preview" : null}
      </button>
    </div>
  );
}
