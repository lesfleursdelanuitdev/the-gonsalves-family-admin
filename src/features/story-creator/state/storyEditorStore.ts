import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { findSectionById } from "@/lib/admin/story-creator/story-section-tree";
import type { StoryDocument } from "@/lib/admin/story-creator/story-types";
import {
  addBlockInDocument,
  addSectionInDocument,
  chooseDefaultSectionId,
  deleteBlockInDocument,
  deleteSectionInDocument,
  duplicateBlockInDocument,
  moveBlockInDocument,
  moveSectionInDoc,
  normalizeDocumentForStore,
  replaceBlockInSection,
  updateBlockInSection,
} from "@/features/story-creator/state/storyEditorActions";
import { makeSnapshot, pushHistorySnapshot } from "@/features/story-creator/state/storyEditorHistory";
import type { StoryEditorStore } from "@/features/story-creator/state/storyEditorTypes";
import type { StorySection } from "@/lib/admin/story-creator/story-types";
import { mapSectionInDocument } from "@/lib/admin/story-creator/story-section-tree";

const HISTORY_LIMIT = 100;

function cloneDoc(doc: StoryDocument): StoryDocument {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as StoryDocument;
}

export function createStoryEditorStore() {
  let pendingSnapshotTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPendingSnapshotTimer = () => {
    if (!pendingSnapshotTimer) return;
    clearTimeout(pendingSnapshotTimer);
    pendingSnapshotTimer = null;
  };

  const _debouncedCommitSnapshot = (reason: string, delayMs: number, commitSnapshot: (reason: string) => void) => {
    clearPendingSnapshotTimer();
    pendingSnapshotTimer = setTimeout(() => {
      pendingSnapshotTimer = null;
      commitSnapshot(reason);
    }, delayMs);
  };

  return createStore<StoryEditorStore>()(
    immer<StoryEditorStore>((set, get) => ({
    document: null,
    selectedBlockId: null,
    selectedSectionId: null,
    activeRichTextBlockId: null,
    activeEditorId: null,
    inspectorTab: "block",
    leftPanelOpen: true,
    rightPanelOpen: true,
    mode: "edit",
    dirty: false,
    lastSavedAt: null,
    validationErrors: [],
    history: { past: [], future: [], limit: HISTORY_LIMIT },

    initializeDocument: (document) =>
      set((state) => {
        clearPendingSnapshotTimer();
        const normalized = normalizeDocumentForStore(document);
        state.document = normalized;
        state.selectedSectionId = chooseDefaultSectionId(normalized);
        state.selectedBlockId = null;
        state.activeRichTextBlockId = null;
        state.activeEditorId = null;
        state.validationErrors = [];
        state.history = { ...state.history, past: [], future: [] };
        state.dirty = false;
        state.lastSavedAt = normalized.updatedAt ?? null;
      }),

    resetDocument: (document) => {
      get().initializeDocument(document);
    },

    updateStorySettings: (patch) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "update-story-settings"),
        );
        state.document = { ...state.document, ...patch };
        state.dirty = true;
      }),

    selectBlock: (blockId) => set((state) => void (state.selectedBlockId = blockId)),

    selectSection: (sectionId) =>
      set((state) => {
        state.selectedSectionId = sectionId;
        const doc = state.document;
        if (!doc || !sectionId) return;
        if (!findSectionById(doc.sections ?? [], sectionId)) {
          state.selectedSectionId = chooseDefaultSectionId(doc);
        }
      }),

    setActiveRichTextBlock: (blockId) =>
      set((state) => {
        state.activeRichTextBlockId = blockId;
        state.activeEditorId = blockId;
      }),

    updateBlock: (blockId, patch) =>
      set((state) => {
        if (!state.document) return;
        _debouncedCommitSnapshot("update-block", 500, get().commitSnapshot);
        state.document = {
          ...state.document,
          sections: (state.document.sections ?? []).map((sec) => updateBlockInSection(sec, blockId, patch)),
        };
        state.dirty = true;
      }),

    replaceBlock: (blockId, nextBlock) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "replace-block"),
        );
        state.document = {
          ...state.document,
          sections: (state.document.sections ?? []).map((sec) => replaceBlockInSection(sec, blockId, nextBlock)),
        };
        state.dirty = true;
      }),

    deleteBlock: (blockId) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "delete-block"),
        );
        const out = deleteBlockInDocument(state.document, blockId);
        state.document = out.document;
        if (state.selectedBlockId === blockId) state.selectedBlockId = out.nextSelectedId;
        state.dirty = true;
      }),

    duplicateBlock: (blockId) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "duplicate-block"),
        );
        const out = duplicateBlockInDocument(state.document, blockId);
        state.document = out.document;
        if (out.duplicateId) state.selectedBlockId = out.duplicateId;
        state.dirty = true;
      }),

    moveBlock: (blockId, target) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "move-block"),
        );
        state.document = moveBlockInDocument(state.document, blockId, target);
        state.dirty = true;
      }),

    addBlock: (parentIdOrSectionId, block, position) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "add-block"),
        );
        state.document = addBlockInDocument(state.document, parentIdOrSectionId, block, position);
        state.selectedBlockId = block.id;
        state.dirty = true;
      }),

    updateSection: (sectionId, patch) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "update-section"),
        );
        state.document = mapSectionInDocument(state.document, sectionId, (sec) => ({ ...sec, ...patch }));
        state.dirty = true;
      }),

    addSection: (section, position) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "add-section"),
        );
        state.document = addSectionInDocument(state.document, section, position);
        state.selectedSectionId = section.id;
        state.selectedBlockId = null;
        state.dirty = true;
      }),

    deleteSection: (sectionId) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "delete-section"),
        );
        state.document = deleteSectionInDocument(state.document, sectionId);
        if (state.selectedSectionId === sectionId) {
          state.selectedSectionId = chooseDefaultSectionId(state.document);
          state.selectedBlockId = null;
        }
        state.dirty = true;
      }),

    moveSection: (sectionId, target) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "move-section"),
        );
        state.document = moveSectionInDoc(state.document, sectionId, target.newParentId, target.insertBeforeId);
        state.dirty = true;
      }),

    collapseSection: (sectionId, collapsed) =>
      set((state) => {
        if (!state.document) return;
        state.document = mapSectionInDocument(state.document, sectionId, (sec: StorySection) => ({ ...sec, collapsed }));
        state.dirty = true;
      }),

    markDirty: () => set((state) => void (state.dirty = true)),

    markSaved: (savedDocument) =>
      set((state) => {
        if (savedDocument) state.document = normalizeDocumentForStore(savedDocument);
        state.dirty = false;
        state.lastSavedAt = state.document?.updatedAt ?? savedDocument?.updatedAt ?? state.lastSavedAt;
      }),

    setValidationErrors: (errors) => set((state) => void (state.validationErrors = errors)),

    setInspectorTab: (tab) => set((state) => void (state.inspectorTab = tab)),

    setPanelOpen: (panel, isOpen) =>
      set((state) => {
        if (panel === "left") state.leftPanelOpen = isOpen;
        else state.rightPanelOpen = isOpen;
      }),

    setMode: (mode) => set((state) => void (state.mode = mode)),

    commitSnapshot: (reason) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, reason),
        );
      }),

    undo: () =>
      set((state) => {
        if (!state.document || state.history.past.length === 0) return;
        const current = makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "undo-current");
        const past = [...state.history.past];
        const previous = past.pop();
        if (!previous) return;
        state.history.future = [current, ...state.history.future];
        state.history.past = past;
        state.document = cloneDoc(previous.document);
        state.selectedBlockId = previous.selectedBlockId;
        state.selectedSectionId = previous.selectedSectionId;
        state.dirty = true;
      }),

    redo: () =>
      set((state) => {
        if (!state.document || state.history.future.length === 0) return;
        const current = makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, "redo-current");
        const [next, ...rest] = state.history.future;
        if (!next) return;
        state.history.future = rest;
        state.history.past = [...state.history.past, current];
        if (state.history.past.length > state.history.limit) {
          state.history.past = state.history.past.slice(state.history.past.length - state.history.limit);
        }
        state.document = cloneDoc(next.document);
        state.selectedBlockId = next.selectedBlockId;
        state.selectedSectionId = next.selectedSectionId;
        state.dirty = true;
      }),

    updateDocumentRecipeWithSnapshot: (recipe, reason) =>
      set((state) => {
        if (!state.document) return;
        state.history = pushHistorySnapshot(
          state.history,
          makeSnapshot(state.document, state.selectedBlockId, state.selectedSectionId, reason),
        );
        state.document = recipe(state.document);
        state.dirty = true;
      }),

    updateDocumentRecipeNoHistory: (recipe) =>
      set((state) => {
        if (!state.document) return;
        state.document = recipe(state.document);
        state.dirty = true;
      }),
    })),
  );
}

