"use client";

import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import { cn } from "@/lib/utils";

export type AlbumFilterOption = { id: string; name: string };

export function AlbumFilter({
  id,
  albums,
  value,
  onChange,
  className,
}: {
  id?: string;
  albums: readonly AlbumFilterOption[];
  value: string;
  onChange: (albumId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Album
      </Label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All albums</option>
        {albums.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
