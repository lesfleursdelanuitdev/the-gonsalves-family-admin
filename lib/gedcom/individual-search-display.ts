import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "./display-name";

type NameFormsArg = Parameters<typeof formatDisplayNameFromNameForms>[0];

/** API / Prisma use numeric years; tolerate string from older payloads. */
function individualListYearDisplay(y: number | string | null | undefined): string {
  if (y == null) return "";
  if (typeof y === "number") return Number.isFinite(y) ? String(Math.trunc(y)) : "";
  return y.trim();
}

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
  const b = individualListYearDisplay(ind.birthYear);
  const d = individualListYearDisplay(ind.deathYear);
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
