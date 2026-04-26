"use client";

import {
  Baby,
  BookOpen,
  CalendarDays,
  Image,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FamilyEditTab } from "@/components/admin/family-editor/family-editor-types";

const TAB_ITEMS: { id: FamilyEditTab; label: string; icon: LucideIcon }[] = [
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "parents", label: "Parents", icon: Users },
  { id: "children", label: "Children", icon: Baby },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "media", label: "Media", icon: Image },
  { id: "sources", label: "Sources", icon: BookOpen },
];

export function FamilyEditorTabBar({
  activeTab,
  onTabChange,
  childrenCount,
  notesCount,
  mediaCount,
  sourcesCount,
}: {
  activeTab: FamilyEditTab;
  onTabChange: (tab: FamilyEditTab) => void;
  childrenCount: number;
  notesCount: number;
  mediaCount: number;
  sourcesCount: number;
}) {
  return (
    <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
      <div
        className="flex gap-0 overflow-x-auto overscroll-x-contain"
        role="tablist"
        aria-label="Family editor sections"
      >
        {TAB_ITEMS.map((t) => {
          const Icon = t.icon;
          const selected = activeTab === t.id;
          const tabLabel =
            t.id === "children"
              ? `Children (${childrenCount})`
              : t.id === "notes"
                ? `Notes (${notesCount})`
                : t.id === "media"
                  ? `Media (${mediaCount})`
                  : t.id === "sources"
                    ? `Sources (${sourcesCount})`
                    : t.label;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`family-editor-panel-${t.id}`}
              id={`family-editor-tab-${t.id}`}
              title={tabLabel}
              className={cn(
                "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
              )}
              onClick={() => onTabChange(t.id)}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="sr-only md:hidden">{tabLabel}</span>
              <span className="hidden md:inline">{tabLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
