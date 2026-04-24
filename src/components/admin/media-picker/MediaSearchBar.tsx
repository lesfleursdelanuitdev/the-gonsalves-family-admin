"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MediaSearchBar({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" aria-hidden />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search photos, documents, videos…"
        className="border-base-content/15 bg-base-100/80 pl-10 shadow-inner shadow-black/5"
        autoComplete="off"
      />
    </div>
  );
}
