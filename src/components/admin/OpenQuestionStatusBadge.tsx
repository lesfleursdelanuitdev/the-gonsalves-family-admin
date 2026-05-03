"use client";

import { CheckCircle2, CircleDot, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export function OpenQuestionStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "resolved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-base-content/10 bg-base-content/[0.06] px-2 py-0.5 text-xs font-medium text-base-content/70",
        )}
      >
        <CheckCircle2 className="size-3.5 shrink-0 text-success/90" aria-hidden />
        Resolved
      </span>
    );
  }
  if (s === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-base-content/8 bg-base-content/[0.04] px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Archive className="size-3.5 shrink-0 opacity-70" aria-hidden />
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
      <CircleDot className="size-3.5 shrink-0" aria-hidden />
      Open
    </span>
  );
}
