"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";

export type AlbumCoverImageProps = {
  name: string;
  coverMediaId: string | null;
  coverFileRef: string | null;
  coverForm: string | null;
  /** Card grid vs. edit page preview */
  variant?: "card" | "detail";
  className?: string;
};

function albumCoverThumbSrc(coverFileRef: string | null, coverForm: string | null): string | null {
  const ref = (coverFileRef ?? "").trim();
  const form = coverForm ?? "";
  if (!ref || !isLikelyRasterImage(ref, form, null)) return null;
  return resolveMediaImageSrc(ref);
}

export function AlbumCoverImage({
  name,
  coverMediaId,
  coverFileRef,
  coverForm,
  variant = "card",
  className,
}: AlbumCoverImageProps) {
  const thumbSrc = albumCoverThumbSrc(coverFileRef, coverForm);
  const isCard = variant === "card";
  const alt = `Cover for ${name}`;

  const form = coverForm ?? "";
  const innerImage = thumbSrc ? (
    <MediaRasterImage
      fileRef={(coverFileRef ?? "").trim()}
      form={form}
      src={thumbSrc}
      alt={alt}
      fill
      sizes={isCard ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" : "(max-width: 768px) 100vw, 28rem"}
      className="object-cover transition-transform duration-500 ease-out will-change-transform motion-safe:group-hover:scale-110 motion-reduce:transition-none"
    />
  ) : (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground",
        isCard ? "min-h-[7rem] py-6" : "min-h-32 py-8",
      )}
    >
      <FolderOpen className={cn("shrink-0 opacity-55", isCard ? "size-11" : "size-12")} aria-hidden />
      <span className="max-w-[14rem] text-xs font-medium leading-snug">
        {coverMediaId ? "Cover set — preview not available for this file type." : "No cover image"}
      </span>
    </div>
  );

  const shell = (
    <div
      className={cn(
        "group relative w-full shrink-0 overflow-hidden bg-gradient-to-b from-base-200/70 to-base-300/35",
        isCard
          ? "aspect-[4/3] border-b border-base-content/10"
          : "aspect-video max-w-md rounded-md border border-base-content/10",
        className,
      )}
    >
      {innerImage}
    </div>
  );

  if (coverMediaId) {
    return (
      <Link
        href={`/admin/media/${coverMediaId}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {shell}
      </Link>
    );
  }

  return shell;
}
