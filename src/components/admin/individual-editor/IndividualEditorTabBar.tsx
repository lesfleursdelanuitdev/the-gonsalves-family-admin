"use client";

import {
  Baby,
  BookOpen,
  CalendarDays,
  CaseSensitive,
  Image,
  StickyNote,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndividualEditorTab } from "@/components/admin/individual-editor/individual-editor-types";

const EDITOR_TAB_ITEMS: { id: IndividualEditorTab; label: string; icon: LucideIcon }[] = [
  { id: "identity", label: "Identity", icon: User },
  { id: "names", label: "Names", icon: CaseSensitive },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "spouse", label: "Families as Spouse", icon: Users },
  { id: "child", label: "Families as Child", icon: Baby },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "media", label: "Media", icon: Image },
  { id: "sources", label: "Sources", icon: BookOpen },
];

export type IndividualEditorTabBarProps = {
  activeTab: IndividualEditorTab;
  onTabChange: (tab: IndividualEditorTab) => void;
  spouseFamilyCount: number;
  childFamilyCount: number;
  notesCount: number;
  mediaCount: number;
  sourcesCount: number;
};

export function IndividualEditorTabBar({
  activeTab,
  onTabChange,
  spouseFamilyCount,
  childFamilyCount,
  notesCount,
  mediaCount,
  sourcesCount,
}: IndividualEditorTabBarProps) {
  return (
    <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
      <div className="flex gap-0 overflow-x-auto overscroll-x-contain" role="tablist" aria-label="Form sections">
        {EDITOR_TAB_ITEMS.map((t) => {
          const Icon = t.icon;
          const selected = activeTab === t.id;
          const tabLabel =
            t.id === "spouse"
              ? `Families as Spouse (${spouseFamilyCount})`
              : t.id === "child"
                ? `Families as Child (${childFamilyCount})`
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
              aria-controls={`individual-editor-panel-${t.id}`}
              id={`individual-editor-tab-${t.id}`}
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
