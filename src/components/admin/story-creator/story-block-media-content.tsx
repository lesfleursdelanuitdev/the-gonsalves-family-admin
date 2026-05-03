"use client";

import { cn } from "@/lib/utils";
import {
  isLikelyAudioFile,
  isLikelyVideoFile,
  isPlayableAudioRef,
  isPlayableVideoRef,
  mediaThumbSrc,
  normalizeSiteMediaPath,
  preferNativeRasterImgPreview,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { isStoryMediaUnconfigured } from "@/lib/admin/story-creator/story-block-config-status";
import { effectiveMediaEmbedInspectorRowLayout, storyRowInnerTextAlignClass } from "@/lib/admin/story-creator/story-block-layout";
import { storyEmbedMediaFrameClassNames } from "@/lib/admin/story-creator/story-embed-frame-classes";
import { StoryAssetWithTitleCaption } from "@/lib/admin/story-creator/story-block-text-layout";
import type { StoryMediaBlock } from "@/lib/admin/story-creator/story-types";
import { useStoryMediaById } from "@/hooks/useStoryMediaById";
import { Button } from "@/components/ui/button";
import { ImageIcon, Settings } from "lucide-react";

export type MediaBlockContentVariant = "editor" | "preview";

const THUMB_W = { editor: 280, preview: 720 } as const;

/**
 * Shared media block body: library asset, title/caption layout, height preset, and row text alignment.
 * Used by the editor canvas and preview so both stay in sync.
 */
export function MediaBlockContentRenderer({
  block,
  variant,
  compact,
  onConfigure,
}: {
  block: StoryMediaBlock;
  variant: MediaBlockContentVariant;
  compact?: boolean;
  onConfigure?: () => void;
}) {
  const { data, isLoading } = useStoryMediaById(block.mediaId);
  const alignClass = storyRowInnerTextAlignClass(effectiveMediaEmbedInspectorRowLayout(block));
  const isEditor = variant === "editor";
  const thumbW = isEditor ? THUMB_W.editor : THUMB_W.preview;

  const labelTrim = block.label?.trim() ?? "";
  const captionTrim = block.caption?.trim() ?? "";

  const titleDisplay = labelTrim || (isEditor ? "Untitled media" : "");
  const captionDisplay = captionTrim || (isEditor ? "No caption" : "");

  const showTitleSlot = isEditor || Boolean(labelTrim);
  const showCaptionSlot = isEditor || Boolean(captionTrim);

  if (compact && isEditor && isStoryMediaUnconfigured(block) && onConfigure) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/30 py-2 pl-2 pr-2 ring-1 ring-base-content/[0.04] sm:gap-2.5 sm:pl-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-base-content/10 bg-base-100/50">
          <ImageIcon className="size-4 text-base-content/35" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-base-content">Media</p>
          <p className="mt-0.5 text-[11px] leading-snug text-base-content/50">No media selected</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
        >
          Choose media
        </Button>
      </div>
    );
  }

  const fileRef = data?.fileRef?.trim() ? data.fileRef : "";
  const form = data?.form ?? null;
  const thumb =
    fileRef !== "" ? mediaThumbSrc(fileRef, form, thumbW) ?? resolveMediaImageSrc(fileRef) : null;
  const directSrc = fileRef ? resolveMediaImageSrc(fileRef) : null;
  const normalizedRef = fileRef ? normalizeSiteMediaPath(fileRef).trim() : "";
  const streamSrc = normalizedRef && (normalizedRef.startsWith("/") || normalizedRef.startsWith("http")) ? normalizedRef : null;
  const alt = labelTrim || data?.title?.trim() || "Story media";
  const nativeImg = fileRef ? preferNativeRasterImgPreview(fileRef, form) : false;

  const videoOk = Boolean(fileRef && isLikelyVideoFile(fileRef, form) && isPlayableVideoRef(fileRef));
  const audioOk = Boolean(fileRef && isLikelyAudioFile(fileRef, form) && isPlayableAudioRef(fileRef));
  const videoSrc = videoOk ? directSrc ?? streamSrc : null;
  const audioSrc = audioOk ? directSrc ?? streamSrc : null;

  const assetInner =
    videoOk && videoSrc ? (
      <video src={videoSrc} className="h-full w-full object-cover" controls playsInline preload="metadata" />
    ) : audioOk && audioSrc ? (
      <audio src={audioSrc} className="w-full" controls preload="metadata" />
    ) : thumb ? (
      nativeImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview; HEIC etc.
        <img src={thumb} alt={alt} className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumb API
        <img src={thumb} alt={alt} className="h-full w-full object-cover" />
      )
    ) : (
      <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-1 p-3 text-center text-xs leading-snug text-base-content/45">
        {isLoading && block.mediaId ? (
          <span>Loading preview…</span>
        ) : isEditor ? (
          <span>No media selected — use the inspector to pick a file.</span>
        ) : (
          <span className="text-base-content/40">No media attached</span>
        )}
      </div>
    );

  const asset = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200/45 ring-1 ring-base-content/[0.06]",
        storyEmbedMediaFrameClassNames(block.heightPreset),
        "w-full max-w-full",
      )}
    >
      {assetInner}
    </div>
  );

  const titleNode = showTitleSlot ? (
    <p className="text-sm font-semibold tracking-tight text-base-content">{titleDisplay}</p>
  ) : null;

  const captionNode = showCaptionSlot ? (
    <p className={cn("text-xs leading-relaxed", isEditor ? "text-base-content/50" : "text-base-content/60")}>{captionDisplay}</p>
  ) : null;

  return (
    <figure className={cn("min-w-0", alignClass)}>
      <div className="flex min-w-0 flex-col gap-3">
        <StoryAssetWithTitleCaption
          titlePlacement={block.titlePlacement}
          captionPlacement={block.captionPlacement}
          titleClassName="min-w-0 max-w-full sm:max-w-[min(100%,22rem)]"
          captionClassName="min-w-0 max-w-full sm:max-w-[min(100%,22rem)]"
          asset={asset}
          title={titleNode}
          caption={captionNode}
        />
        {isEditor && isStoryMediaUnconfigured(block) && onConfigure ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 min-h-[44px] w-fit gap-2 rounded-xl border-base-content/12 px-4 text-sm font-medium lg:h-9 lg:min-h-0 lg:rounded-lg lg:px-3"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
          >
            <Settings className="size-3.5 opacity-90" aria-hidden />
            Configure media
          </Button>
        ) : null}
      </div>
    </figure>
  );
}
