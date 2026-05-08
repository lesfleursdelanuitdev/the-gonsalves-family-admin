import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

/** One navigable link for the open-question detail “Linked records” card. */
export type OpenQuestionLinkedRecordRow = { href: string; label: string };

/**
 * Build links to admin view pages for each linked entity (`OPEN_QUESTION_DETAIL_INCLUDE` payload).
 */
export function getOpenQuestionLinkedRecordRows(oq: Record<string, unknown>): OpenQuestionLinkedRecordRow[] {
  const rows: OpenQuestionLinkedRecordRow[] = [];

  const inds = oq.individualLinks as
    | { individual?: { id?: string; fullName?: string | null; xref?: string | null } }[]
    | undefined;
  for (const row of inds ?? []) {
    const id = row.individual?.id?.trim();
    if (!id) continue;
    const name = stripSlashesFromName(row.individual?.fullName ?? null);
    const label = name || row.individual?.xref?.trim() || id;
    rows.push({ href: `/admin/individuals/${id}`, label });
  }

  const fams = oq.familyLinks as
    | {
        family?: {
          id?: string;
          xref?: string | null;
          husband?: { fullName?: string | null } | null;
          wife?: { fullName?: string | null } | null;
        };
      }[]
    | undefined;
  for (const row of fams ?? []) {
    const id = row.family?.id?.trim();
    if (!id) continue;
    const h = stripSlashesFromName(row.family?.husband?.fullName ?? null);
    const w = stripSlashesFromName(row.family?.wife?.fullName ?? null);
    const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || row.family?.xref?.trim() || id;
    rows.push({ href: `/admin/families/${id}`, label });
  }

  const evs = oq.eventLinks as
    | { event?: { id?: string; eventType?: string; customType?: string | null } }[]
    | undefined;
  for (const row of evs ?? []) {
    const id = row.event?.id?.trim();
    if (!id) continue;
    const et = row.event?.eventType ?? "";
    const ct = (row.event?.customType ?? "").trim();
    const label = ct ? `${labelGedcomEventType(et)} (${ct})` : labelGedcomEventType(et);
    rows.push({ href: `/admin/events/${id}`, label });
  }

  const meds = oq.mediaLinks as { media?: { id?: string; title?: string | null; xref?: string | null } }[] | undefined;
  for (const row of meds ?? []) {
    const id = row.media?.id?.trim();
    if (!id) continue;
    const label = row.media?.title?.trim() || row.media?.xref?.trim() || id;
    rows.push({ href: `/admin/media/${id}`, label });
  }

  const srcs = oq.sourceLinks as { source?: { id?: string; title?: string | null; xref?: string | null } }[] | undefined;
  for (const row of srcs ?? []) {
    const id = row.source?.id?.trim();
    if (!id) continue;
    const label = row.source?.title?.trim() || row.source?.xref?.trim() || id;
    rows.push({ href: `/admin/sources/${id}/edit`, label });
  }

  const notes = oq.noteLinks as { note?: { id?: string; xref?: string | null; content?: string | null } }[] | undefined;
  for (const row of notes ?? []) {
    const id = row.note?.id?.trim();
    if (!id) continue;
    const preview = (row.note?.content ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const label = preview || row.note?.xref?.trim() || id;
    rows.push({ href: `/admin/notes/${id}`, label });
  }

  return rows;
}

/** Build a short “linked to” summary for list rows from API include payload. */
export function summarizeOpenQuestionLinks(oq: Record<string, unknown>): string {
  const parts: string[] = [];

  const inds = oq.individualLinks as { individual?: { fullName?: string | null; xref?: string | null } }[] | undefined;
  for (const row of inds ?? []) {
    const name = stripSlashesFromName(row.individual?.fullName ?? null);
    const label = name || row.individual?.xref || "Person";
    parts.push(label);
  }

  const fams = oq.familyLinks as
    | {
        family?: {
          husband?: { fullName?: string | null } | null;
          wife?: { fullName?: string | null } | null;
        };
      }[]
    | undefined;
  for (const row of fams ?? []) {
    const h = stripSlashesFromName(row.family?.husband?.fullName ?? null);
    const w = stripSlashesFromName(row.family?.wife?.fullName ?? null);
    const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || "Family";
    parts.push(label);
  }

  const evs = oq.eventLinks as { event?: { eventType?: string; customType?: string | null } }[] | undefined;
  for (const row of evs ?? []) {
    const et = row.event?.eventType ?? "";
    const ct = (row.event?.customType ?? "").trim();
    const label = ct ? `${labelGedcomEventType(et)} (${ct})` : labelGedcomEventType(et);
    parts.push(label);
  }

  const meds = oq.mediaLinks as { media?: { title?: string | null; xref?: string | null } }[] | undefined;
  for (const row of meds ?? []) {
    const t = row.media?.title?.trim() || row.media?.xref || "Media";
    parts.push(t);
  }

  const srcs = oq.sourceLinks as { source?: { title?: string | null; xref?: string | null } }[] | undefined;
  for (const row of srcs ?? []) {
    const t = row.source?.title?.trim() || row.source?.xref || "Source";
    parts.push(t);
  }

  const notes = oq.noteLinks as { note?: { xref?: string | null; content?: string | null } }[] | undefined;
  for (const row of notes ?? []) {
    const preview = (row.note?.content ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
    const t = preview || row.note?.xref || "Note";
    parts.push(t);
  }

  return parts.length ? parts.join("; ") : "—";
}
