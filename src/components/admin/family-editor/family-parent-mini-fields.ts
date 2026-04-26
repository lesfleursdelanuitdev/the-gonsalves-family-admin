const MINI_PARENT_SEX_VALUES = new Set(["M", "F", "U", "X"]);

export function isMiniParentSexChosen(sex: string): boolean {
  return MINI_PARENT_SEX_VALUES.has(sex.trim().toUpperCase());
}
