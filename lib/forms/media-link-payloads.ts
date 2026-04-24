import {
  emptyKeyFactFormState,
  keyFactToApiValue,
  type GedcomDateFormSlice,
  type GedcomPlaceFormSlice,
} from "@/lib/forms/individual-editor-form";

/** JSON fragment for POST `/api/admin/media/:id/place-media` body `{ place }`. */
export function placeSliceToApiPayload(slice: GedcomPlaceFormSlice): Record<string, unknown> | null {
  const v = keyFactToApiValue({ ...emptyKeyFactFormState(), ...slice });
  if (!v || typeof v !== "object" || !("place" in v)) return null;
  return v.place as Record<string, unknown>;
}

/** JSON fragment for POST `/api/admin/media/:id/date-media` body `{ date }`. */
export function dateSliceToApiPayload(slice: GedcomDateFormSlice): Record<string, unknown> | null {
  const v = keyFactToApiValue({ ...emptyKeyFactFormState(), ...slice });
  if (!v || typeof v !== "object" || !("date" in v)) return null;
  return v.date as Record<string, unknown>;
}
