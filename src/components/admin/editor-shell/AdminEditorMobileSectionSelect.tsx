"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { AdminEditorNavItem } from "@/components/admin/editor-shell/AdminEditorSidebarNav";

export function AdminEditorMobileSectionSelect({
  items,
  value,
  onChange,
  labelId = "admin-editor-section-jump",
  labelText = "Jump to section",
}: {
  items: readonly AdminEditorNavItem[];
  value: string;
  onChange: (id: string) => void;
  labelId?: string;
  labelText?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={labelId} className="text-xs text-muted-foreground">
        {labelText}
      </Label>
      <select
        id={labelId}
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
