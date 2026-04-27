"use client";

import Image from "next/image";
import { mediaImageUnoptimized, preferNativeRasterImgPreview } from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";

/**
 * Raster preview for admin media: uses native `<img>` for HEIC/HEIF (common on iPhones) where Next/Image and
 * Chromium often fail; otherwise `next/image` with existing unoptimized rules for `/uploads/`.
 */
export function MediaRasterImage({
  fileRef,
  form,
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
}: {
  fileRef: string;
  form: string;
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  /** Hero / LCP: eager load + high fetch priority for native img; `priority` on next/image when used. */
  priority?: boolean;
}) {
  const imgLoadProps = priority
    ? ({ fetchPriority: "high" as const, loading: "eager" as const } as const)
    : ({ loading: "lazy" as const, decoding: "async" as const } as const);

  if (preferNativeRasterImgPreview(fileRef, form)) {
    if (fill) {
      return (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          className={cn("absolute inset-0 h-full w-full", className)}
          {...imgLoadProps}
        />
      );
    }
    return <img src={src} alt={alt} className={className} {...imgLoadProps} />;
  }
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "(max-width: 768px) 100vw, 40vw"}
        className={className}
        unoptimized={mediaImageUnoptimized(src)}
      />
    );
  }
  return <img src={src} alt={alt} className={className} {...imgLoadProps} />;
}
