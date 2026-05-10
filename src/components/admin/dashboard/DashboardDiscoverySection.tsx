"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { DashboardDiscoveryItem } from "@/lib/admin/admin-dashboard-snapshot";
import { mediaThumbSrc, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";

type Props = {
  items: DashboardDiscoveryItem[];
  isLoading: boolean;
};

function DiscoveryImage({ item }: { item: DashboardDiscoveryItem }) {
  const src =
    item.imageFileRef != null && item.imageFileRef !== ""
      ? mediaThumbSrc(item.imageFileRef, item.imageForm, 320) ?? resolveMediaImageSrc(item.imageFileRef)
      : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
      />
    );
  }

  return (
    <div
      className="absolute inset-0 bg-gradient-to-br from-base-300/90 via-base-200/60 to-primary/25"
      aria-hidden
    />
  );
}

export function DashboardDiscoverySection({ items, isLoading }: Props) {
  if (isLoading) {
    return (
      <section aria-label="Recently discovered" className="w-full min-w-0 space-y-4">
        <div className="skeleton h-6 w-56 rounded" />
        <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton min-h-52 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="discovery-heading" className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary/80" aria-hidden />
        <h2 id="discovery-heading" className="font-heading text-lg font-semibold tracking-tight text-base-content">
          Recently discovered
        </h2>
      </div>
      <p className="max-w-2xl text-sm text-base-content/65">
        Small moments of progress — surfaced from your latest edits, media, and open questions.
      </p>

      <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 pt-1">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              "group relative flex min-h-[13rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-base-content/[0.1]",
              "bg-base-200/40 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.55)]",
            )}
          >
            <div className="relative h-36 w-full overflow-hidden">
              <DiscoveryImage item={item} />
              <div className="absolute inset-0 bg-gradient-to-t from-base-300/95 via-base-300/20 to-transparent" />
            </div>
            <div className="relative flex flex-1 flex-col gap-2 p-4 pt-3">
              <h3 className="font-heading text-sm font-semibold leading-snug text-base-content">{item.title}</h3>
              <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-base-content/65">{item.description}</p>
              <Link
                href={item.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {item.ctaLabel}
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
