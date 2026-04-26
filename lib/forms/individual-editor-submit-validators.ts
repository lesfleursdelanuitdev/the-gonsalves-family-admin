import type { IndividualEditorFormSeed } from "@/lib/forms/individual-editor-form";

function hasAtLeastOneName(seed: IndividualEditorFormSeed): boolean {
  return seed.nameForms.some(
    (nf) => nf.givenNames.some((g) => g.trim()) || nf.surnames.some((r) => r.text.trim()),
  );
}

function isSupportedGedcomSex(raw: string): boolean {
  const u = raw.trim().toUpperCase();
  return u === "M" || u === "F" || u === "U" || u === "X";
}

/**
 * Returns a user-facing validation message; null means submit can proceed.
 * Mirrors legacy IndividualEditForm pre-submit guards.
 */
export function validateIndividualEditorSubmitSeed(seed: IndividualEditorFormSeed): string | null {
  if (!hasAtLeastOneName(seed)) {
    return "Add at least one given or last name before saving.";
  }

  for (const row of seed.familiesAsSpouse) {
    if (!row.newFamilyNewPartner) continue;
    const g = row.newFamilyNewPartner.givenNames.trim();
    const sur = row.newFamilyNewPartner.surname.trim();
    const tokens = g.split(/\s+/).filter(Boolean);
    if (!g && !sur) continue;
    if (tokens.length === 0 || !sur) {
      return "New family with a new person: enter given names and a last name, or clear the row.";
    }
  }

  for (const row of seed.familiesAsChild) {
    if (!row.pendingNewParents) continue;
    const draft = row.pendingNewParents;
    const g1 = draft.parent1.givenNames.trim();
    const g2 = draft.parent2.givenNames.trim();
    const s1 = draft.parent1.surname.trim();
    const s2 = draft.parent2.surname.trim();
    const any = g1 || s1 || draft.parent1.sex.trim() || g2 || s2 || draft.parent2.sex.trim();
    if (!any) continue;
    const t1 = g1.split(/\s+/).filter(Boolean);
    const t2 = g2.split(/\s+/).filter(Boolean);
    if (t1.length === 0 || !s1 || !isSupportedGedcomSex(draft.parent1.sex)) {
      return "Add parents - create new people: complete parent 1 (given names, last name, and sex), or remove the row.";
    }
    if (t2.length === 0 || !s2 || !isSupportedGedcomSex(draft.parent2.sex)) {
      return "Add parents - create new people: complete parent 2 (given names, last name, and sex), or remove the row.";
    }
  }

  for (const row of seed.familiesAsSpouse) {
    for (const child of row.pendingSpouseFamilyChildren ?? []) {
      if (child.kind !== "new") continue;
      const tokens = child.givenNames.trim().split(/\s+/).filter(Boolean);
      const sur = child.surname.trim();
      const sx = child.sex.trim();
      const isEmpty = tokens.length === 0 && !sur && !sx;
      if (isEmpty) {
        return 'Remove empty "add child - new person" rows or fill in given names, last name, and sex.';
      }
      if (tokens.length === 0 || !sur || !isSupportedGedcomSex(sx)) {
        return "Add child - new person: complete given names, last name, and sex for each new child row, or remove it.";
      }
    }
  }

  return null;
}
