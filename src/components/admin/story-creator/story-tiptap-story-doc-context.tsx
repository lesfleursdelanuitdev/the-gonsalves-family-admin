"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoryDocument } from "@/lib/admin/story-creator/story-types";

const StoryTipTapStoryDocContext = createContext<StoryDocument | null>(null);

export function StoryTipTapStoryDocProvider({ doc, children }: { doc: StoryDocument; children: ReactNode }) {
  return <StoryTipTapStoryDocContext.Provider value={doc}>{children}</StoryTipTapStoryDocContext.Provider>;
}

export function useStoryTipTapStoryDoc(): StoryDocument | null {
  return useContext(StoryTipTapStoryDocContext);
}
