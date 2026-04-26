"use client";

import Image from "next/image";
import { Upload } from "lucide-react";
import { mediaImageUnoptimized } from "@/lib/admin/mediaPreview";

export type MediaEditorPreviewSectionProps = {
  showImagePreview: boolean;
  showVideoPreview: boolean;
  imagePreviewSrc: string | null;
};

export function MediaEditorPreviewSection({
  showImagePreview,
  showVideoPreview,
  imagePreviewSrc,
}: MediaEditorPreviewSectionProps) {
  return (
    <section
      aria-label="Media preview"
      className="overflow-hidden rounded-box border border-base-content/10 bg-base-200/30"
    >
      {showImagePreview && imagePreviewSrc ? (
        <div className="relative mx-auto aspect-video max-h-[min(50vh,28rem)] w-full max-w-3xl">
          <Image
            key={imagePreviewSrc}
            src={imagePreviewSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain p-2"
            unoptimized={mediaImageUnoptimized(imagePreviewSrc)}
          />
        </div>
      ) : showVideoPreview && imagePreviewSrc ? (
        <div className="mx-auto max-w-3xl p-4">
          <video
            key={imagePreviewSrc}
            src={imagePreviewSrc}
            controls
            playsInline
            className="max-h-[min(50vh,28rem)] w-full rounded-md"
          />
        </div>
      ) : (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <Upload className="size-10 opacity-40" aria-hidden />
          <p>No visual preview yet. Upload an image or video, or set a playable file reference.</p>
        </div>
      )}
    </section>
  );
}
