import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "./display-name";

type NameFormsArg = Parameters<typeof formatDisplayNameFromNameForms>[0];

/** Primary display line: structured given + surnames, else stripped fullName, else xref/id. */
export function individualSearchDisplayName(ind: AdminIndividualListItem): string {
  return (
    formatDisplayNameFromNameForms(ind.individualNameForms as NameFormsArg, ind.fullName) ||
    stripSlashesFromName(ind.fullName) ||
    ind.xref?.trim() ||
    ind.id
  );
}

/** Compact life span from denormalized years when present. */
export function individualSearchLifeSpan(ind: AdminIndividualListItem): string {
  const b = ind.birthYear?.trim();
  const d = ind.deathYear?.trim();
  if (b && d) return `b. ${b} – d. ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return "";
}

/** Second line: XREF plus life span for picker rows. */
export function individualSearchMetaLine(ind: AdminIndividualListItem): string {
  const xr = ind.xref?.trim();
  const life = individualSearchLifeSpan(ind);
  const parts: string[] = [];
  if (xr) parts.push(xr);
  if (life) parts.push(life);
  return parts.join(" · ");
}
