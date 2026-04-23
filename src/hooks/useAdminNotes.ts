"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminNoteListItem {
  id: string;
  xref: string | null;
  content: string;
  isTopLevel: boolean;
  individualNotes: Array<{ individual: { id: string; fullName: string | null; xref: string } }>;
  familyNotes: Array<{
    family: {
      id: string;
      xref: string;
      husband: { fullName: string | null } | null;
      wife: { fullName: string | null } | null;
    };
  }>;
  eventNotes: Array<{ event: { id: string; eventType: string } }>;
  sourceNotes: Array<{ source: { id: string; title: string | null; xref: string } }>;
}

export interface AdminNotesListResponse {
  notes: AdminNoteListItem[];
  total: number;
  hasMore: boolean;
}

/** Body for POST /api/admin/notes and PATCH (fields optional on PATCH). */
export interface AdminNoteWriteBody {
  content?: string;
  isTopLevel?: boolean;
  links?: {
    individualIds: string[];
    familyIds: string[];
    eventIds: string[];
    sourceIds: string[];
  };
}

export interface UseAdminNotesOpts {
  q?: string;
  limit?: number;
  offset?: number;
  isTopLevel?: "true" | "false";
  contentContains?: string;
  linkedGiven?: string;
  linkedLast?: string;
}

function buildNotesParams(opts: UseAdminNotesOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.isTopLevel === "true" || opts.isTopLevel === "false") {
    params.set("isTopLevel", opts.isTopLevel);
  }
  if (opts.contentContains) params.set("contentContains", opts.contentContains);
  if (opts.linkedGiven) params.set("linkedGiven", opts.linkedGiven);
  if (opts.linkedLast) params.set("linkedLast", opts.linkedLast);
  return params;
}

const notesHooks = createAdminCrudHooks<UseAdminNotesOpts, AdminNotesListResponse>({
  base: "/api/admin/notes",
  queryKey: ["admin", "notes"],
  buildParams: buildNotesParams,
});

export const useAdminNotes = notesHooks.useList;
export const useAdminNote = (id: string) => notesHooks.useDetail<{ note: unknown }>(id);
export const useCreateNote = notesHooks.useCreate;
export const useUpdateNote = notesHooks.useUpdate;
export const useDeleteNote = notesHooks.useDelete;
