"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { cn } from "@/lib/utils";

export type TagFilterOption = { id: string; name: string };

export function TagFilter({
  id,
  tags,
  value,
  onChange,
  className,
}: {
  id?: string;
  tags: readonly TagFilterOption[];
  value: string;
  onChange: (tagId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Tag
      </Label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {displayTagName(t.name)}
          </option>
        ))}
      </select>
    </div>
  );
}
