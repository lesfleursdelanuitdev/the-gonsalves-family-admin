/**
 * GEDCOM-aware name search: parse query and build conditions for
 * "first name + surname prefix" matching. Surnames in GEDCOM are in slashes (e.g. "Monica /Rodrigues/").
 */

/** Escape regex special chars so the string is treated as literal in PostgreSQL regex. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build PostgreSQL regex pattern for "GEDCOM surname (token between slashes) starts with input".
 * full_name is like "John /Reyes/"; we match "/" + prefix so "R" matches Reyes, Rodrigues.
 */
export function surnamePrefixRegexPattern(lastNameInput: string): string {
  const prefix = escapeRegex(lastNameInput.trim().toLowerCase());
  return "\\/" + prefix;
}

/** Escape % and _ for safe use inside a LIKE pattern (user input is the literal part). */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export interface ParsedNameQuery {
  /** First token (given name prefix), lowercased. */
  firstToken: string;
  /** Rest of tokens joined (surname prefix), lowercased; empty if single token. */
  surnamePrefix: string;
  /** Whether there are multiple tokens (given + surname). */
  hasSurname: boolean;
}

/**
 * Parse a single search query into first token and optional surname prefix.
 * e.g. "Monica R" → { firstToken: "monica", surnamePrefix: "r", hasSurname: true }
 *      "Rodrigues" → { firstToken: "rodrigues", surnamePrefix: "", hasSurname: false }
 */
export function parseNameQuery(q: string): ParsedNameQuery | null {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const firstToken = tokens[0];
  const surnamePrefix = tokens.slice(1).join(" ");
  return {
    firstToken,
    surnamePrefix,
    hasSurname: tokens.length > 1,
  };
}
