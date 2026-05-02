import { toast } from "sonner";
import type { StoryDocument, StoryIndexEntry, StoryLifecycleStatus } from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import { migrateStoryDocument } from "@/lib/admin/story-creator/migrate-story-document";
import { ApiError, fetchJson, postJson, putJson, deleteJson } from "@/lib/infra/api";

const DOC_PREFIX = "ligneous-admin-story-doc-v1:";
const MIGRATE_PREFIX = "ligneous-admin-story-migrated-v1:";

function docKey(id: string): string {
  return `${DOC_PREFIX}${id}`;
}

function tombstoneKey(oldId: string): string {
  return `${MIGRATE_PREFIX}${oldId}`;
}

type MigrationTombstone = { newId: string; migratedAt: string };

function listLocalStoryDocKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(DOC_PREFIX)) keys.push(k);
  }
  return keys;
}

function extractStoryIdFromDocKey(key: string): string {
  return key.slice(DOC_PREFIX.length);
}

async function promoteLocalDraftToServer(oldId: string, doc: StoryDocument): Promise<string> {
  const created = await postJson<{ id: string }>("/api/admin/stories", {
    title: doc.title?.trim() || "Untitled story",
    kind: doc.kind ?? "story",
  });
  const newId = created.id;
  const body = migrateStoryDocument({ ...doc, id: newId });
  await putJson(`/api/admin/stories/${newId}`, body);
  try {
    localStorage.setItem(
      tombstoneKey(oldId),
      JSON.stringify({ newId, migratedAt: new Date().toISOString() } satisfies MigrationTombstone),
    );
  } catch {
    /* ignore quota */
  }
  return newId;
}

/** After 7 days, remove the original local doc blob (tombstone remains for idempotency). */
function cleanupStaleLocalDoc(oldId: string): void {
  try {
    const raw = localStorage.getItem(tombstoneKey(oldId));
    if (!raw) return;
    const t = JSON.parse(raw) as MigrationTombstone;
    const migratedAt = new Date(t.migratedAt).getTime();
    if (Number.isFinite(migratedAt) && Date.now() - migratedAt >= 7 * 86400_000) {
      localStorage.removeItem(docKey(oldId));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Uploads any `ligneous-admin-story-doc-v1:*` rows whose ids are not on the server yet,
 * then tombstones them under `ligneous-admin-story-migrated-v1:{oldId}`.
 * Returns how many drafts were uploaded.
 */
async function migrateOrphanLocalDrafts(serverIds: Set<string>): Promise<number> {
  if (typeof window === "undefined") return 0;
  let count = 0;
  for (const key of listLocalStoryDocKeys()) {
    const oldId = extractStoryIdFromDocKey(key);
    if (serverIds.has(oldId)) continue;

    if (localStorage.getItem(tombstoneKey(oldId))) {
      cleanupStaleLocalDoc(oldId);
      continue;
    }

    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let parsed: StoryDocument;
    try {
      parsed = JSON.parse(raw) as StoryDocument;
    } catch {
      continue;
    }
    if (!parsed || parsed.version !== 1 || typeof parsed.title !== "string") continue;

    try {
      await promoteLocalDraftToServer(oldId, parsed);
      count += 1;
    } catch (e) {
      console.error("Failed to migrate local story draft", oldId, e);
    }
  }
  return count;
}

export async function loadStoryIndex(): Promise<StoryIndexEntry[]> {
  if (typeof window === "undefined") return [];

  const first = await fetchJson<{ stories: StoryIndexEntry[] }>("/api/admin/stories");
  const serverIds = new Set(first.stories.map((s) => s.id));
  const migrated = await migrateOrphanLocalDrafts(serverIds);
  if (migrated > 0) {
    toast.success(`${migrated} local draft(s) uploaded to the server`);
    return (await fetchJson<{ stories: StoryIndexEntry[] }>("/api/admin/stories")).stories;
  }
  return first.stories;
}

export async function loadStoryDocument(id: string): Promise<StoryDocument | null> {
  if (typeof window === "undefined") return null;
  try {
    const doc = await fetchJson<StoryDocument>(`/api/admin/stories/${encodeURIComponent(id)}`);
    return migrateStoryDocument(doc);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const raw = localStorage.getItem(docKey(id));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as StoryDocument;
        if (parsed?.version === 1) {
          const newId = await promoteLocalDraftToServer(id, parsed);
          toast.success("Local draft uploaded to the server");
          const doc = await fetchJson<StoryDocument>(`/api/admin/stories/${encodeURIComponent(newId)}`);
          return migrateStoryDocument(doc);
        }
      } catch (err) {
        console.error("Promote local story on 404 failed", err);
      }
      return null;
    }
    throw e;
  }
}

/** Same shape as persisted by `saveStoryDocument` (refreshed `updatedAt` from server on write). */
export function storyDocumentWithSaveTimestamp(doc: StoryDocument): StoryDocument {
  return { ...doc, updatedAt: new Date().toISOString() };
}

export async function saveStoryDocument(doc: StoryDocument): Promise<StoryDocument> {
  if (typeof window === "undefined") {
    return storyDocumentWithSaveTimestamp(doc);
  }
  const { updatedAt } = await putJson<{ updatedAt: string }>(
    `/api/admin/stories/${encodeURIComponent(doc.id)}`,
    doc,
  );
  const remote = await fetchJson<StoryDocument>(`/api/admin/stories/${encodeURIComponent(doc.id)}`);
  const migrated = migrateStoryDocument(remote);
  return { ...migrated, updatedAt };
}

export function createEmptyStoryDocument(id?: string): StoryDocument {
  const sid = id ?? newStoryId();
  const sectionId = newStoryId();
  const now = new Date().toISOString();
  return {
    version: 1,
    id: sid,
    title: "Untitled story",
    kind: "story",
    status: "draft",
    updatedAt: now,
    sections: [
      {
        id: sectionId,
        title: "Section 1",
        collapsed: false,
        blocks: createDefaultSectionBlocks(),
      },
    ],
    placeLinks: [],
  };
}

export async function deleteStoryDocument(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  await deleteJson(`/api/admin/stories/${encodeURIComponent(id)}`);
  try {
    localStorage.removeItem(docKey(id));
    localStorage.removeItem(tombstoneKey(id));
  } catch {
    /* ignore */
  }
}

/** @deprecated Index is server-backed; kept as a no-op for any stale imports. */
export function upsertStoryIndexEntry(_entry: StoryIndexEntry): void {
  void _entry;
}

/** @deprecated Index is server-backed. */
export function removeStoryIndexEntry(_id: string): void {
  void _id;
}
