/**
 * Normalizes `useParams().id` for App Router `[id]` segments.
 * Next may surface `id` as `string` or `string[]` depending on routing.
 */
export function routeDynamicId(params: { id?: string | string[] } | null | undefined): string {
  const raw = params?.id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) return raw[0].trim();
  return "";
}
