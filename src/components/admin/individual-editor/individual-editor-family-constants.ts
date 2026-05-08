export const RELATIONSHIP_OPTIONS = [
  { value: "biological", label: "Biological" },
  { value: "adopted", label: "Adoptive" },
  { value: "foster", label: "Foster" },
  { value: "step", label: "Step" },
  { value: "guardian", label: "Guardian" },
  { value: "sealing", label: "Sealing" },
  { value: "other", label: "Other" },
];

/** Stored on `GedcomParentChild.pedigree` (text); values are normalized lowercase for consistency. */
export const PEDIGREE_OPTIONS = [
  { value: "", label: "—" },
  { value: "birth", label: "Birth" },
  { value: "adopted", label: "Adopted" },
  { value: "foster", label: "Foster" },
  { value: "sealing", label: "Sealing" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const NEW_PARENT_SEX_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select sex…" },
  { value: "M", label: "Male (M)" },
  { value: "F", label: "Female (F)" },
  { value: "U", label: "Unknown (U)" },
  { value: "X", label: "Other (X)" },
];
