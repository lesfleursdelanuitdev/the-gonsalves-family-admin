"use client";

import Image from "next/image";
import { Check, FileImage, FileText, Film } from "lucide-react";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  mediaImageUnoptimized,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { cn } from "@/lib/utils";

function mediaRowKind(m: AdminMediaListItem): "photo" | "document" | "video" {
  const form = (m.form ?? "").toLowerCase();
  if (form.includes("video") || form === "video") return "video";
  if (form.includes("doc") || form === "document") return "document";
  return "photo";
}

const kindIcon = {
  photo: FileImage,
  document: FileText,
  video: Film,
} as const;

export function MediaCard({
  media,
  selected,
  disabled,
  onToggle,
}: {
  media: AdminMediaListItem;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const fileRef = (media.fileRef ?? "").trim();
  const title =
    (media.title ?? "").trim() ||
    (fileRef ? fileRef.split("/").pop() ?? "" : "").trim() ||
    "Media";
  const kind = mediaRowKind(media);
  const Icon = kindIcon[kind];
  const src = resolveMediaImageSrc(fileRef);
  const showThumb = Boolean(src && isLikelyRasterImage(fileRef, media.form ?? "", null));
  const showVideoPeek =
    Boolean(src) && !showThumb && isLikelyVideoFile(fileRef, media.form ?? "") && isPlayableVideoRef(fileRef);

  const firstAlbum = media.albumLinks?.[0]?.album?.name?.trim();
  const tagHint = media.appTags?.[0]?.tag?.name ? displayTagName(media.appTags[0].tag.name) : "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-box border text-left shadow-sm shadow-black/10 transition",
        "border-base-content/12 bg-base-100/90 hover:border-primary/35 hover:shadow-md",
        selected && "border-primary ring-2 ring-primary/30 bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-content shadow-md">
          <Check size={16} className="shrink-0" aria-hidden />
        </span>
      ) : null}
      <div className="relative aspect-square w-full bg-base-200/50">
        {showThumb && src ? (
          <Image
            src={src}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, 180px"
            className="object-contain p-1"
            unoptimized={mediaImageUnoptimized(src)}
          />
        ) : showVideoPeek && src ? (
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain p-1"
            aria-hidden
          />
        ) : (
          <div className="flex h-full min-h-[5rem] flex-col items-center justify-center gap-1 p-2">
            <Icon size={28} className="text-muted-foreground shrink-0" aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full border border-base-content/10 bg-base-100/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/80">
          {kind === "photo" ? "Photo" : kind === "video" ? "Video" : "Doc"}
        </span>
      </div>
      <div className="min-w-0 space-y-0.5 border-t border-base-content/10 p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-base-content">{title}</p>
        {firstAlbum ? (
          <p className="line-clamp-1 text-[10px] text-muted-foreground">{firstAlbum}</p>
        ) : tagHint ? (
          <p className="line-clamp-1 text-[10px] text-muted-foreground">{tagHint}</p>
        ) : (
          <p className="text-[10px] text-muted-foreground/70">Archive</p>
        )}
      </div>
    </button>
  );
}
