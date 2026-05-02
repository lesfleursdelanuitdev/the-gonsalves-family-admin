"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";

export type StoryMediaDetail = {
  id: string;
  title: string | null;
  description: string | null;
  fileRef: string | null;
  form: string | null;
};

/** GET `/api/admin/media/[id]` returns `{ media }`, not a bare row. */
type AdminMediaDetailResponse = { media: StoryMediaDetail };

export function useStoryMediaById(mediaId: string | undefined) {
  return useQuery({
    queryKey: ["admin-story-media", mediaId],
    queryFn: async () => {
      const res = await fetchJson<AdminMediaDetailResponse>(`/api/admin/media/${mediaId}`);
      return res.media;
    },
    enabled: !!mediaId,
    staleTime: 60_000,
  });
}
