import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";

const INDIVIDUAL_OF_TYPES = new Set([
  "BIRT",
  "CHR",
  "CHRA",
  "BAPM",
  "DEAT",
  "BURI",
  "CREM",
  "ADOP",
]);

/**
 * Human-oriented one-line label for picking an event on the note form
 * (e.g. "Birth of …", "Marriage of A and B").
 */
export function formatNoteEventPickerLabel(ev: AdminEventListItem): string {
  const typeTag = (ev.eventType ?? "").toUpperCase().trim();
  const typeWord = labelGedcomEventType(ev.eventType ?? "");
  const custom = (ev.customType ?? "").trim();
  const typePart = custom ? `${typeWord} (${custom})` : typeWord;

  const ind = ev.individualEvents?.[0]?.individual;
  if (ind) {
    const indName =
      formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
      stripSlashesFromName(ind.fullName) ||
      "—";
    if (indName !== "—" && INDIVIDUAL_OF_TYPES.has(typeTag)) {
      return `${typeWord} of ${indName}`;
    }
    return `${typePart} — ${indName}`;
  }

  const fam = ev.familyEvents?.[0]?.family;
  if (fam) {
    const h = stripSlashesFromName(fam.husband?.fullName ?? "") || "";
    const w = stripSlashesFromName(fam.wife?.fullName ?? "") || "";
    const partners = [h, w].filter(Boolean);
    if (typeTag === "MARR" && partners.length >= 2) {
      return `Marriage of ${partners[0]} and ${partners[1]}`;
    }
    if (typeTag === "MARR" && partners.length === 1) {
      return `Marriage of ${partners[0]}`;
    }
    if (partners.length > 0) {
      return `${typePart} — ${partners.join(" · ")}`;
    }
    return `${typePart} (family)`;
  }

  return typePart;
}
