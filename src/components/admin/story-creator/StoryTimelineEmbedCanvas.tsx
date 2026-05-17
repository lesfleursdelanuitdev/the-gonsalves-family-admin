"use client";

import { useCallback, useRef, useState } from "react";
import { Timeline } from "@/components/admin/timeline/Timeline";
import { useStoryTimelineEmbedData } from "@/hooks/useStoryTimelineEmbedData";
import { timelineUrlDefaults } from "@ligneous/timeline-view";
import type { TimelineChromeOnly } from "@ligneous/timeline-view";
import type { StoryEmbedBlock } from "@/lib/admin/story-creator/story-types";
import { storyTimelinePayloadFromEmbedBlock } from "@/lib/admin/story-creator/story-embed-semantics";

const HEIGHT_MIN = 300;
const HEIGHT_MAX = 800;
const HEIGHT_STEP = 20;

function snap(px: number): number {
  return Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, Math.round(px / HEIGHT_STEP) * HEIGHT_STEP));
}

type Props = {
  block: StoryEmbedBlock;
  isEditing?: boolean;
  onHeightChange?: (heightPx: number) => void;
  onPatchBlock?: (patch: Partial<StoryEmbedBlock>) => void;
};

export function StoryTimelineEmbedCanvas({ block, isEditing = false, onHeightChange }: Props) {
  const embed = storyTimelinePayloadFromEmbedBlock(block);
  const heightPx = embed.heightPx ?? 520;

  // Vertical single view is the only mode that supports a user-controlled container width.
  // Horizontal single and all multi-column views are always full-width.
  const isVerticalSingle =
    (embed.viewMode ?? "single") === "single" && (embed.orient ?? "vertical") === "vertical";
  const embedWidthPct = isVerticalSingle ? (block.embedWidthPct ?? 100) : 100;
  const embedAlign = block.embedAlign ?? "center";

  const data = useStoryTimelineEmbedData(embed);

  const [isDragging, setIsDragging] = useState(false);
  const [draftHeight, setDraftHeight] = useState(heightPx);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartY.current = e.clientY;
      dragStartH.current = heightPx;
      setDraftHeight(heightPx);
      setIsDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - dragStartY.current;
        setDraftHeight(snap(dragStartH.current + delta));
      };
      const onMouseUp = (ev: MouseEvent) => {
        const delta = ev.clientY - dragStartY.current;
        onHeightChange?.(snap(dragStartH.current + delta));
        setIsDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [heightPx, onHeightChange],
  );

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      dragStartY.current = touch.clientY;
      dragStartH.current = heightPx;
      setDraftHeight(heightPx);
      setIsDragging(true);

      const onTouchMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        if (!t) return;
        setDraftHeight(snap(dragStartH.current + (t.clientY - dragStartY.current)));
      };
      const onTouchEnd = (ev: TouchEvent) => {
        const t = ev.changedTouches[0];
        if (t) onHeightChange?.(snap(dragStartH.current + (t.clientY - dragStartY.current)));
        setIsDragging(false);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
      };
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
    },
    [heightPx, onHeightChange],
  );

  const displayHeight = isDragging ? draftHeight : heightPx;
  const timelineViewportHeight = Math.max(240, displayHeight);

  const d = timelineUrlDefaults;
  const previewWU = block.timelinePreviewWidthUnit ?? d.previewWidthUnit;

  const chrome: TimelineChromeOnly = {
    ...d,
    viewMode: embed.viewMode ?? "single",
    orient: embed.orient ?? "vertical",
    activeView: embed.activeView ?? "vertical",
    anim: embed.anim ?? "fade",
    vStyle: embed.vStyle ?? "staggered",
    hStyle: embed.hStyle ?? "staggered",
    heightPx: timelineViewportHeight,
    previewWidthUnit: previewWU,
    widthPx: block.timelineWidthPx ?? d.widthPx,
    widthPct: block.timelineWidthPct ?? d.widthPct,
    pag: false,
    perPage: embed.perPage ?? 8,
    page: 0,
    autoplayPxPerSec: embed.autoplayPxPerSec ?? 48,
    autoplayLoop: embed.autoplayLoop ?? true,
    showImages: embed.showImages ?? false,
    animRevealMinRatio: embed.animRevealMinRatio ?? 0.6,
    renderer: embed.renderer ?? "html",
    perCol: embed.perCol ?? 10,
    numColumns: embed.numColumns ?? 7,
    columnChunkMode: embed.columnChunkMode ?? "by-events-per-column",
    cardWidthPx: embed.cardWidthPx ?? 260,
    gapPx: embed.gapPx ?? 24,
    showArrows: embed.showArrows ?? true,
  };

  // Alignment via auto-margins: left=no left margin, center=both auto, right=no right margin.
  const containerStyle: React.CSSProperties = {
    width: `${embedWidthPct}%`,
    marginLeft: embedAlign === "left" ? 0 : "auto",
    marginRight: embedAlign === "right" ? 0 : "auto",
  };

  return (
    <div className="w-full">
      <div style={containerStyle}>
        <div className="relative w-full overflow-hidden rounded-xl border border-base-content/10">
          <div
            className="w-full overflow-auto"
            style={{ height: displayHeight }}
          >
            {data.status === "loading" ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading events...</div>
            ) : null}
            {data.status === "error" ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">{data.errorMessage}</div>
            ) : null}
            {data.status === "ready" && data.events.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No events found for this record.
              </div>
            ) : null}
            {data.status === "ready" && data.events.length > 0 ? (
              <Timeline
                events={data.events}
                chrome={chrome}
                onChromeChange={() => {}}
                timelineSubject={data.timelineSubject}
                hasAnyPreviewMedia={data.hasAnyPreviewMedia}
                showBuiltInPagination={false}
                showBuiltInOrientToggle={false}
                showBuiltInSettings={false}
                showAutoplayTransport={false}
                disableVpFrame
              />
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <div
            role="separator"
            aria-label="Drag to resize timeline height"
            className="relative flex h-3 w-full cursor-ns-resize select-none items-center justify-center"
            onMouseDown={handleResizeMouseDown}
            onTouchStart={handleResizeTouchStart}
          >
            <div className="h-1 w-full rounded-full bg-base-content/15 transition-colors hover:bg-primary/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground opacity-60">
              <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden>
                <line x1="0" y1="2" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            {isDragging ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-base-content/20 bg-base-100 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm">
                {draftHeight}px
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
