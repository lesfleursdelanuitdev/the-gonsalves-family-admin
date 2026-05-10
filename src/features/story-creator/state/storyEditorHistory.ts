import type { StoryDocument } from "@/lib/admin/story-creator/story-types";
import type { StoryEditorHistoryState, StoryHistorySnapshot } from "@/features/story-creator/state/storyEditorTypes";

function cloneDocument(doc: StoryDocument): StoryDocument {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as StoryDocument;
}

export function makeSnapshot(
  document: StoryDocument,
  selectedBlockId: string | null,
  selectedSectionId: string | null,
  reason: string,
): StoryHistorySnapshot {
  return {
    document: cloneDocument(document),
    selectedBlockId,
    selectedSectionId,
    reason,
    timestamp: Date.now(),
  };
}

export function pushHistorySnapshot(
  history: StoryEditorHistoryState,
  snapshot: StoryHistorySnapshot,
): StoryEditorHistoryState {
  const past = [...history.past, snapshot];
  const cappedPast = past.length > history.limit ? past.slice(past.length - history.limit) : past;
  return { ...history, past: cappedPast, future: [] };
}

