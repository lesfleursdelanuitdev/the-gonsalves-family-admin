import { formatKeyFactSummaryLine } from "@/components/admin/individual-editor/person-editor-mobile-summaries";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { EVENT_FORM_CUSTOM_TAG } from "@/lib/forms/event-form-initial";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

export function eventTypeSummary(args: {
  eventTypeChoice: string;
  customEventTag: string;
  customType: string;
}): string {
  const resolved =
    args.eventTypeChoice === EVENT_FORM_CUSTOM_TAG ? args.customEventTag.trim().toUpperCase() : args.eventTypeChoice;
  const base = labelGedcomEventType(resolved || "EVEN");
  const t = args.customType.trim();
  if (t) return `${base} · ${t}`;
  return base;
}

export function eventDateSummary(datePlace: KeyFactFormState): string {
  const s = formatKeyFactSummaryLine(datePlace);
  return s === "Not added" ? "No date yet" : s;
}

export function eventPlaceSummary(datePlace: KeyFactFormState): string {
  const line =
    datePlace.placeOriginal?.trim() ||
    [datePlace.placeName, datePlace.placeCounty, datePlace.placeState, datePlace.placeCountry]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(", ");
  return line || "No place yet";
}

export function eventDetailsSummary(value: string): string {
  const t = value.trim();
  if (!t) return "No extra details";
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

export function eventLinkedSummary(links: SelectedNoteLink[]): string {
  const n = links.length;
  if (n === 0) return "No records linked yet";
  return `${n} linked record${n === 1 ? "" : "s"}`;
}

export function eventMediaSummary(count: number): string {
  if (count === 0) return "No media added yet";
  return `${count} media item${count === 1 ? "" : "s"}`;
}
