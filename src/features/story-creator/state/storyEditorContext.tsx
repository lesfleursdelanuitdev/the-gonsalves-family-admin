"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { createStoryEditorStore } from "@/features/story-creator/state/storyEditorStore";
import type { StoryEditorStore } from "@/features/story-creator/state/storyEditorTypes";

const StoryEditorStoreContext = createContext<StoreApi<StoryEditorStore> | null>(null);

export function StoryEditorStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi<StoryEditorStore> | null>(null);
  // eslint-disable-next-line react-hooks/refs
  if (!storeRef.current) {
    storeRef.current = createStoryEditorStore();
  }
  // eslint-disable-next-line react-hooks/refs
  return <StoryEditorStoreContext.Provider value={storeRef.current}>{children}</StoryEditorStoreContext.Provider>;
}

export function useStoryEditorStore<T>(selector: (state: StoryEditorStore) => T): T {
  const store = useContext(StoryEditorStoreContext);
  if (!store) {
    throw new Error("useStoryEditorStore must be used within StoryEditorStoreProvider.");
  }
  return useStore(store, selector);
}

