"use client";

import { CheckCircle2, CircleDot, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export function OpenQuestionStatusBadge({
  status,
  /** Softer pills for dense list / card layouts */
  tone = "default",
}: {
  status: string;
  tone?: "default" | "card";
}) {
  const s = status.toLowerCase();
  const card = tone === "card";
  if (s === "resolved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-base-content/10 bg-base-content/[0.06] font-medium text-base-content/70",
          card ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-0.5 text-xs",
        )}
      >
        <CheckCircle2 className={cn("shrink-0 text-success/80", card ? "size-3" : "size-3.5")} aria-hidden />
        Resolved
      </span>
    );
  }
  if (s === "archived") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-base-content/8 bg-base-content/[0.04] font-medium text-muted-foreground",
          card ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-0.5 text-xs",
        )}
      >
        <Archive className={cn("shrink-0 opacity-70", card ? "size-3" : "size-3.5")} aria-hidden />
        Archived
      </span>
    );
  }
  if (card) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-base-content/10 bg-base-content/[0.04] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-success/75 ring-1 ring-success/25" aria-hidden />
        Open
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
