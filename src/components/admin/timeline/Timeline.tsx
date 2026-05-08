"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Pause, Play, RotateCcw } from "lucide-react";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { TimelineSvgViewport } from "@/components/admin/timeline/TimelineSvgViewport";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { timelineBodyToSafeHtml } from "@/lib/timeline/timeline-body-html";
import { timelineCardColors } from "@/lib/timeline/timeline-card-colors";
import {
  placeLine,
  timelineGlyphForEvent,
  typeLabel,
} from "@/lib/timeline/timeline-event-display";
import { friendlyTimelineDescription, type TimelineSubject } from "@/lib/timeline/timeline-friendly-description";
import {
  effectiveColumnCount,
  effectiveEventsPerColumn,
  numColumnsFromPerCol,
  perColFromColumnCount,
} from "@/lib/timeline/timeline-column-layout";
import type { TimelineChromeOnly, TimelineNumColumns, TimelinePerCol } from "@/lib/timeline/timeline-url-state";

function segBtn(on: boolean) {
  return cn(
    "cursor-pointer rounded-md border-0 px-2.5 py-1 text-[11px] font-medium transition-all",
    on
      ? "bg-base-100 text-base-content shadow-sm shadow-base-content/10"
      : "bg-transparent text-muted-foreground hover:text-foreground",
  );
}

type AutoplayRunState = "idle" | "playing" | "paused";

/** Uses `intersectionRatio` (visible area / element area). */
function entryShowsEnoughForReveal(en: IntersectionObserverEntry, minRatio: number): boolean {
  return en.intersectionRatio >= minRatio - 1e-4;
}

/** Spine segment between two events: blend marker colors along the axis (HTML timeline `<hr>`). */
function spineHrStyle(fromM: string, toM: string, isHorizontal: boolean): CSSProperties {
  const dir = isHorizontal ? "to right" : "to bottom";
  return {
    background: `linear-gradient(${dir}, ${fromM}55, ${toM}55)`,
    borderColor: "transparent",
  };
}

/** One continuous vertical spine for a column chunk (timeline-cols); avoids gaps from per-row flex segments + row padding. */
function columnChunkSpineBarStyle(chunk: IndividualDetailEvent[]): CSSProperties {
  const markers = chunk.map((e) => timelineCardColors(e.eventType, e.customType).m);
  if (markers.length === 0) return { background: "transparent" };
  if (markers.length === 1) {
    const m = markers[0]!;
    return { background: `${m}55` };
  }
  const stops = markers
    .map((m, i) => {
      const pct = Math.round((i / (markers.length - 1)) * 100);
      return `${m}55 ${pct}%`;
    })
    .join(", ");
  return { background: `linear-gradient(to bottom, ${stops})` };
}

/** Chunk events into columns */
function chunkEvents<T>(events: T[], perCol: number): T[][] {
  const out: T[][] = [];
  for (let c = 0; c < Math.ceil(events.length / perCol); c++) {
    out.push(events.slice(c * perCol, (c + 1) * perCol));
  }
  return out;
}

