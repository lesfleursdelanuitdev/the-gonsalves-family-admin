/** Values must match Prisma `GedcomDateType`. */
export const GEDCOM_DATE_SPECIFIER_OPTIONS: { value: string; label: string }[] = [
  { value: "EXACT", label: "Exact" },
  { value: "ABOUT", label: "About" },
  { value: "BEFORE", label: "Before" },
  { value: "AFTER", label: "After" },
  { value: "BETWEEN", label: "Between" },
  { value: "FROM_TO", label: "From / To" },
  { value: "CALCULATED", label: "Calculated" },
  { value: "ESTIMATED", label: "Estimated" },
  { value: "UNKNOWN", label: "Unknown" },
];

/** Show end date (range) fields for these types. */
export function gedcomDateSpecifierNeedsRange(dateType: string): boolean {
  return dateType === "BETWEEN" || dateType === "FROM_TO";
}
