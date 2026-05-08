"use client";

import { HandHeart } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown left of the child’s name when parent–child links are adopted, foster, step, sealing, or custom pedigree. */
export function NonBirthChildIndicator({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 text-amber-600 dark:text-amber-400",
        className,
      )}
      title="Non-birth or adopted relationship to parents in this family (per parent–child links)"
    >
      <HandHeart className="size-3.5" strokeWidth={2} aria-hidden />
      <span className="sr-only">Non-birth or adopted child</span>
    </span>
  );
}
