/**
 * Canonical tag label for UI: trimmed, lowercase (ASCII).
 * Storage and API payloads may keep mixed case; render with this everywhere tags are shown.
 */
export function displayTagName(name: string): string {
  return name.trim().toLowerCase();
}
