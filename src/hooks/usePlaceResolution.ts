"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson, deleteJson } from "@/lib/infra/api";
import type { PlaceResolutionScanSummary } from "@/lib/admin/place-resolution-scan";

const BASE_SUGGESTIONS = "/api/admin/place-resolution/suggestions";
const BASE_RESOLVED    = "/api/admin/place-resolution/resolved";
const BASE_LINKS       = "/api/admin/place-resolution/links";
const BASE_ALIASES     = "/api/admin/place-resolution/aliases";
const BASE_SCAN        = "/api/admin/place-resolution/scan";

export const SUGGESTIONS_QUERY_KEY    = ["place-resolution", "suggestions"] as const;
export const RESOLVED_QUERY_KEY       = ["place-resolution", "resolved"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GedcomPlaceSummary = {
  id: string;
  original: string;
  name: string | null;
  state: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  resolvedLink: {
    id: string;
    resolvedPlaceId: string;
    resolvedPlace?: { id: string; displayName: string };
  } | null;
};

export type SuggestionItem = {
  id: string;
  suggestionId: string;
  gedcomPlaceId: string;
  confidence: number;
  isPrimary: boolean;
  gedcomPlace: GedcomPlaceSummary & {
    _count?: {
      events: number;
      individualBirthPlaces: number;
      individualDeathPlaces: number;
      familyMarriagePlaces: number;
      familyDivorcePlaces: number;
      storyPlaces: number;
      mediaLinks: number;
    };
  };
};

export type SuggestionListItem = {
  id: string;
  fileUuid: string;
  status: string;
  matchReason: string;
  groupLabel: string;
  confidence: number;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  items: SuggestionItem[];
};

export type SuggestionDetail = SuggestionListItem;

export type ResolvedPlaceListItem = {
  id: string;
  displayName: string;
  name: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  geonamesId: number | null;
  wikidataId: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  _count: { links: number; aliases: number };
};

export type ResolvedPlaceAlias = {
  id: string;
  resolvedPlaceId: string;
  alias: string;
  aliasType: string;
  notes: string | null;
  createdAt: string;
};

export type ResolvedPlaceLink = {
  id: string;
  gedcomPlaceId: string;
  resolvedPlaceId: string;
  matchMethod: string;
  confidence: number;
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  gedcomPlace: GedcomPlaceSummary & {
    _count?: {
      events: number;
      individualBirthPlaces: number;
      individualDeathPlaces: number;
      familyMarriagePlaces: number;
      familyDivorcePlaces: number;
      storyPlaces: number;
      mediaLinks: number;
    };
  };
};

export type ResolvedPlaceDetail = ResolvedPlaceListItem & {
  aliases: ResolvedPlaceAlias[];
  links: ResolvedPlaceLink[];
};

// ── Suggestions ───────────────────────────────────────────────────────────────

export function useSuggestions(status = "pending") {
  return useQuery({
    queryKey: [...SUGGESTIONS_QUERY_KEY, status],
    queryFn: () =>
      fetchJson<{ suggestions: SuggestionListItem[]; total: number }>(
        `${BASE_SUGGESTIONS}?status=${status}&limit=200`,
      ),
  });
}

export function useSuggestion(id: string | null) {
  return useQuery({
    queryKey: [...SUGGESTIONS_QUERY_KEY, "detail", id],
    queryFn: () => fetchJson<{ suggestion: SuggestionDetail }>(`${BASE_SUGGESTIONS}/${id!}`),
    enabled: !!id,
  });
}

export function usePatchSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ignore" | "restore" }) =>
      patchJson(`${BASE_SUGGESTIONS}/${id}`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
    },
  });
}

// ── Scan ──────────────────────────────────────────────────────────────────────

export function useRunScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<PlaceResolutionScanSummary>(BASE_SCAN, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
    },
  });
}

// ── ResolvedPlaces ────────────────────────────────────────────────────────────

export function useResolvedPlaces(q?: string) {
  return useQuery({
    queryKey: [...RESOLVED_QUERY_KEY, q ?? ""],
    queryFn: () =>
      fetchJson<{ resolved: ResolvedPlaceListItem[]; total: number }>(
        `${BASE_RESOLVED}?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      ),
  });
}

export function useResolvedPlace(id: string | null) {
  return useQuery({
    queryKey: [...RESOLVED_QUERY_KEY, "detail", id],
    queryFn: () => fetchJson<{ resolved: ResolvedPlaceDetail }>(`${BASE_RESOLVED}/${id!}`),
    enabled: !!id,
  });
}

type CreateResolvedBody = {
  displayName: string;
  name?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  aliases?: { alias: string; aliasType?: string }[];
};

export function useCreateResolvedPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateResolvedBody) =>
      postJson<{ resolved: ResolvedPlaceListItem }>(BASE_RESOLVED, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
    },
  });
}

export function usePatchResolvedPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateResolvedBody> & { id: string; status?: string }) =>
      patchJson<{ resolved: ResolvedPlaceListItem }>(`${BASE_RESOLVED}/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...RESOLVED_QUERY_KEY, "detail", id] });
    },
  });
}

export function useDeleteResolvedPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE_RESOLVED}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
    },
  });
}

// ── Aliases ───────────────────────────────────────────────────────────────────

export function useCreateAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resolvedPlaceId, alias, aliasType, notes }: {
      resolvedPlaceId: string;
      alias: string;
      aliasType?: string;
      notes?: string;
    }) =>
      postJson<{ alias: ResolvedPlaceAlias }>(
        `${BASE_RESOLVED}/${resolvedPlaceId}/aliases`,
        { alias, aliasType, notes },
      ),
    onSuccess: (_data, { resolvedPlaceId }) => {
      qc.invalidateQueries({ queryKey: [...RESOLVED_QUERY_KEY, "detail", resolvedPlaceId] });
    },
  });
}

export function useDeleteAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; resolvedPlaceId: string }) =>
      deleteJson(`${BASE_ALIASES}/${id}`),
    onSuccess: (_data, { resolvedPlaceId }) => {
      qc.invalidateQueries({ queryKey: [...RESOLVED_QUERY_KEY, "detail", resolvedPlaceId] });
    },
  });
}

// ── Links ─────────────────────────────────────────────────────────────────────

export function useCreateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      gedcomPlaceId: string;
      resolvedPlaceId: string;
      matchMethod: string;
      confidence?: number;
      notes?: string;
    }) => postJson<{ link: ResolvedPlaceLink }>(BASE_LINKS, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
    },
  });
}

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE_LINKS}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
    },
  });
}

export function useBatchMoveLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { linkIds: string[]; targetResolvedPlaceId: string }) =>
      postJson<{ moved: number }>(`${BASE_LINKS}/batch-move`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: RESOLVED_QUERY_KEY });
    },
  });
}
