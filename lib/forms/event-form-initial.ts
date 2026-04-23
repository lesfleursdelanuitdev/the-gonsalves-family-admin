import { GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import { eventDetailToSelectedLinks } from "@/lib/forms/event-form-links";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

export const EVENT_TYPE_TAG_LIST = Object.keys(GEDCOM_EVENT_TYPE_LABELS).sort();
export const EVENT_FORM_CUSTOM_TAG = "__CUSTOM__";

export interface EventFormDefaults {
  eventTypeChoice: string;
  customEventTag: string;
  customType: string;
  value: string;
  cause: string;
  agency: string;
  dateSpecifier: string;
  dateOriginal: string;
  y: string;
  m: string;
  d: string;
  ey: string;
  em: string;
  ed: string;
  placeName: string;
  placeCounty: string;
  placeState: string;
  placeCountry: string;
  placeOriginal: string;
  placeLat: string;
  placeLng: string;
  selectedLinks: SelectedNoteLink[];
  /** Comma- or whitespace-separated `gedcom_media_v2` UUIDs linked to this event. */
  mediaIdsCsv: string;
}

function decToInputString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "";
}

export function createEmptyEventFormDefaults(): EventFormDefaults {
  return {
    eventTypeChoice: "BIRT",
    customEventTag: "",
    customType: "",
    value: "",
    cause: "",
    agency: "",
    dateSpecifier: "EXACT",
    dateOriginal: "",
    y: "",
    m: "",
    d: "",
    ey: "",
    em: "",
    ed: "",
    placeName: "",
    placeCounty: "",
    placeState: "",
    placeCountry: "",
    placeOriginal: "",
    placeLat: "",
    placeLng: "",
    selectedLinks: [],
    mediaIdsCsv: "",
  };
}

/** Map GET event payload into controlled field defaults for EventForm. */
export function eventRecordToFormDefaults(ev: Record<string, unknown>): EventFormDefaults {
  const eventType = String(ev.eventType ?? "EVEN").trim();
  const inList = EVENT_TYPE_TAG_LIST.includes(eventType);
  const date = ev.date as Record<string, unknown> | null | undefined;
  const place = ev.place as Record<string, unknown> | null | undefined;

  const dt = date?.dateType != null ? String(date.dateType) : "EXACT";

  return {
    eventTypeChoice: inList ? eventType : EVENT_FORM_CUSTOM_TAG,
    customEventTag: inList ? "" : eventType,
    customType: String(ev.customType ?? "").trim(),
    value: String(ev.value ?? "").trim(),
    cause: String(ev.cause ?? "").trim(),
    agency: String(ev.agency ?? "").trim(),
    dateSpecifier: dt,
    dateOriginal: String(date?.original ?? "").trim(),
    y: date?.year != null ? String(date.year) : "",
    m: date?.month != null ? String(date.month) : "",
    d: date?.day != null ? String(date.day) : "",
    ey: date?.endYear != null ? String(date.endYear) : "",
    em: date?.endMonth != null ? String(date.endMonth) : "",
    ed: date?.endDay != null ? String(date.endDay) : "",
    placeName: String(place?.name ?? "").trim(),
    placeCounty: String(place?.county ?? "").trim(),
    placeState: String(place?.state ?? "").trim(),
    placeCountry: String(place?.country ?? "").trim(),
    placeOriginal: String(place?.original ?? "").trim(),
    placeLat: decToInputString(place?.latitude),
    placeLng: decToInputString(place?.longitude),
    selectedLinks: eventDetailToSelectedLinks(ev),
    mediaIdsCsv: (() => {
      const rows = ev.eventMedia as { media?: { id?: string } }[] | undefined;
      if (!Array.isArray(rows)) return "";
      const ids = rows.map((r) => r.media?.id).filter((x): x is string => typeof x === "string" && x.length > 0);
      return ids.join(", ");
    })(),
  };
}
