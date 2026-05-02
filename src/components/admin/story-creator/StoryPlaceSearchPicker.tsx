"use client";

/**
 * Compact place search for story context: same GET `/api/admin/places` flow as `GedcomPlaceInput`
 * (`useAdminPlaceSuggestions` + `formatPlaceSuggestionLabel`).
 */

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_MODAL_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPlaceSuggestions } from "@/hooks/useAdminPlaceSuggestions";
import { formatPlaceSuggestionLabel, type AdminPlaceSuggestionRow } from "@/lib/forms/admin-place-suggestions";
import { cn } from "@/lib/utils";

export type StoryPlaceSearchPickerProps = {
  idPrefix?: string;
  excludeIds?: Set<string>;
  onPick: (row: AdminPlaceSuggestionRow) => void;
  className?: string;
};

export function StoryPlaceSearchPicker({ idPrefix: idPrefixProp, excludeIds, onPick, className }: StoryPlaceSearchPickerProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `story-place-${auto}-`;
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q.trim(), ADMIN_MODAL_DEBOUNCE_MS);
  const suggestionsQuery = useAdminPlaceSuggestions(debounced, { minLength: 2, limit: 15, enabled: true });
  const places = suggestionsQuery.data?.places ?? [];
  const showPanel = debounced.length >= 2;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${p}q`} className="text-xs text-base-content/70">
          Search places in this file
        </Label>
        <Input
          id={`${p}q`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type at least 2 characters…"
          autoComplete="off"
        />
      </div>
      {showPanel ? (
        <div
          className="space-y-1.5 rounded-md border border-base-content/12 bg-base-100/80 p-2"
          role="region"
          aria-label="Matching places from this tree"
        >
          {suggestionsQuery.isLoading ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : suggestionsQuery.isError ? (
            <p className="px-1 py-2 text-xs text-destructive">
              {suggestionsQuery.error instanceof Error
                ? suggestionsQuery.error.message
                : "Could not load places."}
            </p>
          ) : places.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded border border-base-content/8">
              {places.map((row) => {
                const disabled = excludeIds?.has(row.id) ?? false;
                return (
                  <li key={row.id} className="border-b border-base-content/6 last:border-b-0">
                    <button
                      type="button"
                      disabled={disabled}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/15",
                        disabled
                          ? "cursor-not-allowed text-base-content/35"
                          : "hover:bg-base-content/[0.06] focus-visible:bg-base-content/[0.06]",
                      )}
                      onClick={() => {
                        if (disabled) return;
                        onPick(row);
                      }}
                    >
                      {formatPlaceSuggestionLabel(row)}
                      {disabled ? <span className="ml-1 text-[10px] text-muted-foreground">(already linked)</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-1 py-2 text-xs text-muted-foreground">No matching places found.</p>
          )}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-base-content/45">Matches update as you type (debounced).</p>
      )}
    </div>
  );
}
