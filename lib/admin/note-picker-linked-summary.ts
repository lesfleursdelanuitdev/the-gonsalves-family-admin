import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

export type NotePickerLinkedBlock = { heading: string; lines: string[] };

/** “Linked to” sections for picker UI (Individuals / Families / Events / Sources). */
export function notePickerLinkedBlocks(note: AdminNoteListItem): NotePickerLinkedBlock[] {
  const blocks: NotePickerLinkedBlock[] = [];

  const individuals = (note.individualNotes ?? [])
    .map((row) => stripSlashesFromName(row.individual?.fullName))
    .filter((s): s is string => Boolean(s?.trim()));
  if (individuals.length) {
    blocks.push({ heading: "Individuals", lines: individuals });
  }

  const families = (note.familyNotes ?? []).map((fn) => {
    const h = stripSlashesFromName(fn.family?.husband?.fullName);
    const w = stripSlashesFromName(fn.family?.wife?.fullName);
    const label = `${h ?? ""} & ${w ?? ""}`.replace(/^ & | & $/g, "").trim();
    return label || "Family";
  });
  if (families.length) {
    blocks.push({ heading: "Families", lines: families });
  }

  const events = (note.eventNotes ?? [])
    .map((en) => (en.event?.eventType ? labelGedcomEventType(en.event.eventType) : ""))
    .filter(Boolean);
  if (events.length) {
    blocks.push({ heading: "Events", lines: events });
  }

  const sources = (note.sourceNotes ?? [])
    .map((sn) => sn.source?.title?.trim() || sn.source?.xref?.trim() || "")
    .filter(Boolean);
  if (sources.length) {
    blocks.push({ heading: "Sources", lines: sources });
  }

  return blocks;
}
