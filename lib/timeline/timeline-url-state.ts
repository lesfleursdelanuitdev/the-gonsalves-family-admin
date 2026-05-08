import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";

export type TimelineScope = "individual" | "family" | "note";

export type TimelineOrient = "toggle" | "vertical" | "horizontal";
export type TimelineAnim = "fade" | "slide" | "pop" | "none";
export type TimelineStaggerV = "staggered" | "left" | "right";
export type TimelineStaggerH = "staggered" | "top" | "bottom";
/** `html` is the DaisyUI/HTML renderer (default); `svg` is a pure-SVG mirror that looks the same. */
export type TimelineRenderer = "html" | "svg";
/** View mode: single timeline, multi-column layouts (timeline / grid / refined spine). */
export type TimelineViewMode = "single" | "timeline-cols" | "grid-cols" | "spine-cols";

/** How column views split events into columns. */
export type TimelineColumnChunkMode = "by-events-per-column" | "by-column-count";

export type TimelinePerCol = 5 | 8 | 10 | 15 | 20;
export type TimelineNumColumns = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** How preview viewport `width` / sliders are interpreted. */
export type TimelinePreviewWidthUnit = "px" | "pct";

/** View options only (no entity selection). */
export type TimelineChromeOnly = Omit<TimelineUrlState, "scope" | "entityId">;

export type TimelineUrlState = {
  scope: TimelineScope | null;
  entityId: string | null;
  orient: TimelineOrient;
  activeView: "vertical" | "horizontal";
  anim: TimelineAnim;
  vStyle: TimelineStaggerV;
  hStyle: TimelineStaggerH;
  heightPx: number;
  /** When `previewWidthUnit` is `px`: max width of the scroll viewport in CSS pixels. */
  widthPx: number;
  /** When `previewWidthUnit` is `pct`: viewport width as % of the surrounding block (10–100). */
  widthPct: number;
  previewWidthUnit: TimelinePreviewWidthUnit;
  pag: boolean;
  perPage: 5 | 8 | 12 | 20;
  page: number;
  /** Pixels per second when autoplay scrolls the timeline viewport. */
  autoplayPxPerSec: number;
  /** When true, autoplay jumps back to the start after reaching the end; when false, stops once. */
  autoplayLoop: boolean;
  /** When true, show one linked raster image per event (if the API attached `previewMediaFileRef`). */
  showImages: boolean;
  /**
   * Reveal animation runs when this fraction of the event card’s area is inside the scroll viewport
   * (`IntersectionObserver` `intersectionRatio`). Range 0.1–1.
   */
  animRevealMinRatio: number;
  /** Switches between the default HTML/CSS renderer and the pure-SVG renderer that mirrors the look. */
  renderer: TimelineRenderer;
  /** Events per column when `columnChunkMode` is `by-events-per-column`. */
  perCol: TimelinePerCol;
  /** Fixed column count when `columnChunkMode` is `by-column-count`; events per column is derived. */
  numColumns: TimelineNumColumns;
  /** Whether column layout is driven by events-per-column or fixed column count. */
  columnChunkMode: TimelineColumnChunkMode;
  /** Card/column width in pixels for column views. */
  cardWidthPx: 200 | 260 | 320;
  /** Gap between columns in pixels. */
  gapPx: number;
  /** Show downward arrows between events in grid view. */
  showArrows: boolean;
  /** View mode: single timeline (original), timeline columns, or grid columns. */
  viewMode: TimelineViewMode;
};

const DEFAULTS: TimelineUrlState = {
  scope: null,
  entityId: null,
  viewMode: "single",
  orient: "toggle",
  activeView: "vertical",
  anim: "fade",
  vStyle: "staggered",
  hStyle: "staggered",
  heightPx: 520,
  widthPx: 640,
  widthPct: 100,
  previewWidthUnit: "px",
  pag: false,
  perPage: 8,
  page: 0,
  autoplayPxPerSec: 48,
  autoplayLoop: true,
  showImages: false,
  animRevealMinRatio: 0.6,
  renderer: "html",
  perCol: 10,
  numColumns: 7,
  columnChunkMode: "by-events-per-column",
  cardWidthPx: 260,
  gapPx: 24,
  showArrows: true,
};

