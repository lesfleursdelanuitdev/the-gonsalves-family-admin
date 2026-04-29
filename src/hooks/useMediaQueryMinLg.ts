"use client";

import { useEffect, useState } from "react";

const QUERY = "(min-width: 1024px)";

/**
 * `true` when viewport is lg+ (Tailwind `lg`), `false` below (mobile/tablet).
 * First client render uses `false` (mobile-first) until `matchMedia` runs.
 */
export function useMediaQueryMinLg(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return matches;
}
