import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

/** Build `links` payload for POST/PATCH /api/admin/events from note-style chips (individual + family only). */
export function noteLinksToEventCreatePayload(links: SelectedNoteLink[]) {
  return {
    individualIds: links.filter((l) => l.kind === "individual").map((l) => l.id),
    familyIds: links.filter((l) => l.kind === "family").map((l) => l.id),
  };
}

/** Union IDs so edit-mode invalidation covers removed as well as current links. */
export function unionEventLinkTargets(
  a: { individualIds: string[]; familyIds: string[] },
  b: { individualIds: string[]; familyIds: string[] },
): { individualIds: string[]; familyIds: string[] } {
  return {
    individualIds: [...new Set([...a.individualIds, ...b.individualIds])],
    familyIds: [...new Set([...a.familyIds, ...b.familyIds])],
  };
}

/** Map GET /api/admin/events/:id `event` into link chips (matches detail include). */
export function eventDetailToSelectedLinks(event: Record<string, unknown>): SelectedNoteLink[] {
  const out: SelectedNoteLink[] = [];

  const individualEvents = event.individualEvents as
    | Array<{
        individual: {
          id: string;
          fullName: string | null;
          xref: string;
          individualNameForms?: Parameters<typeof formatDisplayNameFromNameForms>[0];
        };
      }>
    | undefined;
  individualEvents?.forEach((row) => {
    const ind = row.individual;
    if (!ind?.id) return;
    const name =
      formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
      stripSlashesFromName(ind.fullName) ||
      ind.xref ||
      ind.id;
    out.push({ kind: "individual", id: ind.id, label: name });
  });

  const familyEvents = event.familyEvents as
    | Array<{
        family: {
          id: string;
          xref: string;
          husband: { fullName: string | null } | null;
          wife: { fullName: string | null } | null;
        };
      }>
    | undefined;
  familyEvents?.forEach((row) => {
    const fam = row.family;
    if (!fam?.id) return;
    const h = stripSlashesFromName(fam.husband?.fullName);
    const w = stripSlashesFromName(fam.wife?.fullName);
    const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || fam.xref || fam.id;
    out.push({ kind: "family", id: fam.id, label });
  });

  return out;
}
