"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { EventEditorNavItem, EventEditorSectionId } from "@/components/admin/event-editor/event-editor-nav";

export function EventEditorMobileSectionSelect({
  items,
  value,
  onChange,
}: {
  items: readonly EventEditorNavItem[];
  value: EventEditorSectionId;
  onChange: (id: EventEditorSectionId) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="event-editor-section-jump" className="text-xs text-muted-foreground">
        Jump to section
      </Label>
      <select
        id="event-editor-section-jump"
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value as EventEditorSectionId)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
