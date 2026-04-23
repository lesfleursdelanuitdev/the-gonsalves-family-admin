"use client";

import { useEffect } from "react";

function setAppHeight() {
  if (typeof window === "undefined") return;
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

/**
 * Sets --app-height on the document root from window.innerHeight.
 * Runs on load and only on orientationchange (not on resize), so mobile
 * virtual keyboard open/close does not shrink the layout viewport.
 */
export function AppHeightSync() {
  useEffect(() => {
    setAppHeight();
    const onOrientationChange = () => {
      setTimeout(setAppHeight, 200);
    };
    window.addEventListener("orientationchange", onOrientationChange);
    return () => window.removeEventListener("orientationchange", onOrientationChange);
  }, []);
  return null;
}
