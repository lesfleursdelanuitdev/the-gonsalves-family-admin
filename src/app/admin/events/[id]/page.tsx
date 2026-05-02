"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminEvent } from "@/hooks/useAdminEvents";
import { formatDateRecord } from "@/lib/gedcom/format-event-date";
import { eventPageDisplayTitle } from "@/lib/gedcom/event-page-title";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { LinkedIndividualLink } from "@/components/admin/LinkedIndividualLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import { photoUrlFromProfileRow, type ProfileMediaSelectionShape } from "@/components/admin/EntityGedcomProfileMediaSection";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";

export default function AdminEventDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  const { data, isLoading, error } = useAdminEvent(id);

  const ev = data?.event as Record<string, unknown> | undefined;

  const eventType = (ev?.eventType as string) ?? "";
  const customType = ((ev?.customType as string) ?? "").trim();
  const value = ((ev?.value as string) ?? "").trim();
  const cause = ((ev?.cause as string) ?? "").trim();
  const agency = ((ev?.agency as string) ?? "").trim();
  const dateLine = formatDateRecord(ev?.date);
  const placeRec = ev?.place as Record<string, unknown> | null | undefined;
  const placeName = (placeRec?.name as string | undefined)?.trim() ?? "";
  const placeOriginal = (placeRec?.original as string | undefined)?.trim() ?? "";
  const placeLine = placeName || placeOriginal;

  const individualEvents = (ev?.individualEvents as { individual: Record<string, unknown> }[]) ?? [];
  const familyEvents = (ev?.familyEvents as { family: Record<string, unknown> }[]) ?? [];

  const pageTitle = useMemo(() => {
    if (!ev) return "";
    const et = (ev.eventType as string) ?? "";
    const ct = ((ev.customType as string) ?? "").trim() || null;
    const ind = (ev.individualEvents as { individual: Record<string, unknown> }[]) ?? [];
    const fam = (ev.familyEvents as { family: Record<string, unknown> }[]) ?? [];
    return eventPageDisplayTitle({
      eventType: et,
      customType: ct,
      individualEvents: ind,
      familyEvents: fam,
    });
  }, [ev]);

  useEffect(() => {
    if (!ev) return;
    const app = "Gonsalves Family Admin";
    document.title = `${pageTitle} · ${app}`;
    return () => {
      document.title = app;
    };
  }, [ev, pageTitle]);

  const eventNotes =
    (ev?.eventNotes as { note: Record<string, unknown> }[] | undefined) ?? [];
  const eventSources =
    (ev?.eventSources as {
      source: Record<string, unknown>;
      page: string | null;
      quality: number | null;
      citationText: string | null;
    }[]) ?? [];

  const eventMedia =
    (ev?.eventMedia as { media: Record<string, unknown> }[] | undefined) ?? [];

  const profileMediaSelection = (ev?.profileMediaSelection ?? null) as ProfileMediaSelectionShape;
  const headerProfilePhotoUrl = useMemo(
    () => photoUrlFromProfileRow(profileMediaSelection),
    [profileMediaSelection],
  );
  const [headerProfileImgFailed, setHeaderProfileImgFailed] = useState(false);
  useEffect(() => {
    setHeaderProfileImgFailed(false);
  }, [id, headerProfilePhotoUrl]);

  return (
    <DetailPageShell
      backHref="/admin/events"
      backLabel="Events"
      isLoading={isLoading}
      error={error}
      data={ev}
      notFoundMessage="Could not load this event."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-3 text-3xl font-bold tracking-tight text-base-content">
            {headerProfilePhotoUrl && !headerProfileImgFailed ? (
              <span className="relative flex size-12 shrink-0 overflow-hidden rounded-full border border-base-content/15 bg-muted sm:size-14">
                <img
                  src={headerProfilePhotoUrl}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setHeaderProfileImgFailed(true)}
                />
              </span>
            ) : (
              <GedcomEventTypeIcon eventType={eventType} className="size-8 shrink-0 sm:size-9" />
            )}
            <span className="min-w-0 leading-tight">{pageTitle}</span>
          </h1>
          <Link
            href={`/admin/events/${id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1.5")}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Link>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GEDCOM type</dt>
            <dd className="font-mono text-xs">{eventType || "—"}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {dateLine ? (
            <div>
              <p className="font-medium text-muted-foreground">Date</p>
              <p>{dateLine}</p>
            </div>
          ) : null}
          {placeLine ? (
            <div>
              <p className="font-medium text-muted-foreground">Place</p>
              <p>{placeLine}</p>
            </div>
          ) : null}
          {value ? (
            <div>
              <p className="font-medium text-muted-foreground">Value</p>
              <p>{value}</p>
            </div>
          ) : null}
          {cause ? (
            <div>
              <p className="font-medium text-muted-foreground">Cause</p>
              <p>{cause}</p>
            </div>
          ) : null}
          {agency ? (
            <div>
              <p className="font-medium text-muted-foreground">Agency</p>
              <p>{agency}</p>
            </div>
          ) : null}
          {!dateLine && !placeLine && !value && !cause && !agency ? (
            <p className="text-muted-foreground">No date, place, or other details on this record.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Linked to</CardTitle>
          <p className="text-sm text-muted-foreground">Individuals and families this event is attached to.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {individualEvents.length === 0 && familyEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any individual or family.</p>
          ) : null}
          {individualEvents.map((row) => (
            <LinkedIndividualLink key={String(row.individual.id)} ind={row.individual} />
          ))}
          {familyEvents.map((row) => {
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
              Media
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
            </p>
          </div>
          <ViewAsAlbumLink entityType="event" entityId={id} label="View event media" count={eventMedia.length} />
        </CardHeader>
        <CardContent>
          {eventMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media linked to this event.</p>
          ) : (
            <AssociatedMediaThumbnailGrid items={eventMedia} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes.</p>
          ) : (
            eventNotes.map((en) => {
              const n = en.note;
              const nid = String(n.id);
              return (
                <EmbeddedNoteCard
                  key={nid}
                  noteId={nid}
                  xref={String(n.xref ?? "")}
                  content={String(n.content ?? "")}
                />
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources.</p>
          ) : (
            eventSources.map((es) => {
              const s = es.source;
              return (
                <div
                  key={String(s.id)}
                  className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                >
                  <p className="font-medium">{String(s.title ?? s.xref ?? "Source")}</p>
                  <p className="font-mono text-xs text-muted-foreground">{String(s.xref ?? "")}</p>
                  {es.page ? <p className="text-muted-foreground">Page: {es.page}</p> : null}
                  {es.citationText ? (
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{es.citationText}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
