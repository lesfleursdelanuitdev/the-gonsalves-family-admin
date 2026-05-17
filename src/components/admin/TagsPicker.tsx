"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAdminTags, type AdminTagListItem } from "@/hooks/useAdminTags";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { Input } from "@/components/ui/input";

export type SelectedTag = {
  id: string;
  name: string;
  color: string | null;
};

export function TagsPicker({
  selected,
  onAdd,
  onRemove,
  onCreate,
  disabled,
  placeholder = "Search tags…",
}: {
  selected: SelectedTag[];
  onAdd: (tag: AdminTagListItem) => void;
  onRemove: (tag: SelectedTag) => void;
  onCreate?: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const debouncedQ = useDebouncedValue(query.trim(), ADMIN_PICKER_DEBOUNCE_MS);

  const { data, isLoading } = useAdminTags(
    { q: debouncedQ, limit: 40 },
    { enabled: debouncedQ.length >= 1 },
  );

  const results = data?.tags ?? [];
  const selectedIds = new Set(selected.map((t) => t.id));
  const filteredResults = results.filter((t) => !selectedIds.has(t.id));
  const exactMatch = results.some(
    (t) => displayTagName(t.name).toLowerCase() === query.trim().toLowerCase(),
  );
  const showDropdown = query.trim().length >= 1;
  const showCreate = onCreate && !exactMatch && query.trim().length >= 1;
  const showNoMatches = !isLoading && filteredResults.length === 0 && !showCreate;

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2.5 py-0.5 text-xs font-medium text-base-content"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color ?? "var(--color-base-content)" }}
                aria-hidden
              />
              <span className="truncate">{displayTagName(tag.name)}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-base-content/60 hover:bg-base-300/80 hover:text-base-content disabled:opacity-40"
                onClick={() => onRemove(tag)}
                disabled={disabled}
                aria-label={`Remove ${displayTagName(tag.name)}`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
        />
        {showDropdown && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
            {isLoading ? (
              <p className="px-3 py-2 text-muted-foreground">Searching…</p>
            ) : (
              <>
                {filteredResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200/80"
                    onClick={() => {
                      onAdd(t);
                      setQuery("");
                    }}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color ?? "var(--color-base-content)" }}
                      aria-hidden
                    />
                    <span className="truncate">{displayTagName(t.name)}</span>
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                    onClick={() => {
                      onCreate!(query.trim());
                      setQuery("");
                    }}
                  >
                    Create tag "{displayTagName(query)}"
                  </button>
                )}
                {showNoMatches && (
                  <p className="px-3 py-2 text-muted-foreground">No tags found.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
