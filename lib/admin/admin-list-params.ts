import { ADMIN_LIST_MAX_LIMIT } from "@/lib/infra/admin-tree";

/**
 * Parse and clamp `limit` and `offset` from request search params.
 * Shared by all admin list GET handlers.
 */
export function parseListParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(
    ADMIN_LIST_MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(ADMIN_LIST_MAX_LIMIT), 10) ||
        ADMIN_LIST_MAX_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
  );
  return { limit, offset };
}
