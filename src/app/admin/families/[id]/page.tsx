"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { useAdminFamily } from "@/hooks/useAdminFamilies";
import { useAdminFamilyEvents } from "@/hooks/useAdminFamilyEvents";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { mergePedigreesForChild } from "@/lib/gedcom/pedigree-display";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { FAMILY_DETAIL_CHILDREN_PAGE_SIZE, FAMILY_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import { FamilyAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { SexIcon } from "@/components/admin/SexIcon";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { cn } from "@/lib/utils";
import { EntityHistoryCard } from "@/components/admin/EntityHistoryCard";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import { photoUrlFromProfileRow, type ProfileMediaSelectionShape } from "@/components/admin/EntityGedcomProfileMediaSection";
import {
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import { familyOfPageTitle } from "@/lib/gedcom/family-page-title";

const EVENT_SOURCE_LABELS: Record<string, string> = {
  familyRecord: "Family record",
  member: "Member",
};

type Partner = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex: string | null;
} | null;

type FamilyChild = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex?: string | null;
  birthYear?: number | null;
};

function PartnerRow({
  partner,
  title,
  slotHint,
}: {
  partner: Partner;
  title: string;
  slotHint: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">
        {partner ? <SexIcon sex={partner.sex} /> : <span className="inline-block size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground/90">{slotHint}</p>
        {partner ? (
          <Link href={`/admin/individuals/${partner.id}`} className="link link-primary font-medium">
            {stripSlashesFromName(partner.fullName) || partner.xref || partner.id}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}

function ChildRowLink({ child }: { child: FamilyChild }) {
  const name = stripSlashesFromName(child.fullName) || child.xref || child.id;
  return (
    <Link href={`/admin/individuals/${child.id}`} className="link link-primary font-medium">
      {name}
    </Link>
  );
}

function PaginatedChildrenList({
  rows,
  pedigreeByChild,
}: {
  rows: { child: FamilyChild }[];
  pedigreeByChild: Map<string, string>;
}) {
  const pageSize = FAMILY_DETAIL_CHILDREN_PAGE_SIZE;
  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize,
  }));

  const rowKey = rows.map((r) => r.child.id).join("|");
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [rowKey, rows.length]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }));
    }
  }, [pageCount, pagination.pageIndex]);

  const slice = useMemo(() => {
    const start = pagination.pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, pagination.pageIndex, pageSize]);

  const onPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No children in this family.</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {slice.map((row) => {
          const ped = pedigreeByChild.get(row.child.id) ?? "—";
          return (
            <li
              key={row.child.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-box border border-base-content/[0.08] bg-base-content/[0.035] px-3 py-2 text-sm shadow-sm shadow-black/15"
            >
              <span className="flex items-center gap-2">
                <SexIcon sex={row.child.sex} />
                <ChildRowLink child={row.child} />
                {row.child.birthYear != null ? (
                  <span className="text-xs text-muted-foreground">b. {row.child.birthYear}</span>
                ) : null}
              </span>
              <span className="badge badge-ghost badge-sm inline-flex items-center px-2.5 py-1 font-normal">
                {ped}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > pageSize ? (
        <div className="flex justify-end pt-1">
          <DataViewerPagination
            pagination={{ pageIndex: pagination.pageIndex, pageSize }}
            pageCount={pageCount}
            filteredTotal={rows.length}
            onPaginationChange={onPaginationChange}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function AdminFamilyViewPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  const { data: detailRes, isPending: detailPending, error: detailError } = useAdminFamily(id);
  const detailLoading = Boolean(id) && detailPending;
  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminFamilyEvents(id);

  const events = eventsRes?.events ?? [];
  const eventsErr = eventsError ? "Events could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: FAMILY_DETAIL_EVENTS_PAGE_SIZE,
  }));
  const [partnerInfoOpen, setPartnerInfoOpen] = useState(false);
  const partnerInfoPanelId = useId();

  useEffect(() => {
    setEventPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [id]);

  const eventPageCount = Math.max(1, Math.ceil(events.length / eventPagination.pageSize));

  useEffect(() => {
    if (eventPagination.pageIndex >= eventPageCount) {
      setEventPagination((p) => ({ ...p, pageIndex: Math.max(0, eventPageCount - 1) }));
    }
  }, [eventPageCount, eventPagination.pageIndex]);

  const paginatedEvents = useMemo(() => {
    const { pageIndex, pageSize } = eventPagination;
    return events.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [events, eventPagination]);

  const onEventPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setEventPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const fam = detailRes?.family as Record<string, unknown> | undefined;

  const pedigreeByChild = useMemo(() => {
    const m = new Map<string, string>();
    if (!fam) return m;
    const rels = (fam.parentChildRels as { childId: string; relationshipType: string | null; pedigree: string | null }[]) ?? [];
    const byChild = new Map<string, { relationshipType: string | null; pedigree: string | null }[]>();
    for (const r of rels) {
      if (!r.childId) continue;
      const list = byChild.get(r.childId) ?? [];
      list.push({ relationshipType: r.relationshipType, pedigree: r.pedigree });
      byChild.set(r.childId, list);
    }
    for (const [childId, rows] of byChild) {
      m.set(childId, mergePedigreesForChild(rows));
    }
    return m;
  }, [fam]);

  const xref = (fam?.xref as string) ?? "";
  const uuid = fam?.id as string;
  const marriageDateDisplay = (fam?.marriageDateDisplay as string) ?? "";
  const marriagePlaceDisplay = (fam?.marriagePlaceDisplay as string) ?? "";
  const marriageYear = fam?.marriageYear as number | null | undefined;
  const isDivorced = Boolean(fam?.isDivorced);

  const husband = (fam?.husband as Partner) ?? null;
  const wife = (fam?.wife as Partner) ?? null;
  const familyPageTitle = useMemo(() => familyOfPageTitle(husband, wife), [husband, wife]);

  useEffect(() => {
    if (!fam) return;
    const app = "Gonsalves Family Admin";
    document.title = `${familyPageTitle} · ${app}`;
    return () => {
      document.title = app;
    };
  }, [fam, familyPageTitle]);

  const familyChildren = (fam?.familyChildren as { child: FamilyChild }[]) ?? [];
  const notes = (fam?.familyNotes as { note: Record<string, unknown> }[]) ?? [];
  const media = (fam?.familyMedia as { media: Record<string, unknown> }[]) ?? [];
  const sources = (fam?.familySources as { source: Record<string, unknown>; page: string | null; quality: number | null; citationText: string | null }[]) ?? [];

  const hasMarriageDateOrPlace =
    marriageDateDisplay.trim() !== "" ||
    marriagePlaceDisplay.trim() !== "" ||
    marriageYear != null;
  const hasFamilyMarriageEvent = events.some(
    (e) =>
      String(e.eventType ?? "").toUpperCase() === "MARR" && e.source === "familyRecord",
  );
  const showMarriageSection = hasMarriageDateOrPlace || hasFamilyMarriageEvent;

  /** MARR on the family record may have date/place on the event row while family denorm columns are still empty. */
  const familyRecordMarrEvent = useMemo(
    () =>
      events.find(
        (e) =>
          String(e.eventType ?? "").toUpperCase() === "MARR" && e.source === "familyRecord",
      ),
    [events],
  );

  /** Prefer the canonical MARR on the family record over denorm (avoids stale marriage_* on gedcom_families_v2). */
  const marriageDateDisplayResolved = useMemo(() => {
    if (familyRecordMarrEvent) {
      const fromEv = formatEventDate(familyRecordMarrEvent);
      if (fromEv !== "—") return fromEv;
    }
    return marriageDateDisplay.trim();
  }, [marriageDateDisplay, familyRecordMarrEvent]);

  const marriagePlaceDisplayResolved = useMemo(() => {
    if (familyRecordMarrEvent) {
      const fromEv =
        familyRecordMarrEvent.placeName?.trim() || familyRecordMarrEvent.placeOriginal?.trim() || "";
      if (fromEv) return fromEv;
    }
    return marriagePlaceDisplay.trim();
  }, [marriagePlaceDisplay, familyRecordMarrEvent]);

  const marriageYearResolved =
    familyRecordMarrEvent?.year != null ? familyRecordMarrEvent.year : (marriageYear ?? null);

  const familyNewEventLabel =
    xref.trim() ||
    [stripSlashesFromName(husband?.fullName), stripSlashesFromName(wife?.fullName)]
      .filter(Boolean)
      .join(" & ")
      .trim() ||
    id;

  const profileMediaSelection = (fam?.profileMediaSelection ?? null) as ProfileMediaSelectionShape;
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
      backHref="/admin/families"
      backLabel="Families"
      isLoading={detailLoading}
      error={detailError}
      data={id ? fam : undefined}
      notFoundMessage={
        id ? "Could not load this family." : "This page is missing a family id in the URL."
      }
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
              <span className="shrink-0 text-base-content/70" aria-hidden>
                <Users className="size-7 sm:size-8" />
              </span>
            )}
            <span className="min-w-0">{familyPageTitle}</span>
          </h1>
          {id ? (
            <Link
              href={`/admin/families/${id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Edit family
            </Link>
          ) : null}
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">XREF</dt>
            <dd className="font-mono text-xs break-all">{xref || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="font-mono text-xs break-all">{uuid}</dd>
          </div>
          {showMarriageSection && marriageYearResolved != null ? (
            <div>
              <dt className="text-muted-foreground">Marriage year</dt>
              <dd>{marriageYearResolved}</dd>
            </div>
          ) : null}
          {isDivorced ? (
            <div>
              <dt className="text-muted-foreground">Divorced</dt>
              <dd>Yes</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {showMarriageSection ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Marriage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">Date</p>
              <p>{marriageDateDisplayResolved || "—"}</p>
              <p className="text-muted-foreground">{marriagePlaceDisplayResolved || "—"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Partners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
              aria-expanded={partnerInfoOpen}
              aria-controls={partnerInfoPanelId}
              onClick={() => setPartnerInfoOpen((o) => !o)}
            >
              <span className="font-medium text-base-content">Info</span>
              {partnerInfoOpen ? (
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            <div
              id={partnerInfoPanelId}
              hidden={!partnerInfoOpen}
              className="space-y-2 border-t border-base-content/10 px-3 pb-3 pt-2"
              role="region"
              aria-label="Partner slot info"
            >
              <p className="text-sm text-muted-foreground">{FAMILY_PARTNER_SLOT_SUBTITLE}</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <PartnerRow
              partner={husband}
              title={FAMILY_PARTNER_1_LABEL}
              slotHint="GEDCOM husband (HUSB)"
            />
            <PartnerRow
              partner={wife}
              title={FAMILY_PARTNER_2_LABEL}
              slotHint="GEDCOM wife (WIFE)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Children ({familyChildren.length})</CardTitle>
          <p className="text-sm text-muted-foreground">Pedigree from parent–child links (birth, adopted, foster, etc.).</p>
        </CardHeader>
        <CardContent>
          <PaginatedChildrenList rows={familyChildren} pedigreeByChild={pedigreeByChild} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Events on this family record and each member&apos;s own individual events.
            </p>
          </div>
          {id ? (
            <Link
              href={`/admin/events/new?familyId=${encodeURIComponent(id)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add event
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : eventsErr ? (
            <p className="text-sm text-destructive">{eventsErr}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedEvents.map((e, i) => (
                  <div
                    key={
                      e.eventId ??
                      `fev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.memberId ?? ""}`
                    }
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {e.eventType}
                      {e.customType ? ` · ${e.customType}` : ""}
                    </p>
                    <div className="mt-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2">
                          <GedcomEventTypeIcon eventType={e.eventType} />
                          <span className="font-semibold text-base-content">
                            {labelGedcomEventType(e.eventType)}
                          </span>
                        </span>
                        <span className="badge badge-ghost badge-sm inline-flex items-center px-2.5 py-1 font-normal">
                          {EVENT_SOURCE_LABELS[e.source] ?? e.source}
                        </span>
                      </div>
                      <p className="text-sm">{formatEventDate(e)}</p>
                      <p className="text-sm text-muted-foreground">{e.placeName || e.placeOriginal || "—"}</p>
                    {e.value ? <p className="text-xs">{e.value}</p> : null}
                    <FamilyAdminEventContext e={e} />
                    {e.eventId ? (
                      <p className="pt-1">
                        <Link
                          href={`/admin/events/${e.eventId}`}
                          className="link link-primary text-xs font-medium"
                        >
                          Open in Events admin
                        </Link>
                      </p>
                    ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {events.length > FAMILY_DETAIL_EVENTS_PAGE_SIZE ? (
                <div className="flex justify-end pt-1">
                  <DataViewerPagination
                    pagination={eventPagination}
                    pageCount={eventPageCount}
                    filteredTotal={events.length}
                    onPaginationChange={onEventPaginationChange}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes.</p>
          ) : (
            notes.map((jn) => {
              const n = jn.note;
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
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
            </p>
          </div>
          <ViewAsAlbumLink entityType="family" entityId={id} label="View family media" count={media.length} />
        </CardHeader>
        <CardContent>
          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media.</p>
          ) : (
            <AssociatedMediaThumbnailGrid items={media} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources.</p>
          ) : (
            sources.map((row) => {
              const s = row.source;
              return (
                <div
                  key={String(s.id)}
                  className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm"
                >
                  <p className="font-medium">{String(s.title ?? s.xref ?? "Source")}</p>
                  <p className="text-xs text-muted-foreground font-mono">{String(s.xref ?? "")}</p>
                  {s.author ? <p className="text-muted-foreground">Author: {String(s.author)}</p> : null}
                  {s.publication ? <p className="text-muted-foreground">{String(s.publication)}</p> : null}
                  {row.page ? <p>Page: {row.page}</p> : null}
                  {row.citationText ? <p className="mt-1 text-xs whitespace-pre-wrap">{row.citationText}</p> : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <EntityHistoryCard entityType="family" entityId={id} />
    </DetailPageShell>
  );
}
