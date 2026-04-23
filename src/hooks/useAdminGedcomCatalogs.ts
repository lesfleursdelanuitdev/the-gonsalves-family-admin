"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface CatalogListOpts {
  q?: string;
  limit?: number;
  offset?: number;
}

function buildCatalogParams(opts: CatalogListOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return params;
}

/** List item shape from GET /api/admin/places (JSON). */
export type AdminPlaceListItem = {
  id: string;
  original: string;
  name: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: unknown;
  longitude: unknown;
};

export interface AdminPlacesListResponse {
  places: AdminPlaceListItem[];
  total: number;
  hasMore: boolean;
}

const placesHooks = createAdminCrudHooks<CatalogListOpts, AdminPlacesListResponse>({
  base: "/api/admin/places",
  queryKey: ["admin", "places"],
  buildParams: buildCatalogParams,
});

export const useAdminPlaces = placesHooks.useList;
export const useAdminPlace = (id: string) =>
  placesHooks.useDetail<{ place: AdminPlaceDetail }>(id);

export type AdminPlaceDetail = AdminPlaceListItem & {
  hash: string;
  createdAt: string;
  _count: {
    events: number;
    individualBirthPlaces: number;
    individualDeathPlaces: number;
    familyMarriagePlaces: number;
    familyDivorcePlaces: number;
  };
};

export type AdminDateListItem = {
  id: string;
  original: string | null;
  dateType: string;
  calendar: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
};

export interface AdminDatesListResponse {
  dates: AdminDateListItem[];
  total: number;
  hasMore: boolean;
}

const datesHooks = createAdminCrudHooks<CatalogListOpts, AdminDatesListResponse>({
  base: "/api/admin/dates",
  queryKey: ["admin", "dates"],
  buildParams: buildCatalogParams,
});

export const useAdminDates = datesHooks.useList;
export const useAdminDate = (id: string) =>
  datesHooks.useDetail<{ date: AdminDateDetail }>(id);

export type AdminDateDetail = AdminDateListItem & {
  hash: string;
  createdAt: string;
  _count: {
    events: number;
    individualBirthDates: number;
    individualDeathDates: number;
    familyMarriageDates: number;
    familyDivorceDates: number;
  };
};

export type AdminGivenNameListItem = {
  id: string;
  givenName: string;
  givenNameLower: string;
  frequency: number;
};

export interface AdminGivenNamesListResponse {
  givenNames: AdminGivenNameListItem[];
  total: number;
  hasMore: boolean;
}

const givenNamesHooks = createAdminCrudHooks<CatalogListOpts, AdminGivenNamesListResponse>({
  base: "/api/admin/given-names",
  queryKey: ["admin", "given-names"],
  buildParams: buildCatalogParams,
});

export const useAdminGivenNames = givenNamesHooks.useList;
export const useAdminGivenName = (id: string) =>
  givenNamesHooks.useDetail<{ givenName: AdminGivenNameDetail }>(id);

export type AdminGivenNameDetail = AdminGivenNameListItem & {
  createdAt: string;
  _count: { nameFormGivenNames: number };
};

export type AdminSurnameListItem = {
  id: string;
  surname: string;
  surnameLower: string;
  soundex: string | null;
  metaphone: string | null;
  frequency: number;
};

export interface AdminSurnamesListResponse {
  surnames: AdminSurnameListItem[];
  total: number;
  hasMore: boolean;
}

const surnamesHooks = createAdminCrudHooks<CatalogListOpts, AdminSurnamesListResponse>({
  base: "/api/admin/surnames",
  queryKey: ["admin", "surnames"],
  buildParams: buildCatalogParams,
});

export const useAdminSurnames = surnamesHooks.useList;
export const useAdminSurname = (id: string) =>
  surnamesHooks.useDetail<{ surname: AdminSurnameDetail }>(id);

export type AdminSurnameDetail = AdminSurnameListItem & {
  createdAt: string;
  _count: { nameFormSurnames: number; familySurnames: number };
};
