"use client";

import { Timeline as TimelineBase } from "@ligneous/timeline-view";
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";

function adminResolveImageSrc(fileRef: string): string | null {
  const src = resolveMediaImageSrc(fileRef);
  return isLikelyRasterImage(fileRef, "", null) ? src : null;
}

function adminRenderEventLink(eventId: string, children: ReactNode) {
  return (
    <Link
      href={`/admin/events/${eventId}`}
      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

export function Timeline(props: ComponentProps<typeof TimelineBase>) {
  return (
    <TimelineBase
      {...props}
      resolveImageSrc={props.resolveImageSrc ?? adminResolveImageSrc}
      renderEventLink={props.renderEventLink ?? adminRenderEventLink}
    />
  );
}
