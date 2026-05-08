import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import { NOTE_LINKED_LIST_VISIBLE_MAX } from "@/lib/admin/note-linked-limits";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { formatNoteLinkedEventLabel } from "@/lib/gedcom/gedcom-event-labels";

export type NotePickerLinkedBlock = { heading: string; lines: string[]; overflow?: number };

/** “Linked to” sections for picker UI (Individuals / Families / Events / Sources). */
export function notePickerLinkedBlocks(note: AdminNoteListItem): NotePickerLinkedBlock[] {
  const blocks: NotePickerLinkedBlock[] = [];

  const individuals = (note.individualNotes ?? [])
    .map((row) => stripSlashesFromName(row.individual?.fullName))
    .filter((s): s is string => Boolean(s?.trim()));
  if (individuals.length) {
    const lines = individuals.slice(0, NOTE_LINKED_LIST_VISIBLE_MAX);
    const overflow = individuals.length - lines.length;
    blocks.push({ heading: "Individuals", lines, ...(overflow > 0 ? { overflow } : {}) });
  }

  const families = (note.familyNotes ?? []).map((fn) => {
    const h = stripSlashesFromName(fn.family?.husband?.fullName);
    const w = stripSlashesFromName(fn.family?.wife?.fullName);
    const label = `${h ?? ""} & ${w ?? ""}`.replace(/^ & | & $/g, "").trim();
    return label || "Family";
  });
  if (families.length) {
    const lines = families.slice(0, NOTE_LINKED_LIST_VISIBLE_MAX);
    const overflow = families.length - lines.length;
    blocks.push({ heading: "Families", lines, ...(overflow > 0 ? { overflow } : {}) });
  }

  const events = (note.eventNotes ?? [])
    .map((en) => {
      const et = en.event?.eventType;
      if (!et) return "";
      return formatNoteLinkedEventLabel(et, en.event?.customType ?? null);
    })
    .filter(Boolean);
  if (events.length) {
    const lines = events.slice(0, NOTE_LINKED_LIST_VISIBLE_MAX);
    const overflow = events.length - lines.length;
    blocks.push({ heading: "Events", lines, ...(overflow > 0 ? { overflow } : {}) });
  }

  const sources = (note.sourceNotes ?? [])
    .map((sn) => sn.source?.title?.trim() || sn.source?.xref?.trim() || "")
    .filter(Boolean);
  if (sources.length) {
    const lines = sources.slice(0, NOTE_LINKED_LIST_VISIBLE_MAX);
    const overflow = sources.length - lines.length;
    blocks.push({ heading: "Sources", lines, ...(overflow > 0 ? { overflow } : {}) });
  }

  return blocks;
}
