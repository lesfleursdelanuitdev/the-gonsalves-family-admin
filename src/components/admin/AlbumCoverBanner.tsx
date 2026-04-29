"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";

function coverThumbSrc(coverFileRef: string | null, coverForm: string | null): string | null {
  const ref = (coverFileRef ?? "").trim();
  const form = coverForm ?? "";
  if (!ref || !isLikelyRasterImage(ref, form, null)) return null;
  return resolveMediaImageSrc(ref);
}

export type AlbumCoverBannerProps = {
  name: string;
  coverMediaId: string | null;
  coverFileRef: string | null;
  coverForm: string | null;
  isPublic: boolean;
  /** Show link to open the cover media record (admin). */
  showCoverMediaLink?: boolean;
  className?: string;
};

/**
 * Facebook-style album header: wide cover image, then a light bar with an
 * overlapping “profile” tile and the album title + visibility.
 * Horizontal bleed matches padded admin `main` (see class names).
 */
export function AlbumCoverBanner({
  name,
  coverMediaId,
  coverFileRef,
  coverForm,
  isPublic,
  showCoverMediaLink = true,
  className,
}: AlbumCoverBannerProps) {
  const thumbSrc = coverThumbSrc(coverFileRef, coverForm);
  const form = coverForm ?? "";
  const alt = `Cover media for ${name}`;

  return (
    <div
      className={cn(
        "-mx-4 -mt-4 mb-1 w-[calc(100%+2rem)] md:-mx-6 md:-mt-6 md:mb-2 md:w-[calc(100%+3rem)] lg:-mx-8 lg:-mt-8 lg:mb-3 lg:w-[calc(100%+4rem)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-b-2xl border border-base-content/10 bg-base-100 shadow-md sm:rounded-b-3xl">
        <div className="relative aspect-[820/312] w-full min-h-[140px] max-h-[280px] sm:min-h-[160px] sm:max-h-[300px]">
          {thumbSrc ? (
            <MediaRasterImage
              fileRef={(coverFileRef ?? "").trim()}
              form={form}
              src={thumbSrc}
              alt={alt}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-base-200 via-base-300/90 to-base-300 text-muted-foreground">
              <FolderOpen className="size-14 opacity-35" aria-hidden />
              <span className="max-w-md px-4 text-center text-sm font-medium opacity-70">
                {coverMediaId ? "No raster preview for this cover file type." : "No cover media yet"}
              </span>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent"
            aria-hidden
          />
          {coverMediaId && showCoverMediaLink ? (
            <Link
              href={`/admin/media/${coverMediaId}`}
              className="absolute right-3 top-3 z-[1] rounded-lg border border-white/25 bg-black/45 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Open cover media
            </Link>
          ) : null}
        </div>

        <div className="relative flex items-end gap-3 border-t border-base-content/10 bg-base-100 px-4 pb-4 pt-2 sm:gap-4 sm:px-6 sm:pb-5 md:px-8">
          <div
            className="-mt-11 flex size-[4.5rem] shrink-0 items-center justify-center rounded-2xl border-4 border-base-100 bg-gradient-to-br from-base-200 to-base-300 shadow-lg ring-1 ring-black/10 sm:-mt-12 sm:size-[5.25rem] md:size-24 md:border-[5px]"
            aria-hidden
          >
            <FolderOpen className="size-9 text-base-content/50 sm:size-10 md:size-11" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 pb-0.5 pt-1">
            <h2 className="text-balance text-xl font-bold tracking-tight text-base-content sm:text-2xl md:text-3xl">
              {name}
            </h2>
            <span className="inline-flex rounded-full border border-base-content/10 bg-base-200/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isPublic ? "Public album" : "Personal album"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
