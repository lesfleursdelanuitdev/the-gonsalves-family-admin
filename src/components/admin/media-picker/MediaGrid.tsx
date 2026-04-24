"use client";

import { Loader2 } from "lucide-react";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import { MediaCard } from "@/components/admin/media-picker/MediaCard";
import { cn } from "@/lib/utils";

export function MediaGrid({
  items,
  selectedIds,
  excludeIds,
  loading,
  emptyLabel,
  onToggle,
  className,
}: {
  items: readonly AdminMediaListItem[];
  selectedIds: ReadonlySet<string>;
  excludeIds?: ReadonlySet<string>;
  loading: boolean;
  emptyLabel: string;
  onToggle: (id: string) => void;
  className?: string;
}) {
  if (loading && items.length === 0) {
    return (
      <div className={cn("flex min-h-[12rem] items-center justify-center text-muted-foreground", className)}>
        <Loader2 size={28} className="animate-spin shrink-0" aria-hidden />
        <span className="sr-only">Loading media</span>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[10rem] items-center justify-center rounded-box border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((m) => {
        const excluded = excludeIds?.has(m.id) ?? false;
        return (
          <li key={m.id} className="min-w-0">
            <MediaCard
              media={m}
              selected={selectedIds.has(m.id)}
              disabled={excluded}
              onToggle={() => {
                if (!excluded) onToggle(m.id);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
