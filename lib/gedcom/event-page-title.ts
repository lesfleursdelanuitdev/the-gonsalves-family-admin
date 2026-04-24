import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "./display-name";
import { labelGedcomEventType } from "./gedcom-event-labels";

/** GEDCOM tag line for headings (matches list / media picker). */
export function eventTypeHeadline(eventType: string, customType: string | null | undefined): string {
  const et = (eventType ?? "").toUpperCase().trim();
  const base = labelGedcomEventType(eventType);
  const custom =
    et === "EVEN" && customType?.trim() ? ` (${customType.trim()})` : "";
  return base + custom;
}

type NameFormsArg = Parameters<typeof formatDisplayNameFromNameForms>[0];

function individualRecordDisplayName(ind: Record<string, unknown>): string | null {
  const fullName = ind.fullName as string | null | undefined;
  const xref = (ind.xref as string | undefined)?.trim();
  const id = (ind.id as string | undefined)?.trim();
  const forms = ind.individualNameForms as NameFormsArg | undefined;
  const dn =
    formatDisplayNameFromNameForms(forms, fullName ?? null) ||
    stripSlashesFromName(fullName) ||
    "";
  const s = (dn || xref || id || "").trim();
  return s || null;
}

function familyRecordSpousePairLine(fam: Record<string, unknown>): string | null {
  const h = fam.husband as { fullName?: string | null; xref?: string | null } | null | undefined;
  const w = fam.wife as { fullName?: string | null; xref?: string | null } | null | undefined;
  const x = h ? stripSlashesFromName(h.fullName ?? "") || (h.xref?.trim() ?? null) || null : null;
  const y = w ? stripSlashesFromName(w.fullName ?? "") || (w.xref?.trim() ?? null) || null : null;
  if (x && y) return `${x} and ${y}`;
  if (x) return x;
  if (y) return y;
  return null;
}

function familyPairFromLinkLabel(label: string): string | null {
  const t = label.trim();
  if (!t) return null;
  return t.replace(/\s*&\s*/g, " and ").trim() || null;
}

/**
 * One-line title for event view/edit: **family** spouse pair when linked to a family (e.g. MARR),
 * else **individual** principal (e.g. BIRT). Uses link chips when `selectedLinks` is provided
 * (including `[]` so cleared links do not fall back to stale API rows).
 */
export function eventPageDisplayTitle(args: {
  eventType: string;
  customType?: string | null;
  individualEvents?: Array<{ individual: Record<string, unknown> }> | null;
  familyEvents?: Array<{ family: Record<string, unknown> }> | null;
  selectedLinks?: SelectedNoteLink[] | null;
}): string {
  const head = eventTypeHeadline(args.eventType, args.customType);
  const famRows = args.familyEvents ?? [];
  const indRows = args.individualEvents ?? [];
  const linksExplicit = args.selectedLinks !== undefined && args.selectedLinks !== null;
  const links = args.selectedLinks ?? [];

  const famLink = links.find((l) => l.kind === "family");
  const indLink = links.find((l) => l.kind === "individual");

  let famRow: (typeof famRows)[0] | undefined;
  if (!linksExplicit) {
    famRow = famRows[0];
  } else if (famLink) {
    famRow = famRows.find((r) => (r.family as Record<string, unknown>).id === famLink.id);
  }

  if (famRow) {
    const pair = familyRecordSpousePairLine(famRow.family as Record<string, unknown>);
    if (pair) return `${head} of ${pair}`;
  }
  if (famLink?.label) {
    const fromChip = familyPairFromLinkLabel(famLink.label);
    if (fromChip) return `${head} of ${fromChip}`;
  }

  let indRow: (typeof indRows)[0] | undefined;
  if (!linksExplicit) {
    indRow = indRows[0];
  } else if (indLink) {
    indRow = indRows.find((r) => (r.individual as Record<string, unknown>).id === indLink.id);
  }

  if (indRow) {
    const who = individualRecordDisplayName(indRow.individual as Record<string, unknown>);
    if (who) return `${head} of ${who}`;
  }
  if (indLink?.label?.trim()) return `${head} of ${indLink.label.trim()}`;

  return head;
}