/** Timeline Columns View - multiple vertical timeline strips side by side */
function TimelineColumnsView({
  events,
  chrome,
  timelineSubject,
}: {
  events: IndividualDetailEvent[];
  chrome: TimelineChromeOnly;
  timelineSubject: TimelineSubject;
}) {
  const per = effectiveEventsPerColumn(events.length, chrome);
  const cols = chunkEvents(events, per);
  const colWidth = chrome.cardWidthPx + 26;

  return (
    <div
      className="inline-flex min-w-max flex-row flex-nowrap justify-start content-start"
      style={{ gap: chrome.gapPx }}
    >
      {cols.map((chunk, ci) => (
        <div
          key={ci}
          data-tl-ani
          data-col-idx={ci}
          className="relative flex shrink-0 flex-col"
          style={{ width: colWidth }}
        >
          <div
            className="pointer-events-none absolute bottom-3 left-[6px] top-3 z-[0] w-[1.5px] rounded-full"
            style={columnChunkSpineBarStyle(chunk)}
            aria-hidden
          />
          {chunk.map((e, ei) => {
            const c = timelineCardColors(e.eventType, e.customType);
            const Glyph = timelineGlyphForEvent(e);
            const friendly = friendlyTimelineDescription(e, timelineSubject);
            return (
              <div
                key={e.eventId ?? `${e.sortOrder}-${e.eventType}`}
                className="relative flex flex-row items-start py-1.5 pr-3"
              >
                <div className="relative z-[2] flex w-[14px] shrink-0 flex-col items-center pt-4">
                  <svg viewBox="0 0 20 20" fill={c.m} className="size-2.5 shrink-0" aria-hidden>
                    <circle cx="10" cy="10" r="8" />
                  </svg>
                </div>
                <div
                  className="mt-[18px] h-[1px] w-3 shrink-0"
                  style={{ background: c.m, opacity: 0.35 }}
                  aria-hidden
                />
                {/* Card */}
                <div
                  className="box-border max-w-full self-start overflow-hidden rounded-lg border bg-card shadow-sm"
                  style={{ width: chrome.cardWidthPx, borderColor: `${c.m}44` }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5"
                    style={{ background: c.bg, borderBottomColor: `${c.m}22` }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Glyph className="size-3.5 shrink-0 opacity-90" style={{ color: c.m }} aria-hidden />
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: `${c.m}22`, color: c.m }}
                      >
                        {typeLabel(e)}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: c.m }}>
                      {formatEventDate(e)}
                    </span>
                  </div>
                  <div className="bg-background px-2.5 py-2">
                    {placeLine(e) ? (
                      <div className="mb-1 text-[10px] leading-snug text-muted-foreground">{placeLine(e)}</div>
                    ) : null}
                    {friendly ? (
                      <p className="mb-1 text-[11px] font-medium leading-snug text-foreground">{friendly}</p>
                    ) : null}
                    {e.value?.trim() ? (
                      <div
                        className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground [&_a]:italic [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: timelineBodyToSafeHtml(e.value) }}
                      />
                    ) : null}
                    {e.eventId ? (
                      <p className="mt-2">
                        <Link href={`/admin/events/${e.eventId}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                          Open event
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Grid Columns View - tabular rows with fixed-width date column */
function GridColumnsView({
  events,
  chrome,
  timelineSubject,
}: {
  events: IndividualDetailEvent[];
  chrome: TimelineChromeOnly;
  timelineSubject: TimelineSubject;
}) {
  const per = effectiveEventsPerColumn(events.length, chrome);
  const cols = chunkEvents(events, per);
  /** `w-20` date rail + content width — explicit width avoids flex intrinsic sizing collapsing multi-column rows. */
  const gridColWidthPx = 80 + chrome.cardWidthPx;

  return (
    <div
      className="inline-flex min-w-max flex-row flex-nowrap justify-start content-start"
      style={{ gap: chrome.gapPx }}
    >
      {cols.map((chunk, ci) => (
        <div
          key={ci}
          data-tl-ani
          data-col-idx={ci}
          className="flex shrink-0 flex-col"
          style={{ width: gridColWidthPx }}
        >
          {chunk.map((e, ei) => {
            const c = timelineCardColors(e.eventType, e.customType);
            const Glyph = timelineGlyphForEvent(e);
            const friendly = friendlyTimelineDescription(e, timelineSubject);
            const hasNext = ei < chunk.length - 1;

            return (
              <div
                key={e.eventId ?? `${e.sortOrder}-${e.eventType}`}
                className="relative flex flex-row items-stretch border-b border-base-content/10 bg-background first:border-t"
                style={{ borderLeft: `3px solid ${c.m}` }}
              >
                {/* Date column */}
                <div
                  className="flex w-20 shrink-0 flex-col items-end justify-start border-r border-base-content/10 px-2.5 py-2.5"
                  style={{ background: c.bg }}
                >
                  <span className="whitespace-nowrap text-right text-[11px] font-bold leading-tight" style={{ color: c.m }}>
                    {formatEventDate(e)}
                  </span>
                </div>
                {/* Content column */}
                <div
                  className="relative box-border max-w-full shrink-0 px-3 py-2.5 pb-4"
                  style={{ width: chrome.cardWidthPx }}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Glyph className="size-3 shrink-0 opacity-90" style={{ color: c.m }} aria-hidden />
                    <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: c.m }}>
                      {typeLabel(e)}
                    </span>
                  </div>
                  {placeLine(e) ? (
                    <div className="mb-1 text-[10px] leading-snug text-muted-foreground">{placeLine(e)}</div>
                  ) : null}
                  {friendly ? (
                    <p className="mb-1 text-[11px] font-medium leading-snug text-foreground">{friendly}</p>
                  ) : null}
                  {e.value?.trim() ? (
                    <div
                      className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground [&_a]:italic [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: timelineBodyToSafeHtml(e.value) }}
                    />
                  ) : null}
                  {e.eventId ? (
                    <p className="mt-2">
                      <Link href={`/admin/events/${e.eventId}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                        Open event
                      </Link>
                    </p>
                  ) : null}
                  {/* Arrow to next event - centered on content column */}
                  {chrome.showArrows && hasNext ? (
                    <div className="pointer-events-none absolute -bottom-2 left-1/2 z-[4] -translate-x-1/2">
                      <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
                        <polygon points="0,0 18,0 9,10" fill={c.m} opacity="0.85" />
                      </svg>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Refined multi-column spine: centered gradient bar, date-range cap, alternating L/R cards (`timeline_spine_refined` layout). */
const SPINE_TRACK_PX = 10;
const SPINE_ARM_PX = 22;

function spineColumnBarStyle(chunk: IndividualDetailEvent[]): CSSProperties {
  const markers = chunk.map((e) => timelineCardColors(e.eventType, e.customType).m);
  if (markers.length === 0) return { background: "transparent" };
  if (markers.length === 1) {
    const m = markers[0]!;
    return { background: `${m}99`, boxShadow: `0 0 12px ${m}44` };
  }
  const stops = markers
    .map((m, i) => {
      const pct = Math.round((i / (markers.length - 1)) * 100);
      return `${m} ${pct}%`;
    })
    .join(", ");
  return {
    background: `linear-gradient(to bottom, ${stops})`,
    boxShadow: `0 0 12px ${markers[0]}44`,
  };
}

function SpineColumnsView({
  events,
  chrome,
  timelineSubject,
}: {
  events: IndividualDetailEvent[];
  chrome: TimelineChromeOnly;
  timelineSubject: TimelineSubject;
}) {
  const per = effectiveEventsPerColumn(events.length, chrome);
  const cols = chunkEvents(events, per);
  const halfW = chrome.cardWidthPx + SPINE_ARM_PX;
  const unitW = halfW + SPINE_TRACK_PX + halfW;

  return (
    <div
      className="inline-flex min-w-max flex-row flex-nowrap justify-start content-start px-1 py-4"
      style={{ gap: chrome.gapPx }}
    >
      {cols.map((chunk, ci) => {
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        const capLabel =
          first && last
            ? formatEventDate(first) === formatEventDate(last)
              ? formatEventDate(first)
              : `${formatEventDate(first)} – ${formatEventDate(last)}`
            : "";

        return (
          <div
            key={ci}
            data-tl-ani
            data-col-idx={ci}
            className="relative flex shrink-0 flex-col"
            style={{ width: unitW }}
          >
            <div
              className="pointer-events-none absolute z-[1] rounded-[5px]"
              style={{
                left: halfW,
                width: SPINE_TRACK_PX,
                top: 40,
                bottom: 12,
                ...spineColumnBarStyle(chunk),
              }}
              aria-hidden
            />
            <div className="relative z-[2] w-full shrink-0 pb-2 pt-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {capLabel}
            </div>
            {chunk.map((e, ei) => {
              const c = timelineCardColors(e.eventType, e.customType);
              const Glyph = timelineGlyphForEvent(e);
              const friendly = friendlyTimelineDescription(e, timelineSubject);
              const isLeft = ei % 2 === 0;

              const card = (
                <div
                  className="box-border min-w-0 shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm"
                  style={{
                    width: chrome.cardWidthPx,
                    borderColor: `${c.m}44`,
                    ...(isLeft
                      ? { borderRightWidth: 3, borderRightStyle: "solid", borderRightColor: c.m }
                      : { borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: c.m }),
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5"
                    style={{ background: c.bg, borderBottomColor: `${c.m}22` }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Glyph className="size-3.5 shrink-0 opacity-90" style={{ color: c.m }} aria-hidden />
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: `${c.m}22`, color: c.m }}
                      >
                        {typeLabel(e)}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: c.m }}>
                      {formatEventDate(e)}
                    </span>
                  </div>
                  <div className="bg-background px-2.5 py-2">
                    {placeLine(e) ? (
                      <div className="mb-1 text-[10px] leading-snug text-muted-foreground">{placeLine(e)}</div>
                    ) : null}
                    {friendly ? (
                      <p className="mb-1 text-[11px] font-medium leading-snug text-foreground">{friendly}</p>
                    ) : null}
                    {e.value?.trim() ? (
                      <div
                        className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground [&_a]:italic [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: timelineBodyToSafeHtml(e.value) }}
                      />
                    ) : null}
                    {e.eventId ? (
                      <p className="mt-2">
                        <Link
                          href={`/admin/events/${e.eventId}`}
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Open event
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              );

              const arm = (
                <div
                  className="mt-[21px] h-[1.5px] shrink-0 opacity-45"
                  style={{ width: SPINE_ARM_PX, background: c.m }}
                  aria-hidden
                />
              );

              return (
                <div
                  key={e.eventId ?? `${e.sortOrder}-${e.eventType}`}
                  className="relative z-[2] mb-2 grid items-start"
                  style={{
                    gridTemplateColumns: `${halfW}px ${SPINE_TRACK_PX}px ${halfW}px`,
                  }}
                >
                  <div className="flex min-w-0 items-start justify-end">
                    {isLeft ? (
                      <div className="flex max-w-full min-w-0 items-start">
                        {card}
                        {arm}
                      </div>
                    ) : null}
                  </div>
                  <div className="relative z-[3] flex justify-center pt-[15px]">
                    <div
                      className="size-3 shrink-0 rounded-full border-[2.5px] border-background"
                      style={{ background: c.m, boxShadow: `0 0 0 3px ${c.m}33` }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex min-w-0 items-start justify-start">
                    {!isLeft ? (
                      <div className="flex max-w-full min-w-0 items-start">
                        {arm}
                        {card}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Timeline({
  events,
  chrome,
  onChromeChange,
  timelineSubject,
  hasAnyPreviewMedia,
}: {
  events: IndividualDetailEvent[];
  chrome: TimelineChromeOnly;
  onChromeChange: (patch: Partial<TimelineChromeOnly>) => void;
  timelineSubject: TimelineSubject;
  /** True when at least one event has linked raster media (`previewMediaFileRef`). */
  hasAnyPreviewMedia: boolean;
}) {
  const vpRef = useRef<HTMLDivElement>(null);
  const [vpInnerW, setVpInnerW] = useState(0);
  const [autoplayRun, setAutoplayRun] = useState<AutoplayRunState>("idle");

  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const measure = () => setVpInnerW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgViewportInnerWidthPx = vpInnerW > 0 ? vpInnerW : chrome.widthPx;

  const isH =
    chrome.orient === "horizontal" || (chrome.orient === "toggle" && chrome.activeView === "horizontal");

  const shown = useMemo(() => {
    if (!chrome.pag) return events;
    const start = chrome.page * chrome.perPage;
    return events.slice(start, start + chrome.perPage);
  }, [events, chrome.pag, chrome.page, chrome.perPage]);

  const totalPages = Math.max(1, Math.ceil(events.length / chrome.perPage));

  const animRevealMinRatio = Math.min(1, Math.max(0.1, chrome.animRevealMinRatio));
  const animRevealThresholds = useMemo(() => {
    const t = new Set([0, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1, animRevealMinRatio]);
    return [...t].sort((a, b) => a - b);
  }, [animRevealMinRatio]);

  useEffect(() => {
    const id = window.setTimeout(() => setAutoplayRun("idle"), 0);
    return () => window.clearTimeout(id);
  }, [isH, chrome.pag, events.length]);

  useEffect(() => {
    if (chrome.pag || autoplayRun !== "playing") return;
    const vp = vpRef.current;
    if (!vp) return;

    let raf = 0;
    let last = performance.now();
    const EPS = 2;

    const tick = (now: number) => {
      const el = vpRef.current;
      if (!el) return;
      const dt = Math.min(now - last, 120);
      last = now;
      const px = (chrome.autoplayPxPerSec * dt) / 1000;

      if (isH) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= EPS) {
          setAutoplayRun("idle");
          return;
        }
        const next = el.scrollLeft + px;
        if (next >= maxScroll - EPS) {
          if (chrome.autoplayLoop) {
            el.scrollLeft = 0;
          } else {
            el.scrollLeft = maxScroll;
            setAutoplayRun("idle");
            return;
          }
        } else {
          el.scrollLeft = next;
        }
      } else {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= EPS) {
          setAutoplayRun("idle");
          return;
        }
        const next = el.scrollTop + px;
        if (next >= maxScroll - EPS) {
          if (chrome.autoplayLoop) {
            el.scrollTop = 0;
          } else {
            el.scrollTop = maxScroll;
            setAutoplayRun("idle");
            return;
          }
        } else {
          el.scrollTop = next;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoplayRun, chrome.pag, chrome.autoplayPxPerSec, chrome.autoplayLoop, isH, shown.length]);

  useEffect(() => {
    if (chrome.anim === "none") return;
    const vp = vpRef.current;
    if (!vp) return;
    type AniEl = HTMLElement | SVGElement;
    const els = vp.querySelectorAll<AniEl>("[data-tl-ani]");
    els.forEach((el) => {
      el.style.opacity = "0";
      if (chrome.anim === "slide") {
        el.style.transform = el.dataset.side === "start" ? "translateX(-18px)" : "translateX(18px)";
      } else if (chrome.anim === "pop") {
        el.style.transform = "scale(0.87)";
      } else {
        el.style.transform = "translateY(14px)";
      }
    });

    let raf = 0;
    const revealIfCannotFullyFit = () => {
      const list = [...vp.querySelectorAll<AniEl>("[data-tl-ani]")];
      for (const el of list) {
        // Whole columns are always taller than the viewport; never skip IO for them or they never animate.
        if (el.dataset.colIdx != null) continue;
        const r = el.getBoundingClientRect();
        const tooTall = r.height > vp.clientHeight - 4;
        const tooWide = r.width > vp.clientWidth - 4;
        if (tooTall || tooWide) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      }
    };
    raf = requestAnimationFrame(revealIfCannotFullyFit);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as AniEl;
          const isColumnAni = el.dataset.colIdx != null;
          if (isColumnAni) {
            if (en.intersectionRatio < 0.02) return;
          } else if (!entryShowsEnoughForReveal(en, animRevealMinRatio)) {
            return;
          }
          const idx = Array.from(vp.querySelectorAll("[data-tl-ani]")).indexOf(el);
          let staggerDelay: number;
          if (chrome.viewMode !== "single") {
            const colIdx = Number(el.dataset.colIdx ?? idx);
            staggerDelay = colIdx * 150;
          } else {
            staggerDelay = chrome.pag ? idx * 50 : 0;
          }
          window.setTimeout(() => {
            el.style.transition = "opacity 0.38s ease, transform 0.38s ease";
            el.style.opacity = "1";
            el.style.transform = "none";
          }, staggerDelay);
          observer.unobserve(el);
        });
      },
      {
        root: vp,
        threshold: animRevealThresholds,
      },
    );
    els.forEach((el) => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [
    shown,
    events,
    chrome.anim,
    isH,
    chrome.pag,
    chrome.renderer,
    chrome.viewMode,
    chrome.perCol,
    chrome.numColumns,
    chrome.columnChunkMode,
    chrome.cardWidthPx,
    animRevealMinRatio,
    animRevealThresholds,
  ]);

  const isSingleMode = chrome.viewMode === "single";
  const isGridMode = chrome.viewMode === "grid-cols";

  const columnLayoutPer = useMemo(
    () => effectiveEventsPerColumn(events.length, chrome),
    [events.length, chrome.columnChunkMode, chrome.perCol, chrome.numColumns],
  );
  const columnLayoutCount = useMemo(
    () => effectiveColumnCount(events.length, chrome),
    [events.length, chrome.columnChunkMode, chrome.perCol, chrome.numColumns],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-base-content/10 bg-base-content/[0.02] p-3 sm:p-4">
        {/* Row 1: View mode + Animation */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">View</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {(["single", "timeline-cols", "grid-cols", "spine-cols"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={segBtn(chrome.viewMode === v)}
                  onClick={() => onChromeChange({ viewMode: v })}
                >
                  {v === "single"
                    ? "Single"
                    : v === "timeline-cols"
                      ? "Timeline Columns"
                      : v === "grid-cols"
                        ? "Grid Columns"
                        : "Spine Columns"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Animation</span>
            <div className="inline-flex flex-wrap rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {(["fade", "slide", "pop", "none"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={segBtn(chrome.anim === v)}
                  onClick={() => onChromeChange({ anim: v })}
                >
                  {v === "fade" ? "Fade" : v === "slide" ? "Slide" : v === "pop" ? "Pop" : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Single mode: Orientation */}
          {isSingleMode ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Orientation</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {(["toggle", "vertical", "horizontal"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={segBtn(chrome.orient === v)}
                  onClick={() => {
                    onChromeChange({ orient: v, activeView: "vertical", page: 0 });
                  }}
                >
                  {v === "toggle" ? "Toggle" : v === "vertical" ? "Vertical" : "Horizontal"}
                </button>
              ))}
            </div>
          </div>
          ) : null}
          {isSingleMode ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Renderer</span>
            <div
              className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5"
              title="HTML/CSS uses DaisyUI. SVG is a pure-SVG mirror that looks the same."
            >
              {(["html", "svg"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={segBtn(chrome.renderer === v)}
                  onClick={() => onChromeChange({ renderer: v })}
                >
                  {v === "html" ? "HTML/CSS" : "SVG"}
                </button>
              ))}
            </div>
          </div>
          ) : null}
          <div className="flex min-w-[11rem] flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Reveal at{" "}
              <span className="font-medium text-foreground">{Math.round(animRevealMinRatio * 100)}%</span> visible
            </Label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(animRevealMinRatio * 100)}
              disabled={chrome.anim === "none"}
              title="Share of the card’s area inside the preview (intersection ratio) before the animation runs"
              onChange={(e) => onChromeChange({ animRevealMinRatio: Number(e.target.value) / 100 })}
              className="w-36 accent-primary disabled:opacity-40"
            />
          </div>
        </div>

        {/* Column controls (column modes only) */}
        {!isSingleMode ? (
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Column layout</span>
            <div className="inline-flex flex-wrap rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              <button
                type="button"
                className={segBtn(chrome.columnChunkMode === "by-events-per-column")}
                onClick={() =>
                  onChromeChange({
                    columnChunkMode: "by-events-per-column",
                    perCol: perColFromColumnCount(events.length, chrome.numColumns),
                  })
                }
              >
                By events / column
              </button>
              <button
                type="button"
                className={segBtn(chrome.columnChunkMode === "by-column-count")}
                onClick={() =>
                  onChromeChange({
                    columnChunkMode: "by-column-count",
                    numColumns: numColumnsFromPerCol(events.length, chrome.perCol),
                  })
                }
              >
                By column count
              </button>
            </div>
          </div>
          {chrome.columnChunkMode === "by-events-per-column" ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Events per column</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {([5, 8, 10, 15, 20] as const satisfies readonly TimelinePerCol[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={segBtn(chrome.perCol === n)}
                  onClick={() => onChromeChange({ perCol: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Columns</span>
            <div className="inline-flex flex-wrap rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {([2, 3, 4, 5, 6, 7, 8, 9, 10] as const satisfies readonly TimelineNumColumns[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={segBtn(chrome.numColumns === n)}
                  onClick={() => onChromeChange({ numColumns: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Column gap <span className="font-medium text-foreground">{chrome.gapPx}px</span>
            </Label>
            <input
              type="range"
              min={0}
              max={80}
              step={4}
              value={chrome.gapPx}
              onChange={(e) => onChromeChange({ gapPx: Number(e.target.value) })}
              className="w-28 accent-primary"
            />
          </div>
          {isGridMode ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Arrows</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              <button
                type="button"
                className={segBtn(chrome.showArrows)}
                onClick={() => onChromeChange({ showArrows: true })}
              >
                Show
              </button>
              <button
                type="button"
                className={segBtn(!chrome.showArrows)}
                onClick={() => onChromeChange({ showArrows: false })}
              >
                Hide
              </button>
            </div>
          </div>
          ) : null}
        </div>
        ) : null}

        {/* Vertical/Horizontal style (single mode only) */}
        {isSingleMode ? (
        <div className="mt-3 flex flex-wrap items-end gap-4">
          {!isH ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vertical style</span>
              <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
                {(["staggered", "left", "right"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={segBtn(chrome.vStyle === v)}
                    onClick={() => onChromeChange({ vStyle: v })}
                  >
                    {v === "staggered" ? "Staggered" : v === "left" ? "Left" : "Right"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Horizontal style</span>
              <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
                {(["staggered", "top", "bottom"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={segBtn(chrome.hStyle === v)}
                    onClick={() => onChromeChange({ hStyle: v })}
                  >
                  {v === "staggered" ? "Staggered" : v === "top" ? "Top" : "Bottom"}
                </button>
                ))}
              </div>
            </div>
          )}
        </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Height <span className="font-medium text-foreground">{chrome.heightPx}px</span>
            </Label>
            <input
              type="range"
              min={300}
              max={800}
              step={20}
              value={chrome.heightPx}
              onChange={(e) => onChromeChange({ heightPx: Number(e.target.value) })}
              className="w-36 accent-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Width unit</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              <button
                type="button"
                className={segBtn(chrome.previewWidthUnit === "px")}
                onClick={() => onChromeChange({ previewWidthUnit: "px" })}
              >
                px
              </button>
              <button
                type="button"
                className={segBtn(chrome.previewWidthUnit === "pct")}
                onClick={() => onChromeChange({ previewWidthUnit: "pct" })}
              >
                %
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Width{" "}
              <span className="font-medium text-foreground">
                {chrome.previewWidthUnit === "pct" ? `${chrome.widthPct}%` : `${chrome.widthPx}px`}
              </span>
            </Label>
            <input
              type="range"
              min={chrome.previewWidthUnit === "pct" ? 10 : 320}
              max={chrome.previewWidthUnit === "pct" ? 100 : 960}
              step={chrome.previewWidthUnit === "pct" ? 5 : 20}
              value={chrome.previewWidthUnit === "pct" ? chrome.widthPct : chrome.widthPx}
              onChange={(e) =>
                onChromeChange(
                  chrome.previewWidthUnit === "pct"
                    ? { widthPct: Number(e.target.value) }
                    : { widthPx: Number(e.target.value) },
                )
              }
              className="w-36 accent-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Card width</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              {([200, 260, 320] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={segBtn(chrome.cardWidthPx === w)}
                  onClick={() => onChromeChange({ cardWidthPx: w })}
                >
                  {w === 200 ? "Narrow" : w === 260 ? "Medium" : "Wide"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pagination</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              <button
                type="button"
                className={segBtn(!chrome.pag)}
                onClick={() => onChromeChange({ pag: false, page: 0 })}
              >
                Scroll
              </button>
              <button
                type="button"
                className={segBtn(chrome.pag)}
                onClick={() => onChromeChange({ pag: true, page: 0 })}
              >
                Pages
              </button>
            </div>
          </div>
          {chrome.pag ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Per page</span>
              <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
                {([5, 8, 12, 20] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={segBtn(chrome.perPage === n)}
                    onClick={() => onChromeChange({ perPage: n, page: 0 })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Event images</span>
            <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
              <button
                type="button"
                className={segBtn(!chrome.showImages)}
                onClick={() => onChromeChange({ showImages: false })}
              >
                Off
              </button>
              <button
                type="button"
                disabled={!hasAnyPreviewMedia}
                className={segBtn(chrome.showImages)}
                title={
                  hasAnyPreviewMedia
                    ? "Show one linked photo per event when available"
                    : "No events in this list have linked raster images"
                }
                onClick={() => onChromeChange({ showImages: true })}
              >
                On
              </button>
            </div>
            {!hasAnyPreviewMedia ? (
              <p className="max-w-[14rem] text-[10px] leading-snug text-muted-foreground">
                No linked photos on these events (link media on each event record).
              </p>
            ) : null}
          </div>
        </div>

        {isSingleMode ? (
        <div
          className={cn(
            "mt-3 flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-200/30 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4",
            chrome.pag && "opacity-50",
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Autoplay scroll</span>
            <p className="text-[11px] text-muted-foreground">
              {chrome.pag
                ? "Turn off pagination to scroll the timeline automatically."
                : isH
                  ? "Scrolls right through the horizontal timeline."
                  : "Scrolls down through the vertical timeline."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Speed <span className="font-medium text-foreground">{chrome.autoplayPxPerSec}px/s</span>
              </Label>
              <input
                type="range"
                min={12}
                max={200}
                step={4}
                value={chrome.autoplayPxPerSec}
                disabled={chrome.pag}
                onChange={(e) => onChromeChange({ autoplayPxPerSec: Number(e.target.value) })}
                className="w-36 accent-primary disabled:opacity-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Repeat</span>
              <div className="inline-flex rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
                <button
                  type="button"
                  disabled={chrome.pag}
                  className={segBtn(!chrome.autoplayLoop)}
                  onClick={() => onChromeChange({ autoplayLoop: false })}
                >
                  Once
                </button>
                <button
                  type="button"
                  disabled={chrome.pag}
                  className={segBtn(chrome.autoplayLoop)}
                  onClick={() => onChromeChange({ autoplayLoop: true })}
                >
                  Loop
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {autoplayRun === "paused" ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={chrome.pag}
                  onClick={() => setAutoplayRun("playing")}
                >
                  <Play className="size-3.5" aria-hidden />
                  Resume
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={chrome.pag || autoplayRun === "playing"}
                  onClick={() => {
                    const el = vpRef.current;
                    if (el && !chrome.autoplayLoop) {
                      const maxX = el.scrollWidth - el.clientWidth;
                      const maxY = el.scrollHeight - el.clientHeight;
                      if (isH && maxX > 2 && el.scrollLeft >= maxX - 2) el.scrollLeft = 0;
                      if (!isH && maxY > 2 && el.scrollTop >= maxY - 2) el.scrollTop = 0;
                    }
                    setAutoplayRun("playing");
                  }}
                >
                  <Play className="size-3.5" aria-hidden />
                  Play
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={chrome.pag || autoplayRun !== "playing"}
                onClick={() => setAutoplayRun("paused")}
              >
                <Pause className="size-3.5" aria-hidden />
                Pause
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={chrome.pag}
                onClick={() => {
                  const el = vpRef.current;
                  if (el) {
                    el.scrollLeft = 0;
                    el.scrollTop = 0;
                  }
                  setAutoplayRun("playing");
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Start over
              </Button>
            </div>
          </div>
        </div>
        ) : null}
      </div>

      <div
        ref={vpRef}
        className={cn(
          "relative mx-auto max-w-full min-w-0 rounded-xl border border-base-content/10 bg-base-content/[0.02]",
          "overflow-auto",
        )}
        style={{
          width:
            chrome.previewWidthUnit === "pct"
              ? `${chrome.widthPct}%`
              : `min(100%, ${chrome.widthPx}px)`,
          height: chrome.heightPx,
        }}
      >
        {isSingleMode && !isH ? (
          <div
            className="pointer-events-none sticky top-0 z-[1] -mb-7 h-7 bg-gradient-to-b from-base-200/90 to-transparent"
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            "p-2",
            /* Horizontal single timeline: column flex + min-w-max. Column modes use min-w-max strips inside this block wrapper (viewport overflow-auto scrolls). */
            isSingleMode && isH ? "flex min-h-full min-w-max flex-col pb-3 pt-2" : "px-2 pb-3 pt-2",
          )}
        >
          {isSingleMode && chrome.orient === "toggle" ? (
            <div className="mb-2 flex shrink-0 justify-end px-1">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onChromeChange({ activeView: isH ? "vertical" : "horizontal" })}>
                {isH ? "Switch to vertical" : "Switch to horizontal"}
              </Button>
            </div>
          ) : null}

          {/* Single timeline view */}
          {isSingleMode ? (
          <div className={cn(isH && "flex min-h-0 flex-1 flex-col justify-center")}>
            {chrome.renderer === "svg" ? (
              <TimelineSvgViewport
                events={shown}
                chrome={chrome}
                timelineSubject={timelineSubject}
                isH={isH}
                viewportInnerWidthPx={svgViewportInnerWidthPx}
              />
            ) : (
            <ul className={cn("timeline", isH ? "timeline-horizontal w-max" : "timeline-vertical timeline-snap-icon w-full")}>
            {shown.map((e, i) => {
              const c = timelineCardColors(e.eventType, e.customType);
              const prevC = i > 0 ? timelineCardColors(shown[i - 1]!.eventType, shown[i - 1]!.customType) : null;
              const nextC = i < shown.length - 1 ? timelineCardColors(shown[i + 1]!.eventType, shown[i + 1]!.customType) : null;
              const Glyph = timelineGlyphForEvent(e);
              const friendly = friendlyTimelineDescription(e, timelineSubject);
              const imgSrc =
                chrome.showImages && e.previewMediaFileRef
                  ? resolveMediaImageSrc(e.previewMediaFileRef)
                  : null;
              const showRaster =
                Boolean(imgSrc && e.previewMediaFileRef && isLikelyRasterImage(e.previewMediaFileRef, "", null));
              let startCard = false;
              let endCard = false;
              if (isH) {
                if (chrome.hStyle === "staggered") {
                  if (i % 2 === 0) startCard = true;
                  else endCard = true;
                } else if (chrome.hStyle === "top") startCard = true;
                else endCard = true;
              } else {
                if (chrome.vStyle === "staggered") {
                  if (i % 2 === 0) startCard = true;
                  else endCard = true;
                } else if (chrome.vStyle === "left") startCard = true;
                else endCard = true;
              }

              const card = (
                <div
                  data-tl-ani
                  data-side={startCard ? "start" : "end"}
                  className="box-border max-w-full overflow-hidden rounded-lg border bg-card shadow-sm"
                  style={{ width: chrome.cardWidthPx, borderColor: `${c.m}40` }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5"
                    style={{ background: c.bg, borderBottomColor: `${c.m}40` }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Glyph className="size-3.5 shrink-0 opacity-90" style={{ color: c.m }} aria-hidden />
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: `${c.m}28`, color: c.m }}>
                        {typeLabel(e)}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: c.m }}>
                      {formatEventDate(e)}
                    </span>
                  </div>
                  <div className="bg-background px-2.5 py-2">
                    {showRaster && imgSrc && e.previewMediaFileRef ? (
                      <div className="relative mb-2 flex h-44 w-full items-center justify-center rounded-md border border-base-content/10 bg-base-200/40 p-1">
                        <MediaRasterImage
                          fileRef={e.previewMediaFileRef}
                          form=""
                          src={imgSrc}
                          alt={typeLabel(e)}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 280px"
                        />
                      </div>
                    ) : null}
                    {placeLine(e) ? (
                      <div className="mb-1 text-[10px] leading-snug text-muted-foreground">{placeLine(e)}</div>
                    ) : null}
                    {friendly ? (
                      <p className="mb-1 text-[11px] font-medium leading-snug text-foreground">{friendly}</p>
                    ) : null}
                    {e.value?.trim() ? (
                      <div
                        className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground [&_a]:italic [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: timelineBodyToSafeHtml(e.value) }}
                      />
                    ) : null}
                    {e.eventId ? (
                      <p className="mt-2">
                        <Link href={`/admin/events/${e.eventId}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                          Open event
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              );

              const dot = (
                <div className="timeline-middle mx-1">
                  <svg viewBox="0 0 20 20" fill={c.m} className="size-3.5" aria-hidden>
                    <circle cx="10" cy="10" r="8" />
                  </svg>
                </div>
              );

              // DaisyUI timeline: each <li> needs an <hr> before the row (i > 0) and after (not last)
              // so the spine runs through grid rows 1 → dot (2) → 3. Gradient blends adjacent event colors.
              const hrBefore =
                i > 0 && prevC ? (
                  <hr className="border-0" style={spineHrStyle(prevC.m, c.m, isH)} />
                ) : i > 0 ? (
                  <hr className="opacity-30" style={{ background: c.m }} />
                ) : null;
              const hrAfter =
                i < shown.length - 1 && nextC ? (
                  <hr className="border-0" style={spineHrStyle(c.m, nextC.m, isH)} />
                ) : i < shown.length - 1 ? (
                  <hr className="opacity-30" style={{ background: c.m }} />
                ) : null;

              return (
                <li key={e.eventId ?? `ev-${i}-${e.sortOrder}-${e.eventType}`}>
                  {hrBefore}
                  {startCard ? (
                    <div className="timeline-start mb-1 mt-1">{card}</div>
                  ) : (
                    <div className="timeline-start min-h-[1px]" />
                  )}
                  {dot}
                  {endCard ? <div className="timeline-end mb-1 mt-1">{card}</div> : <div className="timeline-end min-h-[1px]" />}
                  {hrAfter}
                </li>
              );
            })}
            </ul>
            )}
          </div>
          ) : null}

          {/* Column Timeline View */}
          {chrome.viewMode === "timeline-cols" ? (
            <TimelineColumnsView events={events} chrome={chrome} timelineSubject={timelineSubject} />
          ) : null}

          {/* Grid Column View */}
          {chrome.viewMode === "grid-cols" ? (
            <GridColumnsView events={events} chrome={chrome} timelineSubject={timelineSubject} />
          ) : null}

          {chrome.viewMode === "spine-cols" ? (
            <SpineColumnsView events={events} chrome={chrome} timelineSubject={timelineSubject} />
          ) : null}

          {isSingleMode && chrome.pag ? (
            <div className="flex shrink-0 items-center justify-center gap-3 py-2 text-xs text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={chrome.page <= 0}
                onClick={() => onChromeChange({ page: Math.max(0, chrome.page - 1) })}
              >
                ← Prev
              </Button>
              <span>
                {chrome.page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={chrome.page >= totalPages - 1}
                onClick={() => onChromeChange({ page: Math.min(totalPages - 1, chrome.page + 1) })}
              >
                Next →
              </Button>
            </div>
          ) : null}

          {/* Column count label for column views */}
          {!isSingleMode ? (
            <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 py-2 text-center text-xs text-muted-foreground">
              <span>
                {columnLayoutCount} column{columnLayoutCount !== 1 ? "s" : ""}
                {events.length > 0 ? ` · ~${columnLayoutPer} event${columnLayoutPer !== 1 ? "s" : ""} / column` : ""}
              </span>
              {chrome.columnChunkMode === "by-column-count" ? (
                <span className="text-[10px] opacity-90">Column count is fixed; the last column may have fewer events.</span>
              ) : (
                <span className="text-[10px] opacity-90">Events per column is fixed; the number of columns follows.</span>
              )}
            </div>
          ) : null}
        </div>
        {isSingleMode && !isH ? (
          <div
            className="pointer-events-none sticky bottom-0 z-[1] -mt-7 h-7 bg-gradient-to-t from-base-200/90 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
