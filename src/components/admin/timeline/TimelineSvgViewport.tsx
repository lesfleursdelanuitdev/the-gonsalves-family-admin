"use client";

import { TimelineSvgViewport as TimelineSvgViewportBase } from "@ligneous/timeline-view";
import type { ComponentProps, ReactNode } from "react";
import { isLikelyRasterImage, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import Link from "next/link";

function adminResolveImageSrc(fileRef: string): string | null {
  const src = resolveMediaImageSrc(fileRef);
  return isLikelyRasterImage(fileRef, "", null) ? src : null;
}

export function TimelineSvgViewport(props: ComponentProps<typeof TimelineSvgViewportBase>) {
  return (
    <TimelineSvgViewportBase
      {...props}
      resolveImageSrc={props.resolveImageSrc ?? adminResolveImageSrc}
      renderEventLink={
        props.renderEventLink ??
        ((eventId: string, children: ReactNode) => (
          <Link href={`/admin/events/${eventId}`}>{children}</Link>
        ))
      }
    />
  );
}
