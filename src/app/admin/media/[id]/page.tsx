"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileImage, FileText, Film } from "lucide-react";
import { useAdminMediaItem } from "@/hooks/useAdminMedia";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { LinkedIndividualLink } from "@/components/admin/LinkedIndividualLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  mediaImageUnoptimized,
  normalizeSiteMediaPath,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { cn } from "@/lib/utils";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

type MediaKind = "photo" | "document" | "video";

function inferMediaKind(form: string | null | undefined): MediaKind {
  const f = (form ?? "").toLowerCase();
  if (f.includes("video") || f === "video") return "video";
  if (f.includes("doc") || f === "document") return "document";
  return "photo";
}

const kindIcon: Record<MediaKind, ComponentType<{ className?: string }>> = {
  photo: FileImage,
  document: FileText,
  video: Film,
};

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminMediaDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data, isLoading, error } = useAdminMediaItem(id);

  const media = data?.media as Record<string, unknown> | undefined;

  const xref = (media?.xref as string | null) ?? "";
  const title = (media?.title as string | null) ?? "";
  const titleTrim = title.trim();
  const descriptionRaw = (media?.description as string | null) ?? "";
  const descriptionTrim = descriptionRaw.trim();
  const fileRef = (media?.fileRef as string | null) ?? "";
  const form = (media?.form as string | null) ?? "";
  const createdAt = media?.createdAt as string | undefined;
  const kind = inferMediaKind(form);
  const HeaderIcon = kindIcon[kind];
  const headline = titleTrim || xref || "Media";
  const showXrefSubtitle = Boolean(titleTrim && xref);

  const individualMedia =
    (media?.individualMedia as { individual: Record<string, unknown> }[] | undefined) ?? [];
  const familyMedia = (media?.familyMedia as { family: Record<string, unknown> }[] | undefined) ?? [];
  const sourceMedia =
    (media?.sourceMedia as { source: Record<string, unknown> }[] | undefined) ?? [];
  const eventMediaRows =
    (media?.eventMedia as { event: Record<string, unknown> }[] | undefined) ?? [];

  const hasLinks =
    individualMedia.length > 0 ||
    familyMedia.length > 0 ||
    sourceMedia.length > 0 ||
    eventMediaRows.length > 0;

  const appTags =
    (media?.appTags as { id: string; tag: { name: string } }[] | undefined) ?? [];
  const albumLinks =
    (media?.albumLinks as { id: string; album: { name: string } }[] | undefined) ?? [];

  const refTrim = fileRef.trim();
  const showRemotePreview = refTrim.length > 0 && isHttpUrl(refTrim);
  const imageSrc = refTrim ? resolveMediaImageSrc(refTrim) : null;
  const showImageThumb =
    Boolean(imageSrc) &&
    (isLikelyRasterImage(refTrim, form, null) || (kind === "photo" && isHttpUrl(refTrim)));
  const imageAlt = titleTrim || xref || "Media";
  const videoSrc = refTrim ? normalizeSiteMediaPath(refTrim) : "";
  const showInlineVideo =
    Boolean(videoSrc) &&
    !showImageThumb &&
    isLikelyVideoFile(refTrim, form) &&
    isPlayableVideoRef(refTrim);

  return (
    <DetailPageShell
      backHref="/admin/media"
      backLabel="Media"
      isLoading={isLoading}
      error={error}
      data={media}
      notFoundMessage="Could not load this media item."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex min-w-0 flex-1 items-center gap-3 text-3xl font-bold tracking-tight text-base-content">
            <HeaderIcon className="size-8 shrink-0 text-base-content/80 sm:size-9" aria-hidden />
            <span className="min-w-0 leading-tight">
              {headline}
              {showXrefSubtitle ? (
                <span className="mt-1 block font-mono text-base font-normal text-muted-foreground">
                  {xref}
                </span>
              ) : null}
            </span>
          </h1>
          <Link href={`/admin/media/${id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
            Edit
          </Link>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="capitalize">{kind}</dd>
          </div>
          {descriptionTrim ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="whitespace-pre-wrap text-sm">{descriptionTrim}</dd>
            </div>
          ) : null}
          {form ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Form (GEDCOM)</dt>
              <dd className="font-mono text-xs">{form}</dd>
            </div>
          ) : null}
          {createdAt ? (
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(createdAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">File reference</CardTitle>
          <p className="text-sm text-muted-foreground">
            GEDCOM file reference or URL as stored in the tree.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {refTrim ? (
            <>
              <p className="break-all font-mono text-sm">{refTrim}</p>
              {showImageThumb && imageSrc ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Click the preview to open a larger view.</p>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="group relative block w-full max-w-xl overflow-hidden rounded-box border border-base-content/[0.08] bg-base-200/50 shadow-sm shadow-black/15 outline-none ring-offset-background transition hover:border-base-content/20 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="relative block aspect-[4/3] w-full">
                      <Image
                        src={imageSrc}
                        alt={imageAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, 36rem"
                        className="object-contain p-2 transition group-hover:opacity-95"
                        unoptimized={mediaImageUnoptimized(imageSrc)}
                      />
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                      Enlarge
                    </span>
                  </button>
                  <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                    <DialogContent className="max-h-[90vh] max-w-[min(96vw,1200px)] border-border bg-background p-3 sm:p-4">
                      <DialogTitle className="sr-only">Image preview</DialogTitle>
                      <DialogDescription className="sr-only">
                        Full-size preview of {imageAlt}. Use Close or Escape to dismiss.
                      </DialogDescription>
                      <div className="relative mx-auto h-[min(78vh,880px)] w-full min-h-[200px]">
                        <Image
                          src={imageSrc}
                          alt={imageAlt}
                          fill
                          sizes="100vw"
                          className="object-contain"
                          priority
                          unoptimized={mediaImageUnoptimized(imageSrc)}
                        />
                      </div>
                      <DialogFooter className="pt-2 sm:justify-center">
                        <DialogClose type="button">Close</DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : null}
              {showInlineVideo ? (
                <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-content/[0.035] shadow-sm shadow-black/15">
                  <video src={videoSrc} controls playsInline className="max-h-[min(70vh,32rem)] w-full" />
                </div>
              ) : null}
              {showRemotePreview && !showImageThumb && !showInlineVideo ? (
                <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-content/[0.035] shadow-sm shadow-black/15">
                  <p className="p-4 text-sm text-muted-foreground">
                    No inline preview for this type; use “Open in new tab” below.
                  </p>
                </div>
              ) : null}
              {isHttpUrl(refTrim) ? (
                <p>
                  <a
                    href={refTrim}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary text-sm"
                  >
                    Open in new tab
                  </a>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No file reference stored.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Linked to</CardTitle>
          <p className="text-sm text-muted-foreground">Individuals, families, events, or sources.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasLinks ? (
            <p className="text-sm text-muted-foreground">Not linked to any record.</p>
          ) : null}

          {individualMedia.map((row) => (
            <LinkedIndividualLink key={String(row.individual.id)} ind={row.individual} />
          ))}

          {eventMediaRows.map((row) => {
            const ev = row.event;
            const eid = ev.id as string;
            const et = String(ev.eventType ?? "");
            const custom = (ev.customType as string | null) ?? null;
            const base = labelGedcomEventType(et);
            const label =
              et.toUpperCase() === "EVEN" && custom?.trim() ? `${base} (${custom.trim()})` : base;
            return (
              <div
                key={eid}
                className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
              >
                <p className="text-xs text-muted-foreground">Event</p>
                <p className="font-medium">
                  <Link href={`/admin/events/${eid}`} className="link link-primary">
                    {label}
                  </Link>
                </p>
              </div>
            );
          })}

          {familyMedia.map((row) => {
            const fam = row.family;
            const famId = fam.id as string;
            const famXref = (fam.xref as string) ?? "";
            const h = fam.husband as Record<string, unknown> | null;
            const w = fam.wife as Record<string, unknown> | null;
            return (
              <div
                key={famId}
                className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15"
              >
                <p className="mb-3 font-mono text-xs">
                  <span className="text-muted-foreground">Family </span>
                  <Link href={`/admin/families/${famId}`} className="link link-primary">
                    {famXref || famId}
                  </Link>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Partner</p>
                    {h ? <LinkedIndividualLink ind={h} /> : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Partner</p>
                    {w ? <LinkedIndividualLink ind={w} /> : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                </div>
              </div>
            );
          })}

          {sourceMedia.map((row) => {
            const s = row.source;
            const sid = s.id as string;
            const stitle = String(s.title ?? s.xref ?? "Source");
            const sx = String(s.xref ?? "");
            return (
              <div
                key={sid}
                className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
              >
                <p className="font-medium">{stitle}</p>
                {sx ? <p className="font-mono text-xs text-muted-foreground">{sx}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Tags & albums</CardTitle>
          <p className="text-sm text-muted-foreground">App tags and album membership for this media object.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
            {appTags.length === 0 ? (
              <p className="text-muted-foreground">None.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {appTags.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-full border border-base-content/12 bg-base-200/50 px-2.5 py-0.5 text-xs"
                  >
                    {t.tag.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Albums</p>
            {albumLinks.length === 0 ? (
              <p className="text-muted-foreground">None.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {albumLinks.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-full border border-base-content/12 bg-base-200/50 px-2.5 py-0.5 text-xs"
                  >
                    {a.album.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