function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function parseUuid(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

export function parseTimelineUrlState(searchParams: URLSearchParams): TimelineUrlState {
  /** Preferred deep-link keys; `scope` + `id` remain supported for older URLs. */
  const scopeRaw =
    (searchParams.get("entityType") ?? searchParams.get("scope"))?.trim().toLowerCase() || "";
  const scope =
    scopeRaw === "individual" || scopeRaw === "family" || scopeRaw === "note" ? (scopeRaw as TimelineScope) : null;
  const entityId = parseUuid(searchParams.get("entityUuid") ?? searchParams.get("id"));

  const orient = parseEnum(searchParams.get("orient"), ["toggle", "vertical", "horizontal"] as const, "toggle");
  const activeView = parseEnum(
    searchParams.get("view"),
    ["vertical", "horizontal"] as const,
    "vertical",
  );
  const anim = parseEnum(searchParams.get("anim"), ["fade", "slide", "pop", "none"] as const, "fade");
  const vStyle = parseEnum(searchParams.get("vStyle"), ["staggered", "left", "right"] as const, "staggered");
  const hStyle = parseEnum(searchParams.get("hStyle"), ["staggered", "top", "bottom"] as const, "staggered");

  let heightPx = Number(searchParams.get("height"));
  if (!Number.isFinite(heightPx) || heightPx < 300 || heightPx > 800) heightPx = DEFAULTS.heightPx;
  heightPx = Math.round(heightPx / 20) * 20;

  const wURaw = (searchParams.get("wU") ?? "").trim().toLowerCase();
  const previewWidthUnit: TimelinePreviewWidthUnit =
    wURaw === "pct" || wURaw === "%" ? "pct" : "px";

  let widthPx = Number(searchParams.get("wPx"));
  if (!Number.isFinite(widthPx) || widthPx < 320 || widthPx > 960) {
    widthPx = Number(searchParams.get("width"));
    if (previewWidthUnit === "px") {
      if (!Number.isFinite(widthPx) || widthPx < 320 || widthPx > 960) widthPx = DEFAULTS.widthPx;
      widthPx = Math.round(widthPx / 20) * 20;
    } else {
      widthPx = DEFAULTS.widthPx;
    }
  } else {
    widthPx = Math.round(widthPx / 20) * 20;
  }

  let widthPct: number;
  if (previewWidthUnit === "pct") {
    widthPct = Number(searchParams.get("widthPct"));
    if (!Number.isFinite(widthPct) || widthPct < 10 || widthPct > 100) {
      const fromWidth = Number(searchParams.get("width"));
      widthPct =
        Number.isFinite(fromWidth) && fromWidth >= 10 && fromWidth <= 100 ? fromWidth : DEFAULTS.widthPct;
    }
    widthPct = Math.min(100, Math.max(10, Math.round(widthPct)));
  } else {
    widthPct = Number(searchParams.get("widthPct"));
    if (!Number.isFinite(widthPct) || widthPct < 10 || widthPct > 100) widthPct = DEFAULTS.widthPct;
    else widthPct = Math.round(widthPct);
  }

  const pag = searchParams.get("pag") === "1" || searchParams.get("pag") === "true";
  const ppRaw = searchParams.get("perPage");
  const perPage: 5 | 8 | 12 | 20 =
    ppRaw === "5" || ppRaw === "8" || ppRaw === "12" || ppRaw === "20" ? (Number(ppRaw) as 5 | 8 | 12 | 20) : 8;
  let page = Number(searchParams.get("page"));
  if (!Number.isFinite(page) || page < 0) page = 0;
  page = Math.floor(page);
  if (!pag) page = 0;

  let autoplayPxPerSec = Number(searchParams.get("apSpd"));
  if (!Number.isFinite(autoplayPxPerSec) || autoplayPxPerSec < 12 || autoplayPxPerSec > 200) {
    autoplayPxPerSec = DEFAULTS.autoplayPxPerSec;
  }
  autoplayPxPerSec = Math.round(autoplayPxPerSec / 4) * 4;

  const apLoopRaw = searchParams.get("apLoop");
  const autoplayLoop =
    apLoopRaw === "0" || apLoopRaw === "false" || apLoopRaw === "once"
      ? false
      : apLoopRaw === "1" || apLoopRaw === "true" || apLoopRaw === "loop"
        ? true
        : DEFAULTS.autoplayLoop;

  const showImages =
    searchParams.get("img") === "1" || searchParams.get("img") === "true" || searchParams.get("images") === "1";

  const revealRaw = searchParams.get("reveal");
  let revealPct: number;
  if (revealRaw == null || revealRaw.trim() === "") {
    revealPct = Math.round(DEFAULTS.animRevealMinRatio * 100);
  } else {
    revealPct = Number(revealRaw);
    if (!Number.isFinite(revealPct)) revealPct = Math.round(DEFAULTS.animRevealMinRatio * 100);
  }
  revealPct = Math.min(100, Math.max(10, Math.round(revealPct)));
  const animRevealMinRatio = revealPct / 100;

  const renderer = parseEnum(searchParams.get("rndr"), ["html", "svg"] as const, DEFAULTS.renderer);

  const viewMode = parseEnum(
    searchParams.get("mode"),
    ["single", "timeline-cols", "grid-cols", "spine-cols"] as const,
    DEFAULTS.viewMode,
  );

  const colChunkRaw = (searchParams.get("colChunk") ?? "").trim().toLowerCase();
  const columnChunkMode: TimelineColumnChunkMode =
    colChunkRaw === "cols" || colChunkRaw === "columns" || colChunkRaw === "bycols"
      ? "by-column-count"
      : "by-events-per-column";

  let perCol: TimelinePerCol = DEFAULTS.perCol;
  let numColumns: TimelineNumColumns = DEFAULTS.numColumns;

  if (columnChunkMode === "by-column-count") {
    const nColsRaw = searchParams.get("nCols");
    if (nColsRaw === "2" || nColsRaw === "3" || nColsRaw === "4" || nColsRaw === "5" || nColsRaw === "6" || nColsRaw === "7" || nColsRaw === "8" || nColsRaw === "9" || nColsRaw === "10") {
      numColumns = Number(nColsRaw) as TimelineNumColumns;
    }
  } else {
    const perColRaw = searchParams.get("perCol");
    if (perColRaw === "5" || perColRaw === "8" || perColRaw === "10" || perColRaw === "15" || perColRaw === "20") {
      perCol = Number(perColRaw) as TimelinePerCol;
    }
  }

  const cardWidthRaw = searchParams.get("cardW");
  const cardWidthPx: 200 | 260 | 320 =
    cardWidthRaw === "200" || cardWidthRaw === "260" || cardWidthRaw === "320"
      ? (Number(cardWidthRaw) as 200 | 260 | 320)
      : DEFAULTS.cardWidthPx;

  let gapPx = Number(searchParams.get("gap"));
  if (!Number.isFinite(gapPx) || gapPx < 0 || gapPx > 80) gapPx = DEFAULTS.gapPx;
  gapPx = Math.round(gapPx / 4) * 4;

  const showArrowsRaw = searchParams.get("arrows");
  const showArrows =
    showArrowsRaw === "0" || showArrowsRaw === "false"
      ? false
      : showArrowsRaw === "1" || showArrowsRaw === "true"
        ? true
        : DEFAULTS.showArrows;

  return {
    scope,
    entityId: scope && entityId ? entityId : null,
    viewMode,
    orient,
    activeView,
    anim,
    vStyle,
    hStyle,
    heightPx,
    widthPx,
    widthPct,
    previewWidthUnit,
    pag,
    perPage: Number(perPage) as 5 | 8 | 12 | 20,
    page: pag ? page : 0,
    autoplayPxPerSec,
    autoplayLoop,
    showImages,
    animRevealMinRatio,
    renderer,
    perCol,
    numColumns,
    columnChunkMode,
    cardWidthPx,
    gapPx,
    showArrows,
  };
}

export function serializeTimelineUrlState(base: TimelineUrlState): string {
  const p = new URLSearchParams();
  if (base.scope) {
    p.set("entityType", base.scope);
    if (base.entityId) p.set("entityUuid", base.entityId);
  }
  if (base.viewMode !== DEFAULTS.viewMode) p.set("mode", base.viewMode);
  p.set("orient", base.orient);
  p.set("view", base.activeView);
  p.set("anim", base.anim);
  p.set("vStyle", base.vStyle);
  p.set("hStyle", base.hStyle);
  p.set("height", String(base.heightPx));
  if (base.previewWidthUnit === "pct") {
    p.set("wU", "pct");
    p.set("width", String(base.widthPct));
    if (base.widthPx !== DEFAULTS.widthPx) p.set("wPx", String(base.widthPx));
  } else {
    p.set("width", String(base.widthPx));
    if (base.widthPct !== DEFAULTS.widthPct) p.set("widthPct", String(base.widthPct));
  }
  p.set("apSpd", String(base.autoplayPxPerSec));
  p.set("apLoop", base.autoplayLoop ? "1" : "0");
  if (base.showImages) p.set("img", "1");
  const revealPctOut = Math.round(base.animRevealMinRatio * 100);
  const revealDefaultPct = Math.round(DEFAULTS.animRevealMinRatio * 100);
  if (revealPctOut !== revealDefaultPct) p.set("reveal", String(revealPctOut));
  if (base.renderer !== DEFAULTS.renderer) p.set("rndr", base.renderer);
  p.set("pag", base.pag ? "1" : "0");
  if (base.pag) {
    p.set("perPage", String(base.perPage));
    if (base.page > 0) p.set("page", String(base.page));
  }
  if (base.viewMode !== "single") {
    if (base.columnChunkMode === "by-column-count") {
      p.set("colChunk", "cols");
      p.set("nCols", String(base.numColumns));
    } else {
      p.set("perCol", String(base.perCol));
    }
    p.set("cardW", String(base.cardWidthPx));
    if (base.gapPx !== DEFAULTS.gapPx) p.set("gap", String(base.gapPx));
    if (base.viewMode === "grid-cols" && base.showArrows !== DEFAULTS.showArrows) {
      p.set("arrows", base.showArrows ? "1" : "0");
    }
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

/** Stable string for comparing two query strings regardless of param order. */
export function canonicalTimelineSearchString(qsWithOrWithoutQuestion: string): string {
  const raw = qsWithOrWithoutQuestion.trim().replace(/^\?/, "");
  const sp = new URLSearchParams(raw);
  return [...sp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

export { DEFAULTS as timelineUrlDefaults };
