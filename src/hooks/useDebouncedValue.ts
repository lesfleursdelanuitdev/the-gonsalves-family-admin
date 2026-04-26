"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stayed unchanged for `delayMs` milliseconds.
 *
 * **Recommended delays in this app** (tune per UX / API cost). Prefer the exported constants below so
 * delays stay consistent across pickers:
 * - {@link ADMIN_PICKER_DEBOUNCE_MS} — Admin list pickers and multi-field search (`IndividualSearchPicker`,
 *   `FamilySearchPicker`, `EventPicker`, tag/album search in `useMediaEditorLinks`).
 * - {@link ADMIN_MODAL_DEBOUNCE_MS} — Modal pickers and GEDCOM suggest (`MediaPickerModal`, `GedcomPlaceInput`,
 *   `GedcomDateInput`).
 * - {@link NOTE_FULLTEXT_DEBOUNCE_MS} — Heavier or broader queries (`NotePicker` full-text style search).
 */
export const ADMIN_PICKER_DEBOUNCE_MS = 250;
export const ADMIN_MODAL_DEBOUNCE_MS = 280;
export const NOTE_FULLTEXT_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
