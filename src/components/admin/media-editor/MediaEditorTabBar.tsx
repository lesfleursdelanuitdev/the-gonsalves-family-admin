"use client";

import {
  CalendarDays,
  CalendarRange,
  FileText,
  MapPin,
  Tags,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaEditorTab } from "@/components/admin/media-editor/media-editor-types";

const TABS = [
  { id: "file" as const, label: "File info", Icon: FileText },
  { id: "individuals" as const, label: "Individuals", Icon: User },
  { id: "families" as const, label: "Families", Icon: Users },
  { id: "events" as const, label: "Events", Icon: CalendarDays },
  { id: "places" as const, label: "Places", Icon: MapPin },
  { id: "dates" as const, label: "Dates", Icon: CalendarRange },
  { id: "organisation" as const, label: "Organisation", Icon: Tags },
] as const;

export function MediaEditorTabBar({
  activeTab,
  onTabChange,
  tabIdPrefix,
}: {
  activeTab: MediaEditorTab;
  onTabChange: (tab: MediaEditorTab) => void;
  tabIdPrefix: string;
}) {
  return (
    <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
      <div
        className="flex gap-0 overflow-x-auto overscroll-x-contain"
        role="tablist"
        aria-label="Media editor sections"
      >
        {TABS.map(({ id, label, Icon }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabIdPrefix}-panel-${id}`}
              id={`${tabIdPrefix}-tab-${id}`}
              title={label}
              className={cn(
                "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
              )}
              onClick={() => onTabChange(id)}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="sr-only md:hidden">{label}</span>
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
