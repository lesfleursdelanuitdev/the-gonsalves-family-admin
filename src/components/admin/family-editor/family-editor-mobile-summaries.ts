import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { formatKeyFactSummaryLine } from "@/components/admin/individual-editor/person-editor-mobile-summaries";
import type { FamilyEditChildRow, FamilyEditPartner } from "@/components/admin/family-editor/family-editor-types";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export function familyEditorPartnersSummary(husband: FamilyEditPartner, wife: FamilyEditPartner): string {
  const a = husband ? stripSlashesFromName(husband.fullName) || "Partner" : null;
  const b = wife ? stripSlashesFromName(wife.fullName) || "Partner" : null;
  if (a && b) return `${a} · ${b}`;
  if (a) return `${a} · Add second partner`;
  if (b) return `${b} · Add second partner`;
  return "Add partners to this relationship";
}

export function familyEditorTimelineSummary(marriage: KeyFactFormState, divorce: KeyFactFormState): string {
  const m = formatKeyFactSummaryLine(marriage);
  const d = formatKeyFactSummaryLine(divorce);
  return `Marriage: ${m} · Divorce: ${d}`;
}

export function familyEditorChildrenSummary(rows: FamilyEditChildRow[]): string {
  const n = rows.filter((r) => r.child?.id).length;
  if (n === 0) return "No children added yet";
  return `${n} child${n === 1 ? "" : "ren"}`;
}

export function familyEditorNotesSummary(count: number): string {
  if (count === 0) return "No notes added yet";
  return `${count} note${count === 1 ? "" : "s"}`;
}

export function familyEditorMediaSummary(count: number): string {
  if (count === 0) return "No media added yet";
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function familyEditorSourcesSummary(count: number): string {
  if (count === 0) return "No sources added yet";
  return `${count} source${count === 1 ? "" : "s"}`;
}
