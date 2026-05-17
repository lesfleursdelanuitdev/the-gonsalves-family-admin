import type { StoryBlock, StoryDocument, StoryDocumentMetaPatch, StorySection } from "@/lib/admin/story-creator/story-types";

export type StoryEditorMode = "edit" | "preview";
export type StoryInspectorTab = "block" | "story" | "debug";
export type StoryPanelKey = "left" | "right";

export type StoryFlowNodeSelection = {
  richTextBlockId: string;
  nodeType: "storyFlowMedia" | "storyFlowEmbed";
  nodeId: string;
  pos?: number;
};

export type StoryValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type StoryHistorySnapshot = {
  document: StoryDocument;
  selectedBlockId: string | null;
  selectedSectionId: string | null;
  reason: string;
  timestamp: number;
};

export type StoryEditorHistoryState = {
  past: StoryHistorySnapshot[];
  future: StoryHistorySnapshot[];
  limit: number;
};

export type MoveSectionTarget = {
  newParentId: string | null;
  insertBeforeId: string | null;
};

export type MoveBlockTarget =
  | { kind: "relative"; targetBlockId: string; position: "above" | "below" }
  | { kind: "direction"; direction: -1 | 1 };

export type AddBlockPosition =
  | { kind: "index"; index: number }
  | { kind: "relative"; targetBlockId: string; position: "above" | "below" }
  | { kind: "append-into-container" }
  | { kind: "append-into-split-supporting" };

export type AddSectionPosition =
  | { kind: "root-after"; afterSectionId: string | null }
  | { kind: "child-of"; parentSectionId: string };

export type StoryEditorState = {
  document: StoryDocument | null;
  selectedBlockId: string | null;
  selectedFlowNode: StoryFlowNodeSelection | null;
  selectedSectionId: string | null;
  activeRichTextBlockId: string | null;
  activeEditorId: string | null;
  inspectorTab: StoryInspectorTab;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  mode: StoryEditorMode;
  dirty: boolean;
  lastSavedAt: string | null;
  validationErrors: StoryValidationError[];
  history: StoryEditorHistoryState;
};

export type StoryEditorActions = {
  initializeDocument: (document: StoryDocument) => void;
  resetDocument: (document: StoryDocument) => void;
  updateStorySettings: (patch: StoryDocumentMetaPatch) => void;
  selectBlock: (blockId: string | null) => void;
  selectFlowNode: (selection: StoryFlowNodeSelection | null) => void;
  selectSection: (sectionId: string | null) => void;
  setActiveRichTextBlock: (blockId: string | null) => void;
  updateBlock: (blockId: string, patch: Partial<StoryBlock>) => void;
  replaceBlock: (blockId: string, nextBlock: StoryBlock) => void;
  deleteBlock: (blockId: string) => void;
  duplicateBlock: (blockId: string) => void;
  moveBlock: (blockId: string, target: MoveBlockTarget) => void;
  addBlock: (parentIdOrSectionId: string, block: StoryBlock, position: AddBlockPosition) => void;
  updateSection: (sectionId: string, patch: Partial<StorySection>) => void;
  addSection: (section: StorySection, position: AddSectionPosition) => void;
  deleteSection: (sectionId: string) => void;
  moveSection: (sectionId: string, target: MoveSectionTarget) => void;
  collapseSection: (sectionId: string, collapsed: boolean) => void;
  markDirty: () => void;
  markSaved: (savedDocument?: StoryDocument) => void;
  setValidationErrors: (errors: StoryValidationError[]) => void;
  setInspectorTab: (tab: StoryInspectorTab) => void;
  setPanelOpen: (panel: StoryPanelKey, isOpen: boolean) => void;
  setMode: (mode: StoryEditorMode) => void;
  commitSnapshot: (reason: string) => void;
  undo: () => void;
  redo: () => void;
  updateDocumentRecipeWithSnapshot: (recipe: (document: StoryDocument) => StoryDocument, reason: string) => void;
  updateDocumentRecipeNoHistory: (recipe: (document: StoryDocument) => StoryDocument) => void;
};

export type StoryEditorStore = StoryEditorState & StoryEditorActions;

