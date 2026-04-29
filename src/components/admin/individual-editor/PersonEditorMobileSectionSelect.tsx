"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { PersonEditorNavItem, PersonEditorSectionId } from "@/components/admin/individual-editor/person-editor-nav";

export function PersonEditorMobileSectionSelect({
  items,
  value,
  onChange,
}: {
  items: readonly PersonEditorNavItem[];
  value: PersonEditorSectionId;
  onChange: (id: PersonEditorSectionId) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="person-editor-section-jump" className="text-xs text-muted-foreground">
        Jump to section
      </Label>
      <select
        id="person-editor-section-jump"
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value as PersonEditorSectionId)}
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
