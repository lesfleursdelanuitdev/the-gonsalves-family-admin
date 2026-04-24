"use client";

import Image from "next/image";
import Link from "next/link";
import { FileImage } from "lucide-react";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  mediaImageUnoptimized,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { cn } from "@/lib/utils";

export type AssociatedMediaGridItem = {
  media: Record<string, unknown>;
};

function pickMediaFields(m: Record<string, unknown>) {
  const id = String(m.id ?? "");
  const fileRef = String(m.fileRef ?? "").trim();
  const form = String(m.form ?? "");
  const title = (String(m.title ?? "").trim() || String(m.fileRef ?? "").trim() || "Media").trim() || "Media";
  const description = String(m.description ?? "").trim();
  const xref = String(m.xref ?? "").trim();
  return { id, fileRef, form, title, description, xref };
}

type AppTagPill = { key: string; name: string; color: string | null };

function parseAppTagPills(media: Record<string, unknown>): AppTagPill[] {
  const raw = media.appTags;
  if (!Array.isArray(raw)) return [];
  const out: AppTagPill[] = [];
  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const tag = r.tag as Record<string, unknown> | undefined;
    const raw = String(tag?.name ?? "").trim();
    if (!raw) continue;
    const name = displayTagName(raw);
    const linkId = String(r.id ?? "");
    const tagId = String(tag?.id ?? "");
    const key = linkId || tagId || name;
    const color = typeof tag?.color === "string" && tag.color.trim() ? tag.color.trim() : null;
    out.push({ key, name, color });
  }
  return out;
}

/**
 * Responsive thumbnail grid for GEDCOM media linked to an individual, family, or event.
 * Raster images use next/image; other types show a compact file placeholder.
 */
export function AssociatedMediaThumbnailGrid({ items }: { items: readonly AssociatedMediaGridItem[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((row) => {
        const m = pickMediaFields(row.media);
        if (!m.id) return null;
        const tags = parseAppTagPills(row.media);
        const src = resolveMediaImageSrc(m.fileRef);
        const showThumb = Boolean(src && isLikelyRasterImage(m.fileRef, m.form, null));
        const showVideoPeek =
          Boolean(src) && !showThumb && isLikelyVideoFile(m.fileRef, m.form) && isPlayableVideoRef(m.fileRef);
        return (
          <li key={m.id} className="min-w-0">
            <Link
              href={`/admin/media/${m.id}`}
              className={cn(
                "flex flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-content/[0.035] shadow-sm shadow-black/15 outline-none transition",
                "hover:border-base-content/20 hover:bg-base-content/[0.055] focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <div className="relative aspect-square w-full bg-base-200/40">
                {showThumb && src ? (
                  <Image
                    src={src}
                    alt={m.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
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
                  <div className="flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-1.5 p-2 text-center">
                    <FileImage className="size-7 shrink-0 text-muted-foreground sm:size-8" aria-hidden />
                    <span className="line-clamp-2 text-[11px] font-medium leading-snug text-base-content/85 sm:text-xs">
                      {m.title}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-h-0 border-t border-base-content/10 p-2">
                <p className="line-clamp-2 text-xs font-medium leading-tight">{m.title}</p>
                {m.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{m.description}</p>
                ) : null}
                {m.xref ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{m.xref}</p>
                ) : null}
                {tags.length > 0 ? (
                  <div
                    className="mt-2 flex flex-wrap gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {tags.map((t) => (
                      <span
                        key={t.key}
                        title={t.name}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/12 bg-base-200/50 px-1.5 py-0.5 text-[10px] font-medium text-base-content sm:text-xs"
                      >
                        {t.color ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: t.color }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate">{t.name}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
