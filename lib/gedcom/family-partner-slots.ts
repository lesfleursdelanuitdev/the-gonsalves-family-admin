/**
 * Partner slots: two fixed positions on each family (Partner 1 and Partner 2).
 * User-facing copy avoids legacy interchange tags; ordering rules are described in plain language.
 */

export const FAMILY_PARTNER_1_LABEL = "Partner 1";
export const FAMILY_PARTNER_2_LABEL = "Partner 2";

/** Short line for page intros / collapsible help */
export const FAMILY_PARTNER_SLOT_SUBTITLE =
  "Each family has two partner positions. They only set display and search order—not social or legal roles.";

/** One-line hints under partner headings on detail pages */
export const FAMILY_PARTNER_1_SLOT_HINT = "First partner field on this family";
export const FAMILY_PARTNER_2_SLOT_HINT = "Second partner field on this family";

/** How the tree orders partners when linking (user-facing). */
export const FAMILY_PARTNER_ASSIGNMENT_RULES: readonly string[] = [
  "If one partner is recorded as male and the other as female, the male is listed as Partner 1 and the female as Partner 2.",
  "If one partner’s sex is not simply male or female and the other is female, that first partner is listed as Partner 1 and the female as Partner 2.",
  "If one partner’s sex is not simply male or female and the other is male, the male is listed as Partner 1 and the other as Partner 2.",
  "If both have the same sex recorded or both are unknown/other, the first person you link becomes Partner 1 and the second Partner 2.",
];

/** Filter panel: P1/P2 are asymmetric (first vs second field), not “either name”. */
export const FAMILY_LIST_FILTER_PARTNER_COLUMNS_HELP =
  `${FAMILY_PARTNER_1_LABEL} filters match the first partner on the family; ${FAMILY_PARTNER_2_LABEL} filters match the second. When both have criteria, both must match.`;

/** Family search by two parents’ names (same column semantics as list filters). */
export const FAMILY_NAME_FILTER_COLUMNS_HELP =
  `${FAMILY_PARTNER_1_LABEL} matches the first partner field and ${FAMILY_PARTNER_2_LABEL} the second; when both have text, both must match.`;

/** Shared placeholder for last-name prefix fields that honor slash-separated surnames */
export const ADMIN_LAST_NAME_PREFIX_PLACEHOLDER = "Surname prefix (slashes supported)";
