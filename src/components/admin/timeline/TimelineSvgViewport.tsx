"use client";

import { useId, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { timelineBodyToSafeHtml } from "@/lib/timeline/timeline-body-html";
import { timelineCardColors, type TimelineCardColorSet } from "@/lib/timeline/timeline-card-colors";
import {
  friendlyTimelineDescription,
  type TimelineSubject,
} from "@/lib/timeline/timeline-friendly-description";
import {
  placeLine,
  stripHtmlToPlainText,
  timelineGlyphForEvent,
  typeLabel,
} from "@/lib/timeline/timeline-event-display";
import type { TimelineChromeOnly } from "@/lib/timeline/timeline-url-state";

/* -- layout constants (mirror HTML/CSS card chrome; card width comes from `chrome.cardWidthPx`) -- */
const HEADER_H = 28;
const HEADER_PAD_X = 10;
const BODY_PAD_X = 10;
const BODY_PAD_Y = 8;
const RADIUS = 8;
const IMAGE_H = 176;
const IMAGE_BORDER_R = 6;
const IMAGE_INNER_PAD = 2;
const SPINE_GAP_FROM_CARD = 16;
const DOT_R = 7;
const ROW_VGAP = 10;
const COL_HGAP = 18;
const CARD_TO_DOT_PAD = 4;

const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/* -- text styles, mirroring the Tailwind classes on the HTML cards -- */
type TextBlockStyle = {
  size: number;
  lh: number;
  weight: number;
  fill: string;
  italic?: boolean;
  underline?: boolean;
  mt: number;
  mb: number;
};

const STYLE_PLACE: TextBlockStyle = {
  size: 10, lh: 14, weight: 400, fill: "var(--muted-foreground)", mt: 0, mb: 4,
};
const STYLE_FRIENDLY: TextBlockStyle = {
  size: 11, lh: 15, weight: 500, fill: "var(--foreground)", mt: 0, mb: 4,
};
const STYLE_VALUE: TextBlockStyle = {
  size: 11, lh: 15, weight: 400, fill: "var(--foreground)", mt: 0, mb: 4,
};
const STYLE_LINK: TextBlockStyle = {
  size: 12, lh: 16, weight: 500, fill: "var(--primary)", underline: true, mt: 8, mb: 0,
};

function fontStr(weight: number, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

type Measurer = (text: string, font: string) => number;

function makeMeasurer(): Measurer {
  if (typeof document === "undefined") {
    return (text, font) => {
      const m = font.match(/(\d+)px/);
      const px = m ? Number(m[1]) : 11;
      return text.length * px * 0.55;
    };
  }
  const ctx = document.createElement("canvas").getContext("2d");
  return (text, font) => {
    if (!ctx) return text.length * 6.5;
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

function wrapText(
  text: string,
  maxWidth: number,
  weight: number,
  fontPx: number,
  measure: Measurer,
): string[] {
  if (!text) return [];
  const font = fontStr(weight, fontPx);
  const out: string[] = [];
  const paragraphs = text.split(/\n+/);
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const words = para.split(/\s+/);
    let curr = "";
    for (const w of words) {
      const test = curr ? `${curr} ${w}` : w;
      if (measure(test, font) <= maxWidth) {
        curr = test;
      } else {
        if (curr) out.push(curr);
        if (measure(w, font) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            const t2 = chunk + ch;
            if (measure(t2, font) <= maxWidth) chunk = t2;
            else {
              if (chunk) out.push(chunk);
              chunk = ch;
            }
          }
          curr = chunk;
        } else {
          curr = w;
        }
      }
    }
    if (curr) out.push(curr);
  }
  return out;
}

type CardBlock =
  | { kind: "image"; src: string; height: number }
  | { kind: "text"; lines: string[]; style: TextBlockStyle };

type CardLayout = {
  event: IndividualDetailEvent;
  index: number;
  side: "start" | "end";
  width: number;
  height: number;
  blocks: CardBlock[];
  colors: TimelineCardColorSet;
  glyph: LucideIcon;
  type: string;
  date: string;
};

function computeCard(
  e: IndividualDetailEvent,
  index: number,
  side: "start" | "end",
  cardW: number,
  showImages: boolean,
  timelineSubject: TimelineSubject,
  measure: Measurer,
): CardLayout {
  const colors = timelineCardColors(e.eventType, e.customType);
  const glyph = timelineGlyphForEvent(e);
  const type = typeLabel(e);
  const date = formatEventDate(e);
  const innerW = cardW - 2 * BODY_PAD_X;

  const blocks: CardBlock[] = [];
  const imgRef = e.previewMediaFileRef;
  if (showImages && imgRef && isLikelyRasterImage(imgRef, "", null)) {
    const src = resolveMediaImageSrc(imgRef);
    if (src) blocks.push({ kind: "image", src, height: IMAGE_H });
  }

  const place = placeLine(e);
  if (place) {
    const lines = wrapText(place, innerW, STYLE_PLACE.weight, STYLE_PLACE.size, measure);
    blocks.push({ kind: "text", lines, style: STYLE_PLACE });
  }

  const friendly = friendlyTimelineDescription(e, timelineSubject);
  if (friendly) {
    const lines = wrapText(friendly, innerW, STYLE_FRIENDLY.weight, STYLE_FRIENDLY.size, measure);
    blocks.push({ kind: "text", lines, style: STYLE_FRIENDLY });
  }

  if (e.value?.trim()) {
    const plain = stripHtmlToPlainText(timelineBodyToSafeHtml(e.value));
    if (plain) {
      const lines = wrapText(plain, innerW, STYLE_VALUE.weight, STYLE_VALUE.size, measure);
      if (lines.length > 0) blocks.push({ kind: "text", lines, style: STYLE_VALUE });
    }
  }

  if (e.eventId) {
    blocks.push({ kind: "text", lines: ["Open event"], style: STYLE_LINK });
  }

  let bodyHeight = BODY_PAD_Y * 2;
  blocks.forEach((b, i) => {
    if (i > 0) bodyHeight += b.kind === "text" ? b.style.mt : 8;
    if (b.kind === "image") {
      bodyHeight += b.height;
      if (i < blocks.length - 1) bodyHeight += 8;
    } else {
      bodyHeight += b.lines.length * b.style.lh;
      if (i < blocks.length - 1) bodyHeight += b.style.mb;
    }
  });

  const height = HEADER_H + bodyHeight;
  return { event: e, index, side, width: cardW, height, blocks, colors, glyph, type, date };
}

/** Path for a rectangle with only the top corners rounded, used to fill the card header. */
function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number) {
  return [
    `M${x + r},${y}`,
    `L${x + w - r},${y}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    `L${x},${y + h}`,
    `L${x},${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    "Z",
  ].join(" ");
}

function CardHeaderContent({ d, x, y, measure }: { d: CardLayout; x: number; y: number; measure: Measurer }) {
  const Glyph = d.glyph;
  const c = d.colors;

  const glyphSize = 14;
  const glyphX = x + HEADER_PAD_X;
  const glyphY = y + (HEADER_H - glyphSize) / 2;

  const badgeFontSize = 9;
  const badgeWeight = 600;
  const badgeText = d.type.toUpperCase();
  const badgeTextWidth = measure(badgeText, fontStr(badgeWeight, badgeFontSize));
  const badgePadX = 6;
  const badgePadY = 2;
  const badgeH = badgeFontSize + badgePadY * 2 + 1;
  const badgeW = badgeTextWidth + badgePadX * 2 + 2;
  const badgeX = glyphX + glyphSize + 6;
  const badgeY = y + (HEADER_H - badgeH) / 2;

  const dateFontSize = 11;
  const dateWeight = 700;
  const dateX = x + d.width - HEADER_PAD_X;
  const dateY = y + HEADER_H / 2;

  return (
    <g>
      <Glyph
        x={glyphX}
        y={glyphY}
        width={glyphSize}
        height={glyphSize}
        color={c.m}
        opacity={0.9}
        strokeWidth={2}
        aria-hidden
      />
      <rect
        x={badgeX}
        y={badgeY}
        width={badgeW}
        height={badgeH}
        rx={3}
        ry={3}
        fill={c.m}
        fillOpacity={0.16}
      />
      <text
        x={badgeX + badgePadX}
        y={badgeY + badgeH / 2}
        fontFamily={FONT_FAMILY}
        fontSize={badgeFontSize}
        fontWeight={badgeWeight}
        fill={c.m}
        dominantBaseline="central"
        style={{ letterSpacing: "0.04em" }}
      >
        {badgeText}
      </text>
      <text
        x={dateX}
        y={dateY}
        textAnchor="end"
        fontFamily={FONT_FAMILY}
        fontSize={dateFontSize}
        fontWeight={dateWeight}
        fill={c.m}
        dominantBaseline="central"
      >
        {d.date}
      </text>
    </g>
  );
}

function CardBodyContent({ d, x, y }: { d: CardLayout; x: number; y: number }) {
  const innerX = x + BODY_PAD_X;
  let cy = y + BODY_PAD_Y;
  const innerW = d.width - 2 * BODY_PAD_X;

  const nodes: React.ReactNode[] = [];

  d.blocks.forEach((b, i) => {
    if (i > 0) cy += b.kind === "text" ? b.style.mt : 8;
    if (b.kind === "image") {
      nodes.push(
        <g key={`b-${i}`}>
          <rect
            x={innerX}
            y={cy}
            width={innerW}
            height={b.height}
            rx={IMAGE_BORDER_R}
            ry={IMAGE_BORDER_R}
            strokeWidth={1}
            style={{ fill: "var(--surface-2)", fillOpacity: 0.4, stroke: "var(--border)" }}
          />
          <image
            href={b.src}
            x={innerX + IMAGE_INNER_PAD}
            y={cy + IMAGE_INNER_PAD}
            width={innerW - 2 * IMAGE_INNER_PAD}
            height={b.height - 2 * IMAGE_INNER_PAD}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>,
      );
      cy += b.height;
      if (i < d.blocks.length - 1) cy += 8;
      return;
    }

    const isLink = b.style === STYLE_LINK;
    const lineEls = b.lines.map((line, li) => (
      <text
        key={li}
        x={innerX}
        y={cy + li * b.style.lh + b.style.size}
        fontFamily={FONT_FAMILY}
        fontSize={b.style.size}
        fontWeight={b.style.weight}
        style={{
          fill: b.style.fill,
          textDecoration: b.style.underline ? "underline" : undefined,
        }}
      >
        {line}
      </text>
    ));

    if (isLink && d.event.eventId) {
      nodes.push(
        <a key={`b-${i}`} href={`/admin/events/${d.event.eventId}`}>
          {lineEls}
        </a>,
      );
    } else {
      nodes.push(<g key={`b-${i}`}>{lineEls}</g>);
    }
    cy += b.lines.length * b.style.lh;
    if (i < d.blocks.length - 1) cy += b.style.mb;
  });

  return <>{nodes}</>;
}

function Card({ d, x, y, measure }: { d: CardLayout; x: number; y: number; measure: Measurer }) {
  const c = d.colors;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={d.width}
        height={d.height}
        rx={RADIUS}
        ry={RADIUS}
        stroke={c.m}
        strokeOpacity={0.4}
        strokeWidth={1}
        style={{ fill: "var(--card)" }}
      />
      <path d={roundedTopRectPath(x, y, d.width, HEADER_H, RADIUS)} fill={c.bg} />
      <line
        x1={x}
        y1={y + HEADER_H}
        x2={x + d.width}
        y2={y + HEADER_H}
        stroke={c.m}
        strokeOpacity={0.4}
        strokeWidth={1}
      />
      <CardHeaderContent d={d} x={x} y={y} measure={measure} />
      <CardBodyContent d={d} x={x} y={y + HEADER_H} />
    </g>
  );
}

function pickSide(
  index: number,
  isH: boolean,
  vStyle: TimelineChromeOnly["vStyle"],
  hStyle: TimelineChromeOnly["hStyle"],
): "start" | "end" {
  if (isH) {
    if (hStyle === "staggered") return index % 2 === 0 ? "start" : "end";
    return hStyle === "top" ? "start" : "end";
  }
  if (vStyle === "staggered") return index % 2 === 0 ? "start" : "end";
  return vStyle === "left" ? "start" : "end";
}

export type TimelineSvgViewportProps = {
  events: IndividualDetailEvent[];
  chrome: TimelineChromeOnly;
  timelineSubject: TimelineSubject;
  isH: boolean;
  /** Scrollport inner width in CSS px (measured); used for vertical spine layout instead of `chrome.widthPx`. */
  viewportInnerWidthPx: number;
};

export function TimelineSvgViewport({
  events,
  chrome,
  timelineSubject,
  isH,
  viewportInnerWidthPx,
}: TimelineSvgViewportProps) {
  const measureRef = useRef<Measurer | null>(null);
  if (!measureRef.current) measureRef.current = makeMeasurer();
  const measure = measureRef.current;

  const cards = useMemo<CardLayout[]>(() => {
    const cardW = chrome.cardWidthPx;
    return events.map((e, i) =>
      computeCard(
        e,
        i,
        pickSide(i, isH, chrome.vStyle, chrome.hStyle),
        cardW,
        chrome.showImages,
        timelineSubject,
        measure,
      ),
    );
  }, [events, isH, chrome.cardWidthPx, chrome.vStyle, chrome.hStyle, chrome.showImages, timelineSubject, measure]);

  if (cards.length === 0) {
    return null;
  }

  if (isH) {
    return <HorizontalSvg cards={cards} chrome={chrome} measure={measure} />;
  }
  return <VerticalSvg cards={cards} chrome={chrome} measure={measure} viewportInnerWidthPx={viewportInnerWidthPx} />;
}

/* -------- vertical layout -------- */

function VerticalSvg({
  cards,
  chrome,
  measure,
  viewportInnerWidthPx,
}: {
  cards: CardLayout[];
  chrome: TimelineChromeOnly;
  measure: Measurer;
  viewportInnerWidthPx: number;
}) {
  const cardW = chrome.cardWidthPx;
  const W = Math.max(viewportInnerWidthPx - 16, cardW * 2 + SPINE_GAP_FROM_CARD * 2 + DOT_R * 2 + 8);
  const spineX = W / 2;
  const cardLeftX = spineX - SPINE_GAP_FROM_CARD - cardW;
  const cardRightX = spineX + SPINE_GAP_FROM_CARD;

  let cy = 0;
  const placed = cards.map((d) => {
    const top = cy;
    const dotY = cy + d.height / 2;
    const x = d.side === "start" ? cardLeftX : cardRightX;
    cy += d.height + ROW_VGAP;
    return { d, x, y: top, dotY };
  });
  const H = Math.max(0, cy - ROW_VGAP);
  const gradPrefix = useId().replace(/:/g, "");

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Timeline (SVG)"
      style={{ display: "block", margin: "0 auto" }}
    >
      <defs>
        {placed.map((p, i) => {
          const next = placed[i + 1];
          if (!next) return null;
          const c = p.d.colors;
          const cNext = next.d.colors;
          const y1 = p.dotY + DOT_R;
          const y2 = next.dotY - DOT_R;
          return (
            <linearGradient
              key={`spine-grad-v-${i}`}
              id={`${gradPrefix}-v-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={spineX}
              y1={y1}
              x2={spineX}
              y2={y2}
            >
              <stop offset="0%" stopColor={c.m} stopOpacity={0.3} />
              <stop offset="100%" stopColor={cNext.m} stopOpacity={0.3} />
            </linearGradient>
          );
        })}
      </defs>
      {placed.map((p, i) => {
        const next = placed[i + 1];
        if (!next) return null;
        return (
          <line
            key={`spine-${i}`}
            x1={spineX}
            y1={p.dotY + DOT_R}
            x2={spineX}
            y2={next.dotY - DOT_R}
            stroke={`url(#${gradPrefix}-v-${i})`}
            strokeWidth={2}
          />
        );
      })}
      {placed.map((p, i) => (
        <g
          key={p.d.event.eventId ?? `ev-${i}-${p.d.event.sortOrder}-${p.d.event.eventType}`}
          data-tl-ani
          data-side={p.d.side}
        >
          <Card d={p.d} x={p.x} y={p.y} measure={measure} />
          <circle cx={spineX} cy={p.dotY} r={DOT_R - 1} fill={p.d.colors.m} />
        </g>
      ))}
    </svg>
  );
}

/* -------- horizontal layout -------- */

function HorizontalSvg({
  cards,
  chrome,
  measure,
}: {
  cards: CardLayout[];
  chrome: TimelineChromeOnly;
  measure: Measurer;
}) {
  const tallest = Math.max(...cards.map((c) => c.height), 0);
  const H = Math.max(chrome.heightPx - 16, tallest * 2 + SPINE_GAP_FROM_CARD * 2 + DOT_R * 2 + 8);
  const spineY = H / 2;

  let cx = 0;
  const placed = cards.map((d) => {
    const left = cx;
    const dotX = cx + d.width / 2;
    const y = d.side === "start" ? spineY - SPINE_GAP_FROM_CARD - d.height : spineY + SPINE_GAP_FROM_CARD;
    cx += d.width + COL_HGAP;
    return { d, x: left, y, dotX };
  });
  const W = Math.max(0, cx - COL_HGAP);
  const gradPrefix = useId().replace(/:/g, "");

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Timeline (SVG)"
      style={{ display: "block" }}
    >
      <defs>
        {placed.map((p, i) => {
          const next = placed[i + 1];
          if (!next) return null;
          const c = p.d.colors;
          const cNext = next.d.colors;
          const x1 = p.dotX + DOT_R;
          const x2 = next.dotX - DOT_R;
          return (
            <linearGradient
              key={`spine-grad-h-${i}`}
              id={`${gradPrefix}-h-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={x1}
              y1={spineY}
              x2={x2}
              y2={spineY}
            >
              <stop offset="0%" stopColor={c.m} stopOpacity={0.3} />
              <stop offset="100%" stopColor={cNext.m} stopOpacity={0.3} />
            </linearGradient>
          );
        })}
      </defs>
      {placed.map((p, i) => {
        const next = placed[i + 1];
        if (!next) return null;
        return (
          <line
            key={`spine-${i}`}
            x1={p.dotX + DOT_R}
            y1={spineY}
            x2={next.dotX - DOT_R}
            y2={spineY}
            stroke={`url(#${gradPrefix}-h-${i})`}
            strokeWidth={2}
          />
        );
      })}
      {placed.map((p, i) => (
        <g
          key={p.d.event.eventId ?? `ev-${i}-${p.d.event.sortOrder}-${p.d.event.eventType}`}
          data-tl-ani
          data-side={p.d.side}
        >
          <Card d={p.d} x={p.x} y={p.y} measure={measure} />
          <circle cx={p.dotX} cy={spineY} r={DOT_R - 1} fill={p.d.colors.m} />
        </g>
      ))}
    </svg>
  );
}
