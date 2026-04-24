"use client";

import { useId } from "react";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import { cn } from "@/lib/utils";

/** Re-export: same shape as Prisma `GedcomDate` + `GedcomPlace` string fields used in admin forms. */
export type { KeyFactFormState as GedcomDatePlaceFormState } from "@/lib/forms/individual-editor-form";

export type { GedcomDateFormSlice, GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";

export type GedcomDatePlaceSections = "both" | "date" | "place";

export type GedcomDatePlaceFieldsProps = {
  value: KeyFactFormState;
  onChange: (next: KeyFactFormState) => void;
  /**
   * Prefix for stable `id` / `htmlFor` (e.g. `event-`).
   * When omitted, a unique prefix is derived from `useId()`.
   */
  idPrefix?: string;
  className?: string;
  /** Render only date, only place, or both (default). */
  sections?: GedcomDatePlaceSections;
  /**
   * When `sections` is `"both"`, show a small “Place” heading above place fields
   * (matches the previous KeyFact layout).
   */
  showPlaceSectionHeading?: boolean;
  /** Placeholders and helper copy aligned with the event editor. */
  eventStyleHints?: boolean;
  /** Passed to `GedcomDateInput` when the date section is shown. */
  dateSuggestions?: boolean;
  /** Passed to `GedcomPlaceInput` when the place section is shown. */
  placeSuggestions?: boolean;
};

function mergeFact(prev: KeyFactFormState, p: Partial<KeyFactFormState>): KeyFactFormState {
  return { ...prev, ...p };
}

export function GedcomDatePlaceFields({
  value,
  onChange,
  idPrefix: idPrefixProp,
  className,
  sections = "both",
  showPlaceSectionHeading = false,
  eventStyleHints = false,
  dateSuggestions = true,
  placeSuggestions = true,
}: GedcomDatePlaceFieldsProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `gdp-${auto}-`;

  const showDate = sections === "both" || sections === "date";
  const showPlace = sections === "both" || sections === "place";

  return (
    <div className={className}>
      {showDate ? (
        <GedcomDateInput
          idPrefix={p}
          eventStyleHints={eventStyleHints}
          dateSuggestions={dateSuggestions}
          value={value}
          onChange={(patch) => onChange(mergeFact(value, patch))}
        />
      ) : null}

      {showPlace ? (
        <GedcomPlaceInput
          idPrefix={p}
          eventStyleHints={eventStyleHints}
          placeSuggestions={placeSuggestions}
          showSectionHeading={showPlaceSectionHeading}
          value={value}
          onChange={(patch) => onChange(mergeFact(value, patch))}
          className={cn(
            showDate && "space-y-3 border-t border-base-content/10 pt-3",
          )}
        />
      ) : null}
    </div>
  );
}
