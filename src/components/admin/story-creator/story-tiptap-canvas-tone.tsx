"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Prose / chrome treatment for rich text on dark block cards vs light “paper” canvas. */
export type StoryTipTapCanvasTone = "admin" | "paper";

const StoryTipTapCanvasToneContext = createContext<StoryTipTapCanvasTone>("admin");

export function StoryTipTapCanvasToneProvider({
  tone,
  children,
}: {
  tone: StoryTipTapCanvasTone;
  children: ReactNode;
}) {
  return <StoryTipTapCanvasToneContext.Provider value={tone}>{children}</StoryTipTapCanvasToneContext.Provider>;
}

export function useStoryTipTapCanvasTone(): StoryTipTapCanvasTone {
  return useContext(StoryTipTapCanvasToneContext);
}
