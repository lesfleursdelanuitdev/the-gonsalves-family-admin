/**
 * Max records returned by admin list APIs when loading "all" data (single request, no pagination).
 * Used by admin list pages so the UI fetches the full dataset in one request.
 */
export const ADMIN_LIST_MAX_LIMIT = 10_000;

/** Client-side pagination on the admin individual detail page */
export const INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE = 5;
export const INDIVIDUAL_DETAIL_FAMILY_CHILDREN_PAGE_SIZE = 5;

/** Client-side pagination on the admin family detail page */
export const FAMILY_DETAIL_EVENTS_PAGE_SIZE = 5;
export const FAMILY_DETAIL_CHILDREN_PAGE_SIZE = 5;
