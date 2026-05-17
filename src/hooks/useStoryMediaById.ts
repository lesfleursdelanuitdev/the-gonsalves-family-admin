"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type { StoryCoverMediaKind } from "@/lib/admin/story-creator/story-types";

export type StoryMediaDetail = {
  id: string;
  title: string | null;
  description: string | null;
  fileRef: string | null;
  form: string | null;
};

/** GET `/api/admin/media/[id]` returns `{ media }`, not a bare row. */
type AdminMediaDetailResponse = { media: StoryMediaDetail };

function endpointForMediaKind(mediaId: string, mediaKind: StoryCoverMediaKind): string {
  if (mediaKind === "site_media") return `/api/admin/site-media/${mediaId}`;
  if (mediaKind === "user_media") return `/api/admin/user-media/${mediaId}`;
  return `/api/admin/media/${mediaId}`;
}

async function fetchStoryMediaDetail(mediaId: string, mediaKind?: StoryCoverMediaKind): Promise<StoryMediaDetail> {
  if (mediaKind) {
    const res = await fetchJson<AdminMediaDetailResponse>(endpointForMediaKind(mediaId, mediaKind));
    return res.media;
  }
  // Story media blocks may reference family-tree, site, or user media.
  // Resolve by trying each scoped detail endpoint in order.
  const endpoints = [`/api/admin/media/${mediaId}`, `/api/admin/site-media/${mediaId}`, `/api/admin/user-media/${mediaId}`];
  for (const endpoint of endpoints) {
    try {
      const res = await fetchJson<AdminMediaDetailResponse>(endpoint);
      return res.media;
    } catch {
      // try next scope
    }
  }
  throw new Error("Media not found in any admin scope");
}

function storyMediaQueryOptions(mediaId: string | undefined, mediaKind?: StoryCoverMediaKind) {
  return {
    queryKey: ["admin-story-media", mediaKind ?? "any", mediaId],
    queryFn: () => fetchStoryMediaDetail(mediaId!, mediaKind),
    enabled: !!mediaId,
    staleTime: 60_000,
  };
}

export function useStoryMediaById(mediaId: string | undefined, mediaKind?: StoryCoverMediaKind) {
  return useQuery(storyMediaQueryOptions(mediaId, mediaKind));
}

export function useStoryMediaByIds(mediaIds: string[]) {
  const results = useQueries({
    queries: mediaIds.map((mediaId) => storyMediaQueryOptions(mediaId)),
  });

  return useMemo(() => {
    const byId = new Map<string, StoryMediaDetail>();
    results.forEach((result, index) => {
      const mediaId = mediaIds[index];
      if (mediaId && result.data) byId.set(mediaId, result.data);
    });
    return byId;
  }, [mediaIds, results]);
}
