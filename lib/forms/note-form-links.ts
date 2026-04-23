import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";

export type NoteLinkKind = "individual" | "family" | "event" | "source";

export interface SelectedNoteLink {
  kind: NoteLinkKind;
  id: string;
  label: string;
}

export function selectedLinksToPayload(links: SelectedNoteLink[]) {
  const individualIds: string[] = [];
  const familyIds: string[] = [];
  const eventIds: string[] = [];
  const sourceIds: string[] = [];
  for (const l of links) {
    if (l.kind === "individual") individualIds.push(l.id);
    else if (l.kind === "family") familyIds.push(l.id);
    else if (l.kind === "event") eventIds.push(l.id);
    else if (l.kind === "source") sourceIds.push(l.id);
  }
  return { individualIds, familyIds, eventIds, sourceIds };
}

/** Map GET /api/admin/notes/:id `note` into link chips (matches detail include). */
export function noteDetailToSelectedLinks(note: Record<string, unknown>): SelectedNoteLink[] {
  const out: SelectedNoteLink[] = [];

  const individualNotes = note.individualNotes as
    | Array<{
        individual: {
          id: string;
          fullName: string | null;
          xref: string;
          individualNameForms?: Parameters<typeof formatDisplayNameFromNameForms>[0];
        };
      }>
    | undefined;
  individualNotes?.forEach((row) => {
    const ind = row.individual;
    if (!ind?.id) return;
    const name =
      formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
      stripSlashesFromName(ind.fullName) ||
      ind.xref ||
      ind.id;
    out.push({ kind: "individual", id: ind.id, label: name });
  });

  const familyNotes = note.familyNotes as
    | Array<{
        family: {
          id: string;
          xref: string;
          husband: { fullName: string | null } | null;
          wife: { fullName: string | null } | null;
        };
      }>
    | undefined;
  familyNotes?.forEach((row) => {
    const fam = row.family;
    if (!fam?.id) return;
    const h = stripSlashesFromName(fam.husband?.fullName);
    const w = stripSlashesFromName(fam.wife?.fullName);
    const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || fam.xref || fam.id;
    out.push({ kind: "family", id: fam.id, label });
  });

  const eventNotes = note.eventNotes as
    | Array<{ event: { id: string; eventType: string; customType?: string | null } }>
    | undefined;
  eventNotes?.forEach((row) => {
    const ev = row.event;
    if (!ev?.id) return;
    const et = ev.customType?.trim() || ev.eventType;
    out.push({ kind: "event", id: ev.id, label: `Event: ${et}` });
  });

  const sourceNotes = note.sourceNotes as
    | Array<{ source: { id: string; title: string | null; xref: string } }>
    | undefined;
  sourceNotes?.forEach((row) => {
    const s = row.source;
    if (!s?.id) return;
    const label = s.title?.trim() || s.xref || s.id;
    out.push({ kind: "source", id: s.id, label });
  });

  return out;
}
