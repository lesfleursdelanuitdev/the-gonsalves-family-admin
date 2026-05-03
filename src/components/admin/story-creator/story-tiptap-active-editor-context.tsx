"use client";

import type { Editor } from "@tiptap/core";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type StoryTiptapToolbarDensity = "default" | "touch";

export type StoryTiptapActiveEditorContextValue = {
  /** TipTap editor that last received focus inside this provider. */
  activeEditor: Editor | null;
  toolbarDensity: StoryTiptapToolbarDensity;
  mountEditor: (editor: Editor) => void;
  unmountEditor: (editor: Editor) => void;
  notifyEditorFocused: (editor: Editor) => void;
  notifyEditorBlurred: () => void;
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
    window.setTimeout(() => {
      if ([...mountedRef.current].some((e) => !e.isDestroyed && e.view.hasFocus())) return;
      if (focusIsOnToolbarChrome()) return;
      setActiveEditor(null);
    }, 0);
  }, []);

  const value = useMemo(
    () => ({
      activeEditor,
      toolbarDensity,
      mountEditor,
      unmountEditor,
      notifyEditorFocused,
      notifyEditorBlurred,
    }),
    [activeEditor, toolbarDensity, mountEditor, unmountEditor, notifyEditorFocused, notifyEditorBlurred],
  );

  return <StoryTiptapActiveEditorContext.Provider value={value}>{children}</StoryTiptapActiveEditorContext.Provider>;
}

export function useStoryTiptapActiveEditorOptional(): StoryTiptapActiveEditorContextValue | null {
  return useContext(StoryTiptapActiveEditorContext);
}
