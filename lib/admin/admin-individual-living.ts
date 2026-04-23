/**
 * Derives GedcomIndividual.isLiving per INDIVIDUAL_EDIT_FORM_PLAN.md §5.3.
 */

export type LivingMode = "auto" | "living" | "deceased";

export function deathKnownFromIndividualSnapshot(input: {
  deathDateId: string | null | undefined;
  deathYear: number | null | undefined;
}): boolean {
  if (input.deathDateId) return true;
  if (input.deathYear != null && Number.isFinite(input.deathYear)) return true;
  return false;
}

function utcTodayParts(): { y: number; m: number; d: number } {
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

/** Completed years between calendar birth and ref (birthday not yet this year => subtract 1). */
function ageCompletedYears(
  birthY: number,
  birthM: number,
  birthD: number,
  refY: number,
  refM: number,
  refD: number,
): number {
  let age = refY - birthY;
  if (refM < birthM || (refM === birthM && refD < birthD)) age -= 1;
  return age;
}

/**
 * When livingMode is not "auto", returns that boolean.
 * Otherwise applies death signal, then 120-year rule from birth Y/M/D (nullable).
 */
export function computeIsLiving(input: {
  livingMode: LivingMode;
  deathKnown: boolean;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
}): boolean {
  if (input.livingMode === "living") return true;
  if (input.livingMode === "deceased") return false;
  if (input.deathKnown) return false;

  const Y = input.birthYear;
  const M = input.birthMonth;
  const D = input.birthDay;
  const { y: ry, m: rm, d: rd } = utcTodayParts();

  if (Y == null || !Number.isFinite(Y)) return true;

  if (M != null && D != null && Number.isFinite(M) && Number.isFinite(D)) {
    return ageCompletedYears(Y, M, D, ry, rm, rd) < 120;
  }
  if (M != null && Number.isFinite(M)) {
    return ageCompletedYears(Y, M, 1, ry, rm, rd) < 120;
  }
  return ry - Y < 120;
}
