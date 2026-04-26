import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";

export function spouseFamilyChildSearchExcludes(
  row: SpouseFamilyFormRow,
  editIndividualId: string | undefined,
  mode: "create" | "edit",
): Set<string> {
  const ids = new Set<string>();
  if (mode === "edit" && editIndividualId) ids.add(editIndividualId);
  if (row.husbandId) ids.add(row.husbandId);
  if (row.wifeId) ids.add(row.wifeId);
  for (const ch of row.childrenInFamily ?? []) ids.add(ch.individualId);
  for (const p of row.pendingSpouseFamilyChildren ?? []) {
    if (p.kind === "existing") ids.add(p.childIndividualId);
  }
  return ids;
}
