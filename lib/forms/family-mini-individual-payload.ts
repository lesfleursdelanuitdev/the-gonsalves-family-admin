import { keyFactToApiValue, type KeyFactFormState } from "@/lib/forms/individual-editor-form";

export type MiniIndividualFields = {
  givenNamesLine: string;
  surnameLine: string;
  sex: string;
  birth: KeyFactFormState;
  death: KeyFactFormState;
};

/**
 * Turn `/Foo/Bar/` or `Foo/Bar` into separate surname payload rows (GEDCOM-style slashes).
 * Plain text is trimmed; outer slashes are stripped when there is no inner `/`.
 */
export function surnameLineToPayloadRows(surnameLine: string): { text: string; pieceType: null }[] {
  const t = surnameLine.trim();
  if (!t) return [];
  if (t.includes("/")) {
    return t
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text, pieceType: null }));
  }
  const single = t.replace(/^\/+|\/+$/g, "").trim();
  return single ? [{ text: single, pieceType: null }] : [];
}

function parseGivenNames(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

/** Body for `createParentAndAdd` / `createChildAndAdd` (parsed by `parseIndividualEditorPayload`). */
export function buildMiniIndividualEditorBody(f: MiniIndividualFields): Record<string, unknown> {
  const givens = parseGivenNames(f.givenNamesLine);
  const surnameRows = surnameLineToPayloadRows(f.surnameLine);
  const birthVal = keyFactToApiValue(f.birth);
  const deathVal = keyFactToApiValue(f.death);
  const sexUpper = f.sex.trim().toUpperCase();
  const sex =
    sexUpper === "M" || sexUpper === "F" || sexUpper === "U" || sexUpper === "X" ? sexUpper : null;

  return {
    sex,
    names: {
      givenNames: givens.length ? givens : [""],
      surnames: surnameRows,
    },
    ...(birthVal === null ? {} : { birth: birthVal }),
    ...(deathVal === null ? {} : { death: deathVal }),
    livingMode: "auto",
  };
}
