"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { FamilyEditorNavItem, FamilyEditorSectionId } from "@/components/admin/family-editor/family-editor-nav";

export function FamilyEditorMobileSectionSelect({
  items,
  value,
  onChange,
}: {
  items: readonly FamilyEditorNavItem[];
  value: FamilyEditorSectionId;
  onChange: (id: FamilyEditorSectionId) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="family-editor-section-jump" className="text-xs text-muted-foreground">
        Jump to section
      </Label>
      <select
        id="family-editor-section-jump"
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value as FamilyEditorSectionId)}
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
