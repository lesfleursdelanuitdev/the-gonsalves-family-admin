"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SelectedMediaBar({
  count,
  onClear,
  className,
}: {
  count: number;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-box border border-primary/20 bg-primary/5 px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="font-medium text-base-content">
        {count} selected
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={onClear}>
        <X size={16} className="shrink-0" aria-hidden />
        Clear
      </Button>
    </div>
  );
}
