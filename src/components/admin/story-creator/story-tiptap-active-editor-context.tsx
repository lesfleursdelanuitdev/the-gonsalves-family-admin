"use client";

import type { Editor } from "@tiptap/core";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type StoryTiptapToolbarDensity = "default" | "touch";

export type StoryTiptapActiveEditorContextValue = {
  /** TipTap editor that last received focus inside this provider. */
  activeEditor: Editor | null;
  toolbarDensity: StoryTiptapToolbarDensity;
  mountEditor: (editor: Editor) => void;
  unmountEditor: (editor: Editor) => void;
  notifyEditorFocused: (editor: Editor) => void;
  notifyEditorBlurred: () => void;
  /** Clear the global toolbar target (e.g. when a non–rich-text block is selected from the outline). */
  clearGlobalActiveEditor: () => void;
};

const StoryTiptapActiveEditorContext = createContext<StoryTiptapActiveEditorContextValue | null>(null);

export function StoryTiptapActiveEditorProvider({
  toolbarDensity,
  children,
}: {
  toolbarDensity: StoryTiptapToolbarDensity;
  children: ReactNode;
}) {
  const mountedRef = useRef(new Set<Editor>());
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  const mountEditor = useCallback((editor: Editor) => {
    mountedRef.current.add(editor);
  }, []);

  const unmountEditor = useCallback((editor: Editor) => {
    mountedRef.current.delete(editor);
    setActiveEditor((cur) => (cur === editor ? null : cur));
  }, []);

  const notifyEditorFocused = useCallback((editor: Editor) => {
    setActiveEditor(editor);
  }, []);

  const clearGlobalActiveEditor = useCallback(() => {
    setActiveEditor(null);
  }, []);

  const notifyEditorBlurred = useCallback(() => {
    /** Dropdowns from the global toolbar render in a portal; focus is not under `data-story-global-tiptap-toolbar`. */
    const focusIsOnToolbarChrome = () => {
      const el = document.activeElement;
      if (!(el instanceof Element)) return false;
      if (el.closest("[data-story-global-tiptap-toolbar]")) return true;
      if (el.closest('[data-slot="dropdown-menu-content"]')) return true;
      if (el.closest('[data-slot="dropdown-menu-sub-content"]')) return true;
      return false;
    };
    /** Mobile WebKit: `view.hasFocus()` can briefly lag behind `document.activeElement` inside the editor. */
    const focusStillInsideMountedEditor = () => {
      const el = document.activeElement;
      if (!(el instanceof Node)) return false;
      return [...mountedRef.current].some(
        (e) => !e.isDestroyed && typeof e.view.dom?.contains === "function" && e.view.dom.contains(el),
      );
    };
    const focusIsOnOutlineRenameChrome = () => {
      const el = document.activeElement;
      if (!(el instanceof Element)) return false;
      if (el.closest("[data-story-outline-rename]")) return true;
      return el instanceof HTMLInputElement && el.getAttribute("aria-label") === "Rename";
    };
    /** Run after layout so `document.activeElement` reflects inputs mounted in the same tick as editor blur. */
    const runAfterFocusSettled = (fn: () => void) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(fn);
      });
    };
    runAfterFocusSettled(() => {
      /** Touch UI: keep the last focused block editor wired so the global bar stays enabled (blur is noisy). */
      if (toolbarDensity === "touch") return;
      if ([...mountedRef.current].some((e) => !e.isDestroyed && e.view.hasFocus())) return;
      if (focusStillInsideMountedEditor()) return;
      if (focusIsOnToolbarChrome()) return;
      if (focusIsOnOutlineRenameChrome()) return;
      setActiveEditor(null);
    });
  }, [toolbarDensity]);

  const value = useMemo(
    () => ({
      activeEditor,
      toolbarDensity,
      mountEditor,
      unmountEditor,
      notifyEditorFocused,
      notifyEditorBlurred,
      clearGlobalActiveEditor,
    }),
    [
      activeEditor,
      toolbarDensity,
      mountEditor,
      unmountEditor,
      notifyEditorFocused,
      notifyEditorBlurred,
      clearGlobalActiveEditor,
    ],
  );

  return <StoryTiptapActiveEditorContext.Provider value={value}>{children}</StoryTiptapActiveEditorContext.Provider>;
}

export function useStoryTiptapActiveEditorOptional(): StoryTiptapActiveEditorContextValue | null {
  return useContext(StoryTiptapActiveEditorContext);
}

/**
 * Keeps {@link StoryGlobalTipTapToolbar} in sync with story outline / chrome selection: clears the
 * global active editor when the selected block is not rich text (and not a split layout row, whose
 * main text editor claims the toolbar separately).
 */
export function StoryGlobalToolbarSelectionSync({
  selectedBlockId,
  selectedBlockKind,
}: {
  selectedBlockId: string | null;
  selectedBlockKind: string | null;
}) {
  const ctx = useStoryTiptapActiveEditorOptional();
  useLayoutEffect(() => {
    if (!ctx) return;
    if (!selectedBlockId) {
      ctx.clearGlobalActiveEditor();
      return;
    }
    if (selectedBlockKind === "richText" || selectedBlockKind === "splitContent" || selectedBlockKind === "table") {
      return;
    }
    ctx.clearGlobalActiveEditor();
  }, [ctx, selectedBlockId, selectedBlockKind]);
  return null;
}
