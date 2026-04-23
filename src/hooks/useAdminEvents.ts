"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

/** GET /api/admin/events list item shape (matches Prisma include in route). */
export interface AdminEventListItem {
  id: string;
  eventType: string;
  customType?: string | null;
  date: { original?: string | null; year?: number | null; month?: number | null; day?: number | null } | null;
  place: { original?: string | null; name?: string | null } | null;
  individualEvents: Array<{
    individual: {
      id: string;
      fullName: string | null;
      individualNameForms?: Array<{
        givenNames: Array<{ givenName: { givenName: string } }>;
        surnames: Array<{ surname: { surname: string } }>;
      }>;
    };
  }>;
  familyEvents: Array<{
    family: {
      id: string;
      xref: string;
      husband: { id: string; fullName: string | null } | null;
      wife: { id: string; fullName: string | null } | null;
    };
  }>;
}

export interface AdminEventsListResponse {
  events: AdminEventListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminEventsOpts {
  q?: string;
  /** GEDCOM event tag, e.g. BIRT (also sent as legacy `type` for older clients). */
  eventType?: string;
  type?: string;
  limit?: number;
  offset?: number;
  placeContains?: string;
  dateYearMin?: string;
  dateYearMax?: string;
  linkType?: "individual" | "family";
  linkedGiven?: string;
  linkedLast?: string;
  /** When `linkType` is `family`, partner name filters (same as families list API). */
  p1Given?: string;
  p1Last?: string;
  p2Given?: string;
  p2Last?: string;
  /** When `linkType` is `family`, match if either spouse matches (slash-aware last name). */
  familyPartnerGiven?: string;
  familyPartnerLast?: string;
}

function buildEventsParams(opts: UseAdminEventsOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  const et = opts.eventType || opts.type;
  if (et) params.set("eventType", et);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.placeContains) params.set("placeContains", opts.placeContains);
  if (opts.dateYearMin) params.set("dateYearMin", opts.dateYearMin);
  if (opts.dateYearMax) params.set("dateYearMax", opts.dateYearMax);
  if (opts.linkType === "individual" || opts.linkType === "family") {
    params.set("linkType", opts.linkType);
  }
  if (opts.linkedGiven) params.set("linkedGiven", opts.linkedGiven);
  if (opts.linkedLast) params.set("linkedLast", opts.linkedLast);
  if (opts.p1Given) params.set("p1Given", opts.p1Given);
  if (opts.p1Last) params.set("p1Last", opts.p1Last);
  if (opts.p2Given) params.set("p2Given", opts.p2Given);
  if (opts.p2Last) params.set("p2Last", opts.p2Last);
  if (opts.familyPartnerGiven) params.set("familyPartnerGiven", opts.familyPartnerGiven);
  if (opts.familyPartnerLast) params.set("familyPartnerLast", opts.familyPartnerLast);
  return params;
}

const eventsHooks = createAdminCrudHooks<UseAdminEventsOpts, AdminEventsListResponse>({
  base: "/api/admin/events",
  queryKey: ["admin", "events"],
  buildParams: buildEventsParams,
});

export const useAdminEvents = eventsHooks.useList;
export const useAdminEvent = (id: string) => eventsHooks.useDetail<{ event: unknown }>(id);
export const useCreateEvent = eventsHooks.useCreate;
export const useUpdateEvent = eventsHooks.useUpdate;
export const useDeleteEvent = eventsHooks.useDelete;
