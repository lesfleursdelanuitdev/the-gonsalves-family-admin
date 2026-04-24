"use client";

import { useId, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";
import {
  adminPlaceSuggestionRowToFormSlice,
  buildPlaceSuggestionSearchText,
  formatPlaceSuggestionLabel,
} from "@/lib/forms/admin-place-suggestions";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPlaceSuggestions } from "@/hooks/useAdminPlaceSuggestions";

export type GedcomPlaceInputProps = {
  value: GedcomPlaceFormSlice;
  onChange: (patch: Partial<GedcomPlaceFormSlice>) => void;
  /**
   * Prefix for stable `id` / `htmlFor` (e.g. `event-`).
   * When omitted, a unique prefix is derived from `useId()`.
   */
  idPrefix?: string;
  className?: string;
  /** Placeholders and spacing aligned with the event editor. */
  eventStyleHints?: boolean;
  /** Small “Place” heading (e.g. combined birth/death key fact panel). */
  showSectionHeading?: boolean;
  /**
   * When true (default), query GET `/api/admin/places` for the current admin tree file
   * and list matches the user can apply to the form.
   */
  placeSuggestions?: boolean;
};

export function GedcomPlaceInput({
  value,
  onChange,
  idPrefix: idPrefixProp,
  className,
  eventStyleHints = false,
  showSectionHeading = false,
  placeSuggestions = true,
}: GedcomPlaceInputProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `gpi-${auto}-`;
  const suggestId = `${p}place-suggestions`;

  const searchText = useMemo(() => buildPlaceSuggestionSearchText(value), [value]);
  const debouncedSearch = useDebouncedValue(searchText, 280);
  const suggestionsQuery = useAdminPlaceSuggestions(debouncedSearch, {
    enabled: placeSuggestions,
    minLength: 2,
    limit: 15,
  });

  const places = suggestionsQuery.data?.places ?? [];
  const showSuggestPanel = placeSuggestions && debouncedSearch.trim().length >= 2;

  return (
    <div
      className={cn(
        eventStyleHints ? "space-y-4" : "space-y-3",
        className,
      )}
    >
      {showSectionHeading ? (
        <h4 className="text-xs font-medium text-muted-foreground">Place</h4>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${p}place-city`}>City / locality</Label>
          <Input
            id={`${p}place-city`}
            value={value.placeName}
            onChange={(e) => onChange({ placeName: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}place-county`}>County</Label>
          <Input
            id={`${p}place-county`}
            value={value.placeCounty}
            onChange={(e) => onChange({ placeCounty: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}place-state`}>State / province</Label>
          <Input
            id={`${p}place-state`}
            value={value.placeState}
            onChange={(e) => onChange({ placeState: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}place-country`}>Country</Label>
          <Input
            id={`${p}place-country`}
            value={value.placeCountry}
            onChange={(e) => onChange({ placeCountry: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>

      {showSuggestPanel ? (
        <div
          id={suggestId}
          className="space-y-1.5 rounded-md border border-base-content/12 bg-base-100/80 p-2"
          role="region"
          aria-label="Matching places from this tree"
        >
          <p className="px-1 text-xs font-medium text-muted-foreground">
            Matching places in this file
          </p>
          {suggestionsQuery.isLoading ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : suggestionsQuery.isError ? (
            <p className="px-1 py-2 text-xs text-destructive">
              {suggestionsQuery.error instanceof Error
                ? suggestionsQuery.error.message
                : "Could not load suggestions."}
            </p>
          ) : places.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded border border-base-content/8">
              {places.map((row) => (
                <li key={row.id} className="border-b border-base-content/6 last:border-b-0">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm leading-snug hover:bg-base-content/[0.06] focus-visible:bg-base-content/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/15"
                    onClick={() => onChange(adminPlaceSuggestionRowToFormSlice(row))}
                  >
                    {formatPlaceSuggestionLabel(row)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-2 text-xs text-muted-foreground">No matching places found.</p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${p}place-original`}>Full place text (optional)</Label>
        <Input
          id={`${p}place-original`}
          value={value.placeOriginal}
          onChange={(e) => onChange({ placeOriginal: e.target.value })}
          placeholder={
            eventStyleHints ? "Overrides composed line for storage / hash when provided" : undefined
          }
          autoComplete="off"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${p}place-lat`}>Latitude</Label>
          <Input
            id={`${p}place-lat`}
            value={value.placeLat}
            onChange={(e) => onChange({ placeLat: e.target.value })}
            placeholder={eventStyleHints ? "decimal" : undefined}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}place-lng`}>Longitude</Label>
          <Input
            id={`${p}place-lng`}
            value={value.placeLng}
            onChange={(e) => onChange({ placeLng: e.target.value })}
            placeholder={eventStyleHints ? "decimal" : undefined}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
