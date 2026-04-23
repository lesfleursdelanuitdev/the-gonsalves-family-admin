/**
 * GEDCOM stores two spouse pointers as husband (HUSB) and wife (WIFE). In the admin UI we label those
 * columns Partner 1 and Partner 2 so the product language stays neutral while still mapping 1:1 to storage.
 */

export const FAMILY_PARTNER_1_LABEL = "Partner 1";
export const FAMILY_PARTNER_2_LABEL = "Partner 2";

/** Short line for card titles / table context */
export const FAMILY_PARTNER_SLOT_SUBTITLE =
  "Partner 1 = GEDCOM husband (HUSB); Partner 2 = GEDCOM wife (WIFE).";

/** How the tree chooses HUSB vs WIFE when linking parents (documented behavior for editors). */
export const FAMILY_PARTNER_ASSIGNMENT_RULES: readonly string[] = [
  "If one partner is male and the other is female, the male is stored in the husband (HUSB) column and the female in the wife (WIFE) column.",
  "If one partner is unknown/other (not M or F) and the other is female, unknown/other is stored in HUSB and the female in WIFE.",
  "If one partner is unknown/other and the other is male, unknown/other is stored in WIFE and the male in HUSB.",
  "If both partners are the same sex or both are unknown/other, the first person linked is stored in HUSB and the second in WIFE.",
];

/** Filter panel / search helper: P1/P2 align to DB columns (not symmetric name search). */
export const FAMILY_LIST_FILTER_PARTNER_COLUMNS_HELP =
  `${FAMILY_PARTNER_1_LABEL} filters match the person in the GEDCOM husband (HUSB) column; ${FAMILY_PARTNER_2_LABEL} filters match the person in the wife (WIFE) column. When both have criteria, a family must match both columns.`;

/** Same column semantics as the families list filters, without repeating the one-line slot summary. */
export const FAMILY_NAME_FILTER_COLUMNS_HELP =
  `${FAMILY_PARTNER_1_LABEL} matches the GEDCOM husband (HUSB) column and ${FAMILY_PARTNER_2_LABEL} the wife (WIFE) column; when both have criteria, both columns must match.`;
