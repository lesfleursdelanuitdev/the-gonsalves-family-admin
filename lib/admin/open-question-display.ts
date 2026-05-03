import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

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
    const label = et ? labelGedcomEventType(row.event?.customType || et) : "Event";
    parts.push(label);
  }

  const meds = oq.mediaLinks as { media?: { title?: string | null; xref?: string | null } }[] | undefined;
  for (const row of meds ?? []) {
    const t = row.media?.title?.trim() || row.media?.xref || "Media";
    parts.push(t);
  }

  return parts.length ? parts.join("; ") : "—";
}
