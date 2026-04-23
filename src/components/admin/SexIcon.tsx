"use client";

import { Mars, Venus, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function SexIcon({
  sex,
  className,
}: {
  sex: string | null | undefined;
  /** Merges onto the icon (e.g. `size-6` for page titles). */
  className?: string;
}) {
  const cls = cn("size-4 shrink-0 text-base-content/70", className);
  if (sex === "M") return <Mars className={cls} aria-hidden />;
  if (sex === "F") return <Venus className={cls} aria-hidden />;
  return (
    <span className="inline-flex" title="Unknown sex">
      <CircleHelp className={cn(cls, "text-muted-foreground")} aria-hidden />
    </span>
  );
}
