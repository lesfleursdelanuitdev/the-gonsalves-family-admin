"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type { IndividualDetailEvent } from "@ligneous/gedcom-events";
import type { TimelineSubject } from "@ligneous/gedcom-events";

const NOTES_BASE = "/api/admin/notes";

export type AdminNoteEventsResponse = {
  events: IndividualDetailEvent[];
  timelineSubject?: TimelineSubject;
};

export function useAdminNoteEvents(noteId: string, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false && !!noteId;
  return useQuery({
    queryKey: ["admin", "notes", "events", noteId],
    queryFn: () => fetchJson<AdminNoteEventsResponse>(`${NOTES_BASE}/${noteId}/events`),
    enabled,
  });
}
