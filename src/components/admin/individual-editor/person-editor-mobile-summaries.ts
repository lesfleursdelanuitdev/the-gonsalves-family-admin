import type { KeyFactFormState, NameFormEditorRow, SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";

function sexLabel(sex: string): string {
  switch (sex) {
    case "M":
      return "Male";
    case "F":
      return "Female";
    case "U":
    case "":
      return "Unknown";
    case "X":
      return "Other";
    default:
      return "Unknown";
  }
}

/** Short "date · place" line for mobile summaries, timelines, and previews. */
export function formatKeyFactSummaryLine(f: KeyFactFormState): string {
  const date =
    f.dateOriginal?.trim() ||
    [f.y, f.m, f.d].filter((x) => String(x).trim()).join("-") ||
    "";
  const place = f.placeName?.trim() || f.placeOriginal?.trim() || "";
  if (!date && !place) return "Not added";
  if (date && place) return `${date} · ${place}`;
  return date || place;
}

function hasDeathContent(death: KeyFactFormState): boolean {
  return Boolean(
    death.dateOriginal?.trim() ||
      death.y?.trim() ||
      death.m?.trim() ||
      death.d?.trim() ||
      death.placeName?.trim() ||
      death.placeOriginal?.trim(),
  );
}

export function personEditorBasicSummary(args: {
  firstNames: string;
  lastName: string;
  sex: string;
  livingText: string;
}): string {
  const name = [args.firstNames.trim(), args.lastName.trim()].filter(Boolean).join(" ").trim() || "Name not set";
  return `${name} · ${sexLabel(args.sex)} · ${args.livingText}`;
}

export function personEditorNamesSummary(nameForms: NameFormEditorRow[]): string {
  const aliases = nameForms.filter((r) => r.role === "alias").length;
  if (aliases === 0) return "1 primary name";
  return `1 primary · ${aliases} alternate`;
}

export function personEditorLifeEventsSummary(birth: KeyFactFormState, death: KeyFactFormState): string {
  const b = formatKeyFactSummaryLine(birth);
  const d = hasDeathContent(death) ? formatKeyFactSummaryLine(death) : "Not added";
  return `Birth: ${b} · Death: ${d}`;
}

export function personEditorNotesSummary(count: number): string {
  if (count === 0) return "No notes added yet";
  return `${count} note${count === 1 ? "" : "s"}`;
}

export function personEditorMediaSummary(count: number): string {
  if (count === 0) return "No media added yet";
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function personEditorSourcesSummary(count: number): string {
  if (count === 0) return "No sources added yet";
  return `${count} source${count === 1 ? "" : "s"}`;
}

export function personEditorAssociatesSummary(count: number): string {
  if (count === 0) return "No associates";
  return `${count} associate${count === 1 ? "" : "s"}`;
}

/**
 * Unique children linked under spouse/partner families (from loaded lists + unsaved pending rows).
 * Excludes the edited person when they appear as the “this person” row in a child list.
 */
export function countChildrenAcrossSpouseFamilies(
  familiesAsSpouse: SpouseFamilyFormRow[],
  subjectIndividualId: string,
): number {
  const subject = subjectIndividualId.trim();
  const seen = new Set<string>();
  for (const row of familiesAsSpouse) {
    for (const ch of row.childrenInFamily ?? []) {
      const id = ch.individualId.trim();
      if (!id || id === subject) continue;
      seen.add(id);
    }
    for (const pch of row.pendingSpouseFamilyChildren ?? []) {
      if (pch.kind === "existing") {
        const id = pch.childIndividualId.trim();
        if (!id || id === subject) continue;
        seen.add(id);
      }
    }
  }
  let pendingNew = 0;
  for (const row of familiesAsSpouse) {
    for (const pch of row.pendingSpouseFamilyChildren ?? []) {
      if (pch.kind === "new") pendingNew += 1;
    }
  }
  return seen.size + pendingNew;
}

export function personEditorRelationshipsSummary(
  parentRows: number,
  partnerFamilies: number,
  childCount: number,
): string {
  if (parentRows === 0 && partnerFamilies === 0 && childCount === 0) {
    return "Parents, partners, and children";
  }
  const childPart = `${childCount} child${childCount === 1 ? "" : "ren"}`;
  return `${parentRows} parent link${parentRows === 1 ? "" : "s"} · ${partnerFamilies} partner · ${childPart}`;
}
