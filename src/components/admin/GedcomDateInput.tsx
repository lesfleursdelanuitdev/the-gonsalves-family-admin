"use client";

import { useId, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  GEDCOM_DATE_SPECIFIER_OPTIONS,
  gedcomDateSpecifierNeedsRange,
} from "@/lib/gedcom/gedcom-date-specifiers";
import type { GedcomDateFormSlice } from "@/lib/forms/individual-editor-form";
import {
  adminDateSuggestionRowToFormSlice,
  buildDateSuggestionSearchText,
  formatDateSuggestionLabel,
} from "@/lib/forms/admin-date-suggestions";
import { cn } from "@/lib/utils";
import { ADMIN_MODAL_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminDateSuggestions } from "@/hooks/useAdminDateSuggestions";

export type GedcomDateInputProps = {
  value: GedcomDateFormSlice;
  onChange: (patch: Partial<GedcomDateFormSlice>) => void;
  /**
   * Prefix for stable `id` / `htmlFor` (e.g. `event-`).
   * When omitted, a unique prefix is derived from `useId()`.
   */
  idPrefix?: string;
  className?: string;
  /** Placeholders aligned with the event editor. */
  eventStyleHints?: boolean;
  /**
   * When true (default), query GET `/api/admin/dates` for the current admin tree file
   * and list matches the user can apply to the form.
   */
  dateSuggestions?: boolean;
};

export function GedcomDateInput({
  value,
  onChange,
  idPrefix: idPrefixProp,
  className,
  eventStyleHints = false,
  dateSuggestions = true,
}: GedcomDateInputProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `gdi-${auto}-`;
  const suggestId = `${p}date-suggestions`;
  const showRange = gedcomDateSpecifierNeedsRange(value.dateSpecifier);

  const searchText = useMemo(() => buildDateSuggestionSearchText(value), [value]);
  const debouncedSearch = useDebouncedValue(searchText, ADMIN_MODAL_DEBOUNCE_MS);
  const suggestionsQuery = useAdminDateSuggestions(debouncedSearch, {
    enabled: dateSuggestions,
    minLength: 2,
    limit: 15,
  });

  const dates = suggestionsQuery.data?.dates ?? [];
  const showSuggestPanel = dateSuggestions && debouncedSearch.trim().length >= 2;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${p}date-specifier`}>Specifier</Label>
          <select
            id={`${p}date-specifier`}
            className={selectClassName}
            value={value.dateSpecifier}
            onChange={(e) => onChange({ dateSpecifier: e.target.value })}
          >
            {GEDCOM_DATE_SPECIFIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${p}date-original`}>Original text (optional)</Label>
          <Input
            id={`${p}date-original`}
            value={value.dateOriginal}
            onChange={(e) => onChange({ dateOriginal: e.target.value })}
            placeholder={eventStyleHints ? "e.g. ABT 1900 or BET 1900 AND 1910" : undefined}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${p}date-y`}>Year</Label>
          <Input
            id={`${p}date-y`}
            inputMode="numeric"
            value={value.y}
            onChange={(e) => onChange({ y: e.target.value })}
            placeholder={eventStyleHints ? "e.g. 1924" : undefined}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}date-m`}>Month</Label>
          <Input
            id={`${p}date-m`}
            inputMode="numeric"
            value={value.m}
            onChange={(e) => onChange({ m: e.target.value })}
            placeholder={eventStyleHints ? "1–12" : undefined}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${p}date-d`}>Day</Label>
          <Input
            id={`${p}date-d`}
            inputMode="numeric"
            value={value.d}
            onChange={(e) => onChange({ d: e.target.value })}
            placeholder={eventStyleHints ? "1–31" : undefined}
            autoComplete="off"
          />
        </div>
      </div>

      {showSuggestPanel ? (
        <div
          id={suggestId}
          className="space-y-1.5 rounded-md border border-base-content/12 bg-base-100/80 p-2"
          role="region"
          aria-label="Matching dates from this tree"
        >
          <p className="px-1 text-xs font-medium text-muted-foreground">
            Matching dates in this file
          </p>
          {suggestionsQuery.isLoading ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : suggestionsQuery.isError ? (
            <p className="px-1 py-2 text-xs text-destructive">
              {suggestionsQuery.error instanceof Error
                ? suggestionsQuery.error.message
                : "Could not load suggestions."}
            </p>
          ) : dates.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded border border-base-content/8">
              {dates.map((row) => (
                <li key={row.id} className="border-b border-base-content/6 last:border-b-0">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm leading-snug hover:bg-base-content/[0.06] focus-visible:bg-base-content/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/15"
                    onClick={() => onChange(adminDateSuggestionRowToFormSlice(row))}
                  >
                    {formatDateSuggestionLabel(row)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-2 text-xs text-muted-foreground">No matching dates found.</p>
          )}
        </div>
      ) : null}

      {showRange ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">End of range</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${p}date-ey`}>End year</Label>
              <Input
                id={`${p}date-ey`}
                inputMode="numeric"
                value={value.ey}
                onChange={(e) => onChange({ ey: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${p}date-em`}>End month</Label>
              <Input
                id={`${p}date-em`}
                inputMode="numeric"
                value={value.em}
                onChange={(e) => onChange({ em: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${p}date-ed`}>End day</Label>
              <Input
                id={`${p}date-ed`}
                inputMode="numeric"
                value={value.ed}
                onChange={(e) => onChange({ ed: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
