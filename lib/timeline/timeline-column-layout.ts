import type {
  TimelineChromeOnly,
  TimelineNumColumns,
  TimelinePerCol,
} from "@/lib/timeline/timeline-url-state";

const ALLOWED_PER_COL: readonly TimelinePerCol[] = [5, 8, 10, 15, 20];

function clampNumColumns(n: number): TimelineNumColumns {
  const x = Math.round(n);
  if (x <= 2) return 2;
  if (x >= 10) return 10;
  return x as TimelineNumColumns;
}

function snapPerCol(raw: number): TimelinePerCol {
  let best: TimelinePerCol = 10;
  let bestD = Infinity;
  for (const a of ALLOWED_PER_COL) {
    const d = Math.abs(a - raw);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Events per column used for chunking (always ≥ 1). */
export function effectiveEventsPerColumn(
  eventCount: number,
  chrome: Pick<TimelineChromeOnly, "columnChunkMode" | "perCol" | "numColumns">,
): number {
  if (eventCount <= 0) return 1;
  if (chrome.columnChunkMode === "by-column-count") {
    const n = clampNumColumns(chrome.numColumns);
    return Math.max(1, Math.ceil(eventCount / n));
  }
  return chrome.perCol;
}

/** Number of columns after chunking. */
export function effectiveColumnCount(
  eventCount: number,
  chrome: Pick<TimelineChromeOnly, "columnChunkMode" | "perCol" | "numColumns">,
): number {
  if (eventCount <= 0) return 0;
  const per = effectiveEventsPerColumn(eventCount, chrome);
  return Math.ceil(eventCount / per);
}

/** When switching to by-events mode, pick a perCol close to current column layout. */
export function perColFromColumnCount(eventCount: number, numColumns: number): TimelinePerCol {
  if (eventCount <= 0) return 10;
  return snapPerCol(Math.ceil(eventCount / clampNumColumns(numColumns)));
}

/** When switching to by-column-count mode, pick column count close to current perCol. */
export function numColumnsFromPerCol(eventCount: number, perCol: TimelinePerCol): TimelineNumColumns {
  if (eventCount <= 0) return 7;
  return clampNumColumns(Math.ceil(eventCount / perCol));
}
