import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import {
  emptyKeyFactFormState,
  type GedcomDateFormSlice,
  type GedcomPlaceFormSlice,
} from "@/lib/forms/individual-editor-form";
import { formatDateSuggestionLabel } from "@/lib/forms/admin-date-suggestions";
import { formatPlaceSuggestionLabel } from "@/lib/forms/admin-place-suggestions";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";

export function emptyPlaceDraft(): GedcomPlaceFormSlice {
  const e = emptyKeyFactFormState();
  return {
    placeName: e.placeName,
    placeCounty: e.placeCounty,
    placeState: e.placeState,
    placeCountry: e.placeCountry,
    placeOriginal: e.placeOriginal,
    placeLat: e.placeLat,
    placeLng: e.placeLng,
  };
}

export function emptyDateDraft(): GedcomDateFormSlice {
  const e = emptyKeyFactFormState();
  return {
    dateSpecifier: e.dateSpecifier,
    dateOriginal: e.dateOriginal,
    y: e.y,
    m: e.m,
    d: e.d,
    ey: e.ey,
    em: e.em,
    ed: e.ed,
  };
}

export function labelFromPlaceApi(p: NonNullable<MediaEditorInitial["placeLinks"]>[0]["place"]): string {
  return formatPlaceSuggestionLabel({
    id: p.id,
    original: p.original,
    name: p.name,
    county: p.county,
    state: p.state,
    country: p.country,
    latitude: null,
    longitude: null,
  });
}

export function labelFromDateApi(d: NonNullable<MediaEditorInitial["dateLinks"]>[0]["date"]): string {
  return formatDateSuggestionLabel({
    id: d.id,
    original: d.original,
    dateType: d.dateType,
    calendar: "GREGORIAN",
    year: d.year,
    month: d.month,
    day: d.day,
    endYear: d.endYear,
    endMonth: d.endMonth,
    endDay: d.endDay,
  });
}

export function minimalIndividualListItem(i: {
  id: string;
  xref: string | null;
  fullName: string | null;
}): AdminIndividualListItem {
  return {
    id: i.id,
    xref: i.xref ?? "",
    fullName: i.fullName,
    sex: null,
    birthYear: null,
    deathYear: null,
  };
}

export function formatEventLinkLabel(ev: { eventType: string; customType: string | null }): string {
  const base = labelGedcomEventType(ev.eventType);
  const custom =
    ev.eventType.toUpperCase() === "EVEN" && ev.customType?.trim()
      ? ` (${ev.customType.trim()})`
      : "";
  return base + custom;
}

export function formatEventDescriptiveLabel(ev: AdminEventListItem): string {
  const head = formatEventLinkLabel({
    eventType: ev.eventType,
    customType: ev.customType ?? null,
  });
  const year = ev.date?.year;
  const yearBit = year != null ? ` (${year})` : "";
  const place = (ev.place?.name ?? ev.place?.original ?? "").trim();
  const placeBit = place ? ` — ${place.length > 52 ? `${place.slice(0, 49)}…` : place}` : "";

  const ie = ev.individualEvents?.[0];
  if (ie?.individual) {
    const ind = ie.individual;
    const dn =
      formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
      stripSlashesFromName(ind.fullName) ||
      "";
    const core = dn ? `${head} of ${dn}` : head;
    return `${core}${yearBit}${placeBit}`;
  }

  const fe = ev.familyEvents?.[0];
  if (fe?.family) {
    const h = stripSlashesFromName(fe.family.husband?.fullName ?? "") || "";
    const w = stripSlashesFromName(fe.family.wife?.fullName ?? "") || "";
    const pair = [h, w].filter(Boolean).join(" and ");
    const core = pair ? `${head} of ${pair}` : head;
    return `${core}${yearBit}${placeBit}`;
  }

  return `${head}${yearBit}${placeBit}`;
}
