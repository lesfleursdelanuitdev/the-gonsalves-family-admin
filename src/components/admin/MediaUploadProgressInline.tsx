"use client";

import { formatBytes } from "@/lib/admin/format-bytes";
import { cn } from "@/lib/utils";

export type MediaUploadProgressInlineProps = {
  loaded: number;
  /** Multipart total when known; use `expectedSize` as fallback from `File.size`. */
  total: number | null;
  /** When `total` is null, bar uses this for percent if set. */
  expectedSize?: number | null;
  /** Optional first line (e.g. `2 of 5 — vacation.mp4`). */
  caption?: string | null;
  /** Second line, e.g. "Saving…" */
  subCaption?: string | null;
  className?: string;
};

function effectiveTotal(total: number | null, expectedSize: number | null | undefined): number | null {
  if (total != null && total > 0) return total;
  if (expectedSize != null && expectedSize > 0) return expectedSize;
  return null;
}

export function MediaUploadProgressInline({
  loaded,
  total,
  expectedSize,
  caption,
  subCaption,
  className,
}: MediaUploadProgressInlineProps) {
  const denom = effectiveTotal(total, expectedSize);
  const pct = denom != null && denom > 0 ? Math.min(100, Math.round((100 * loaded) / denom)) : null;
  const indeterminate = pct == null;

  return (
    <div className={cn("w-full max-w-md space-y-1.5", className)}>
      {caption ? <p className="text-xs font-medium text-base-content/90">{caption}</p> : null}
      {subCaption ? <p className="text-[11px] text-muted-foreground">{subCaption}</p> : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-base-300"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={indeterminate ? undefined : 100}
        aria-valuenow={indeterminate ? undefined : pct ?? undefined}
        aria-label={indeterminate ? "Upload in progress" : `Upload ${pct}% complete`}
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-200 ease-out",
            indeterminate && "w-2/5 animate-pulse",
          )}
          style={!indeterminate ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {formatBytes(loaded)}
        {denom != null ? ` / ${formatBytes(denom)}` : ""}
        {pct != null ? ` (${pct}%)` : denom == null && loaded > 0 ? " uploaded…" : null}
      </p>
    </div>
  );
}
