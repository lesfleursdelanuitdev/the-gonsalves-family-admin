"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminEditorNavItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export function AdminEditorSidebarNav({
  items,
  activeId,
  onSelect,
}: {
  items: readonly AdminEditorNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {items.map((item, index) => {
        const Icon = item.icon;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:bg-base-content/[0.06] hover:text-foreground",
            )}
            onClick={() => onSelect(item.id)}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-base-content/[0.08] text-xs font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.description}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}
