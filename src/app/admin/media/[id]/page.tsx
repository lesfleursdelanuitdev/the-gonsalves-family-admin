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
import { displayTagName } from "@/lib/admin/display-tag-name";
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

const kindBadge: Record<MediaKind, { label: string; className: string }> = {
  photo:    { label: "Photo",    className: "bg-success/15 text-success" },
  document: { label: "Document", className: "bg-warning/15 text-warning" },
  video:    { label: "Video",    className: "bg-info/15 text-info" },
};

function isHttpUrl(s: string): boolean {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
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
  const { label: kindLabel, className: kindClassName } = kindBadge[kind];

  const individualMedia = (media?.individualMedia as { individual: Record<string, unknown> }[] | undefined) ?? [];
  const familyMedia = (media?.familyMedia as { family: Record<string, unknown> }[] | undefined) ?? [];
  const sourceMedia = (media?.sourceMedia as { source: Record<string, unknown> }[] | undefined) ?? [];
  const eventMediaRows = (media?.eventMedia as { event: Record<string, unknown> }[] | undefined) ?? [];
  const appTags = (media?.appTags as { id: string; tag: { name: string } }[] | undefined) ?? [];
  const albumLinks = (media?.albumLinks as { id: string; album: { name: string } }[] | undefined) ?? [];

  const hasLinks = individualMedia.length > 0 || familyMedia.length > 0 || sourceMedia.length > 0 || eventMediaRows.length > 0;

  const refTrim = fileRef.trim();
  const imageSrc = refTrim ? resolveMediaImageSrc(refTrim) : null;
  const showImageThumb =
    Boolean(imageSrc) &&
    (isLikelyRasterImage(refTrim, form, null) || (kind === "photo" && isHttpUrl(refTrim)));
  const imageAlt = titleTrim || xref || "Media";
  const videoSrc = refTrim ? normalizeSiteMediaPath(refTrim) : "";
  const showInlineVideo =
    Boolean(videoSrc) && !showImageThumb && isLikelyVideoFile(refTrim, form) && isPlayableVideoRef(refTrim);

  return (
    <DetailPageShell
      backHref="/admin/media"
      backLabel="Media"
      isLoading={isLoading}
      error={error}
      data={media}
      notFoundMessage="Could not load this media item."
    >
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-3 pb-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <HeaderIcon className="size-8 shrink-0 text-base-content/70 sm:size-9" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-base-content leading-tight">
              {headline}
            </h1>
            {titleTrim && xref && (
              <p className="mt-0.5 font-mono text-sm text-muted-foreground">{xref}</p>
            )}
          </div>
        </div>
        <Link
          href={`/admin/media/${id}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          Edit
        </Link>
      </header>

      {/* items-start: sidebar column height follows its cards, not the tall preview (avoids Card h-full overflow). */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">

        {/* LEFT — preview + core metadata */}
        <div className="flex min-w-0 flex-col gap-5">

          {/* Image / video preview — shown FIRST */}
          {showImageThumb && imageSrc ? (
            <div>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative block w-full overflow-hidden rounded-box border border-base-content/[0.08] bg-base-200/50 shadow-sm shadow-black/15 outline-none ring-offset-background transition hover:border-base-content/20 focus-visible:ring-2 focus-visible:ring-ring"
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
                  <DialogDescription className="sr-only">Full-size preview of {imageAlt}. Press Escape to close.</DialogDescription>
                  <div className="relative mx-auto h-[min(78vh,880px)] w-full min-h-[200px]">
                    <Image src={imageSrc} alt={imageAlt} fill sizes="100vw" className="object-contain" priority unoptimized={mediaImageUnoptimized(imageSrc)} />
                  </div>
                  <DialogFooter className="pt-2 sm:justify-center">
                    <DialogClose type="button">Close</DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : showInlineVideo ? (
            <div className="overflow-hidden rounded-box border border-base-content/[0.08] bg-base-content/[0.035] shadow-sm shadow-black/15">
              <video src={videoSrc} controls playsInline className="max-h-[min(70vh,32rem)] w-full" />
            </div>
          ) : (
            <div className="flex aspect-[4/3] max-w-sm items-center justify-center rounded-box border border-base-content/[0.08] bg-base-200/40">
              <HeaderIcon className="size-16 text-muted-foreground/30" aria-hidden />
            </div>
          )}

          {/* Metadata card */}
          <Card className="h-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Details</CardTitle>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", kindClassName)}>
                  <span className="size-1.5 rounded-full bg-current shrink-0" aria-hidden />
                  {kindLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">UUID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Form (GEDCOM)</dt>
                  <dd className="mt-0.5 font-mono text-xs">{form || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File reference</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{refTrim || "—"}</dd>
                  {isHttpUrl(refTrim) && (
                    <a href={refTrim} target="_blank" rel="noopener noreferrer" className="link link-primary mt-1 block text-xs">
                      Open in new tab
                    </a>
                  )}
                </div>
                {descriptionTrim && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{descriptionTrim}</dd>
                  </div>
                )}
                {createdAt && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
                    <dd className="mt-0.5">{new Date(createdAt).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — linked records + tags + albums */}
        <div className="flex min-w-0 flex-col gap-4 lg:max-w-[300px]">
          {/* Linked to */}
          <Card className="h-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Linked to</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-3 overflow-x-hidden text-sm break-words">
              {!hasLinks && <p className="text-muted-foreground">Not linked to any record.</p>}

              {individualMedia.map((row) => (
                <LinkedIndividualLink key={String(row.individual.id)} ind={row.individual} />
              ))}

              {eventMediaRows.map((row) => {
                const ev = row.event;
                const eid = ev.id as string;
                const et = String(ev.eventType ?? "");
                const custom = (ev.customType as string | null) ?? null;
                const base = labelGedcomEventType(et);
                const label = et.toUpperCase() === "EVEN" && custom?.trim() ? `${base} (${custom.trim()})` : base;
                return (
                  <div key={eid} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3">
                    <p className="text-xs text-muted-foreground">Event</p>
                    <p className="font-medium">
                      <Link href={`/admin/events/${eid}`} className="link link-primary">{label}</Link>
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
                  <div key={famId} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3">
                    <p className="mb-2 font-mono text-xs">
                      <span className="text-muted-foreground">Family </span>
                      <Link href={`/admin/families/${famId}`} className="link link-primary">{famXref || famId}</Link>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Partner</p>
                        {h ? <LinkedIndividualLink ind={h} /> : <p className="text-muted-foreground">—</p>}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Partner</p>
                        {w ? <LinkedIndividualLink ind={w} /> : <p className="text-muted-foreground">—</p>}
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
                  <div key={sid} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3">
                    <p className="font-medium">{stitle}</p>
                    {sx && <p className="font-mono text-xs text-muted-foreground">{sx}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="h-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {appTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {appTags.map((t) => (
                    <li key={t.id} className="rounded-full border border-base-content/12 bg-base-200/50 px-2.5 py-0.5 text-xs">
                      {displayTagName(t.tag.name)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Albums */}
          <Card className="h-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Albums</CardTitle>
            </CardHeader>
            <CardContent>
              {albumLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {albumLinks.map((a) => (
                    <li key={a.id} className="rounded-full border border-base-content/12 bg-base-200/50 px-2.5 py-0.5 text-xs">
                      {a.album.name}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DetailPageShell>
  );
}
