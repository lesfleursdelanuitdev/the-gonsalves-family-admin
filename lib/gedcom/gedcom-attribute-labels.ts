/** Human-readable labels for GEDCOM attribute type tags. */
export const GEDCOM_ATTRIBUTE_TYPE_LABELS: Record<string, string> = {
  CAST: "Caste",
  DSCR: "Physical description",
  EDUC: "Education",
  FACT: "Attribute",
  IDNO: "ID number",
  NATI: "Nationality",
  NMR: "Number of marriages",
  OCCU: "Occupation",
  PROP: "Property",
  RELI: "Religion",
  SSN: "Social security number",
  TITL: "Title",
};

/** Ordered list of standard individual attribute tags. */
export const INDIVIDUAL_ATTRIBUTE_TAG_LIST = [
  "CAST", "DSCR", "EDUC", "FACT", "IDNO", "NATI", "NMR",
  "OCCU", "PROP", "RELI", "SSN", "TITL",
] as const;

/** Tags where the user-visible type comes from the free-text TYPE sub-tag. */
export const ATTRIBUTE_CUSTOM_TYPE_TAGS = new Set(["FACT", "IDNO"]);

export function labelGedcomAttributeType(tag: string, customType?: string | null): string {
  if (tag === "FACT" && customType?.trim()) return customType.trim();
  return GEDCOM_ATTRIBUTE_TYPE_LABELS[tag] ?? tag;
}
