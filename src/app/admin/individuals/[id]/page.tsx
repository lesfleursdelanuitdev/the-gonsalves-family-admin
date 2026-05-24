"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { useAdminIndividual, useAdminIndividualEvents, useAdminIndividualUserLinks } from "@/hooks/useAdminIndividuals";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { SURNAME_PIECE_TYPE_OPTIONS } from "@/lib/forms/individual-editor-form";
import { buttonVariants } from "@/components/ui/button";
import { Dna } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import {
  INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE,
  INDIVIDUAL_DETAIL_FAMILY_CHILDREN_PAGE_SIZE,
} from "@/constants/admin";
import { IndividualAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { SexIcon } from "@/components/admin/SexIcon";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@ligneous/gedcom-events";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { cn } from "@/lib/utils";
import { EntityHistoryCard } from "@/components/admin/EntityHistoryCard";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import { EntityOpenQuestionsSection } from "@/components/admin/EntityOpenQuestionsSection";
import { photoUrlFromProfileRow, type ProfileMediaSelectionShape } from "@/components/admin/EntityGedcomProfileMediaSection";
import {
  buildChildNonBirthIndicatorMap,
  summarizePedigreeForChildInFamily,
  type ParentChildEdgeForPedigree,
  type ParentChildRelForChildIndicator,
} from "@/lib/gedcom/pedigree-display";
import { NonBirthChildIndicator } from "@/components/admin/NonBirthChildIndicator";
import { fetchJson } from "@/lib/infra/api";

const EVENT_SOURCE_LABELS: Record<string, string> = {
  individual: "Self",
  family: "Family",
  spouseDeath: "Spouse",
  childBirth: "Child birth",
  childDeath: "Child death",
  childMarriage: "Child marriage",
  grandchildBirth: "Grandchild birth",
  parentDeath: "Parent",
  siblingDeath: "Sibling",
  grandparentDeath: "Grandparent",
};

const NAME_TYPE_LABELS: Record<string, string> = {
  birth: "Birth name",
  married: "Married name",
  maiden: "Maiden name",
  aka: "Also known as",
  unknown: "Unknown",
};

function labelNameType(t: string) {
  return NAME_TYPE_LABELS[t.toLowerCase()] ?? t;
}

function labelSurnamePieceType(piece: string | null | undefined): string | null {
  if (piece == null || piece === "") return null;
  const v = piece.trim().toLowerCase();
  const opt = SURNAME_PIECE_TYPE_OPTIONS.find((o) => o.value === v);
  return opt ? opt.label : piece;
}

type IndiChild = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex?: string | null;
  birthDateDisplay?: string | null;
  birthPlaceDisplay?: string | null;
  birthYear?: number | null;
  individualNameForms?: Parameters<typeof formatDisplayNameFromNameForms>[0];
};

type RichRelationshipRow = {
  id: string;
  relationshipType: { key: string; label: string };
  participants: Array<{
    individualId: string;
    individual: { id: string; xref: string; fullName: string | null };
    role: { key: string; label: string };
  }>;
};

function PersonLink({ person, nonBirthChild }: { person: IndiChild; nonBirthChild?: boolean }) {
  const name =
    formatDisplayNameFromNameForms(person.individualNameForms, person.fullName) ||
    person.xref ||
    person.id;
  return (
    <span className="inline-flex items-center gap-1.5">
      <SexIcon sex={person.sex} />
      {nonBirthChild ? <NonBirthChildIndicator /> : null}
      <Link href={`/admin/individuals/${person.id}`} className="link link-primary font-medium">
        {name}
      </Link>
    </span>
  );
}

function PaginatedFamilyChildrenList({
  rows,
  renderLink,
  label,
}: {
  rows: { child: IndiChild }[];
  renderLink: (person: IndiChild) => ReactNode;
  label: string;
}) {
  const pageSize = INDIVIDUAL_DETAIL_FAMILY_CHILDREN_PAGE_SIZE;
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

  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-muted-foreground">{label}</p>
      <ul className="list-none space-y-1 pl-0">
        {slice.map((row) => (
          <li key={row.child.id} className="flex items-center gap-2">
            {renderLink(row.child)}
          </li>
        ))}
      </ul>
      {rows.length > pageSize ? (
        <div className="mt-2 flex justify-end">
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

export default function AdminIndividualViewPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  /** TanStack Query v5: `isLoading` is only true while fetching; disabled / idle pending uses `isPending`. */
  const { data: detailRes, isPending: detailPending, error: detailError } = useAdminIndividual(id);
  const detailLoading = Boolean(id) && detailPending;
  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminIndividualEvents(id);
  const {
    data: userLinksRes,
    isLoading: userLinksLoading,
    error: userLinksError,
  } = useAdminIndividualUserLinks(id);

  const events = eventsRes?.events ?? [];
  const eventsErr = eventsError ? "Events could not be loaded." : null;
  const userLinks = userLinksRes?.links ?? [];
  const userLinksErr = userLinksError ? "Linked accounts could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE,
  }));

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

  const ind = detailRes?.individual as Record<string, unknown> | undefined;

  const nameFormsForHeader = (ind?.individualNameForms as Parameters<typeof formatDisplayNameFromNameForms>[0]) ?? [];
  const fullName =
    formatDisplayNameFromNameForms(nameFormsForHeader, ind?.fullName as string) || "—";
  const xref = (ind?.xref as string) ?? "";
  const uuid = ind?.id as string;
  const sex = ind?.sex as string | null;
  const isLiving = ind?.isLiving as boolean;
  const birthDateDisplay = (ind?.birthDateDisplay as string) ?? "";
  const birthPlaceDisplay = (ind?.birthPlaceDisplay as string) ?? "";
  const deathDateDisplay = (ind?.deathDateDisplay as string) ?? "";
  const deathPlaceDisplay = (ind?.deathPlaceDisplay as string) ?? "";
  const birthDateLine = birthDateDisplay.trim();
  const birthPlaceLine = birthPlaceDisplay.trim();
  const deathDateLine = deathDateDisplay.trim();
  const deathPlaceLine = deathPlaceDisplay.trim();
  const hasBirthDetails = Boolean(birthDateLine) || Boolean(birthPlaceLine);
  const hasDeathDetails = Boolean(deathDateLine) || Boolean(deathPlaceLine);
  const showBirthDeathCard = hasBirthDetails || hasDeathDetails;

  const nameForms = (ind?.individualNameForms as Record<string, unknown>[]) ?? [];
  const notes = (ind?.individualNotes as { note: Record<string, unknown> }[]) ?? [];
  const sources = (ind?.individualSources as { source: Record<string, unknown>; page: string | null; quality: number | null; citationText: string | null }[]) ?? [];
  const media = (ind?.individualMedia as { media: Record<string, unknown> }[]) ?? [];

  const familiesAsChild = (ind?.familyChildAsChild as { family: Record<string, unknown> }[]) ?? [];
  const parentAsChildEdges = (ind?.parentAsChild as ParentChildEdgeForPedigree[]) ?? [];
  const husbandFams = (ind?.husbandInFamilies as Record<string, unknown>[]) ?? [];
  const wifeFams = (ind?.wifeInFamilies as Record<string, unknown>[]) ?? [];
  const associationsAsSubject = (ind?.associationsAsSubject as Record<string, unknown>[]) ?? [];
  const [richRelationships, setRichRelationships] = useState<RichRelationshipRow[]>([]);

  const profileMediaSelection = (ind?.profileMediaSelection ?? null) as ProfileMediaSelectionShape;
  const headerProfilePhotoUrl = useMemo(
    () => photoUrlFromProfileRow(profileMediaSelection),
    [profileMediaSelection],
  );

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    void fetchJson<{ relationships: RichRelationshipRow[] }>(`/api/admin/individuals/${encodeURIComponent(id)}/relationships`)
      .then((res) => {
        if (!cancelled) setRichRelationships(res.relationships ?? []);
      })
      .catch(() => {
        if (!cancelled) setRichRelationships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const [headerProfileImgFailed, setHeaderProfileImgFailed] = useState(false);
  useEffect(() => {
    setHeaderProfileImgFailed(false);
  }, [id, headerProfilePhotoUrl]);

  return (
    <DetailPageShell
      backHref="/admin/individuals"
      backLabel="Individuals"
      isLoading={detailLoading}
      error={detailError}
      data={id ? ind : undefined}
      notFoundMessage={
        id ? "Could not load this person." : "This page is missing a person id in the URL."
      }
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-base-content">
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
              <span className="shrink-0">
                <SexIcon sex={sex} className="size-7 sm:size-8" />
              </span>
            )}
            <span className="min-w-0">{fullName}</span>
          </h1>
          {id ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/relationship-calculator?sourceId=${encodeURIComponent(id)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 gap-1.5")}
              >
                <Dna className="size-3.5" />
                Find relationship
              </Link>
              <Link
                href={`/admin/individuals/${id}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                Edit individual
              </Link>
            </div>
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
          <div>
            <dt className="text-muted-foreground">Sex</dt>
            <dd>{sex === "M" ? "Male" : sex === "F" ? "Female" : sex || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Living</dt>
            <dd>{isLiving ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </header>

      {showBirthDeathCard ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Birth & death</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            {hasBirthDetails ? (
              <div>
                <p className="font-medium text-muted-foreground">Birth</p>
                {birthDateLine ? <p>{birthDateLine}</p> : null}
                {birthPlaceLine ? <p className="text-muted-foreground">{birthPlaceLine}</p> : null}
              </div>
            ) : null}
            {hasDeathDetails ? (
              <div>
                <p className="font-medium text-muted-foreground">Death</p>
                {deathDateLine ? <p>{deathDateLine}</p> : null}
                {deathPlaceLine ? <p className="text-muted-foreground">{deathPlaceLine}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Names</CardTitle>
          <p className="text-sm text-muted-foreground">All name forms (birth, married, maiden, etc.)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {nameForms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured name forms.</p>
          ) : (
            nameForms.map((nf) => {
              const nameType = (nf.nameType as string) ?? "";
              const isMarriedName = nameType.toLowerCase() === "married";
              const isPrimary = Boolean(nf.isPrimary);
              const givens =
                (nf.givenNames as { givenName: { givenName: string } }[] | undefined)?.map((g) => g.givenName?.givenName).filter(Boolean) ??
                [];
              const surnameRows =
                (nf.surnames as
                  | { surname: { surname: string }; surnamePieceType?: string | null }[]
                  | undefined) ?? [];
              const surnameDisplayParts = surnameRows
                .map((row) => {
                  const raw = row.surname?.surname;
                  if (!raw?.trim()) return null;
                  const base = stripSlashesFromName(raw);
                  const pl = labelSurnamePieceType(row.surnamePieceType);
                  return pl ? `${base} (${pl})` : base;
                })
                .filter((x): x is string => x != null);
              return (
                <div key={String(nf.id)} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium">{labelNameType(nameType)}</span>
                    {isPrimary ? (
                      <span className="badge badge-outline badge-primary badge-sm font-normal">Primary</span>
                    ) : null}
                  </div>
                  {isMarriedName ? (
                    <p className="mb-2 text-xs text-muted-foreground">Given names match the birth name (not shown).</p>
                  ) : (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Given: </span>
                      {givens.length ? givens.join(" ") : "—"}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="text-muted-foreground">Surname(s): </span>
                    {surnameDisplayParts.length ? surnameDisplayParts.join(" · ") : "—"}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Families (as child)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {familiesAsChild.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked as a child in any family.</p>
          ) : (
            familiesAsChild.map((fc) => {
              const fam = fc.family as Record<string, unknown>;
              const famId = fam.id as string;
              const famXref = (fam.xref as string) ?? "";
              const h = fam.husband as IndiChild | null;
              const w = fam.wife as IndiChild | null;
              const kids = (fam.familyChildren as { child: IndiChild }[] | undefined) ?? [];
              const childNonBirth = buildChildNonBirthIndicatorMap(
                (fam.parentChildRels as ParentChildRelForChildIndicator[]) ?? [],
                famId,
                h?.id,
                w?.id,
              );
              const pedigreeSummary = summarizePedigreeForChildInFamily(
                parentAsChildEdges,
                famId,
                h?.id,
                w?.id,
              );
              return (
                <div key={famId} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm">
                  <p className="mb-2 font-mono text-xs">
                    <span className="text-muted-foreground">Family </span>
                    <Link href={`/admin/families/${famId}`} className="link link-primary">
                      {famXref || famId}
                    </Link>
                  </p>
                  <div className="mb-3 rounded-md border border-base-content/10 bg-base-200/25 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Relationship to parents
                    </p>
                    <p className="text-sm text-foreground">{pedigreeSummary}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Parent</p>
                      {h ? <PersonLink person={h} /> : <p className="text-sm text-muted-foreground">—</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Parent</p>
                      {w ? <PersonLink person={w} /> : <p className="text-sm text-muted-foreground">—</p>}
                    </div>
                  </div>
                  <PaginatedFamilyChildrenList
                    rows={kids}
                    label="Children in family"
                    renderLink={(c) => <PersonLink person={c} nonBirthChild={childNonBirth.get(c.id)} />}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Families (as spouse)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {husbandFams.length === 0 && wifeFams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked as a partner in any family.</p>
          ) : (
            <>
              {husbandFams.map((fam) => {
                const f = fam as Record<string, unknown>;
                const spouse = f.wife as IndiChild | null;
                const husband = f.husband as IndiChild | null;
                const kids = (f.familyChildren as { child: IndiChild }[] | undefined) ?? [];
                const childNonBirth = buildChildNonBirthIndicatorMap(
                  (f.parentChildRels as ParentChildRelForChildIndicator[]) ?? [],
                  f.id as string,
                  husband?.id,
                  spouse?.id,
                );
                return (
                  <FamilySpouseBlock
                    key={f.id as string}
                    familyId={f.id as string}
                    familyXref={(f.xref as string) ?? ""}
                    spouse={spouse}
                    childRows={kids}
                    childNonBirth={childNonBirth}
                  />
                );
              })}
              {wifeFams.map((fam) => {
                const f = fam as Record<string, unknown>;
                const spouse = f.husband as IndiChild | null;
                const wife = f.wife as IndiChild | null;
                const kids = (f.familyChildren as { child: IndiChild }[] | undefined) ?? [];
                const childNonBirth = buildChildNonBirthIndicatorMap(
                  (f.parentChildRels as ParentChildRelForChildIndicator[]) ?? [],
                  f.id as string,
                  spouse?.id,
                  wife?.id,
                );
                return (
                  <FamilySpouseBlock
                    key={f.id as string}
                    familyId={f.id as string}
                    familyXref={(f.xref as string) ?? ""}
                    spouse={spouse}
                    childRows={kids}
                    childNonBirth={childNonBirth}
                  />
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Linked accounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Website users linked to this person in the admin tree (by GEDCOM xref).
          </p>
        </CardHeader>
        <CardContent>
          {userLinksLoading ? (
            <p className="text-sm text-muted-foreground">Loading linked accounts…</p>
          ) : userLinksErr ? (
            <p className="text-sm text-destructive">{userLinksErr}</p>
          ) : userLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user accounts are linked to this individual.</p>
          ) : (
            <ul className="space-y-3">
              {userLinks.map((row) => {
                const u = row.user;
                const display =
                  stripSlashesFromName(u.name) || u.username || u.email || u.id;
                return (
                  <li
                    key={row.linkId}
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="link link-primary font-medium"
                      >
                        {display}
                      </Link>
                      {row.verified ? (
                        <span className="badge badge-outline badge-primary badge-sm font-normal">
                          Verified
                        </span>
                      ) : null}
                      {!u.isActive ? (
                        <span className="badge badge-ghost badge-sm font-normal">Inactive</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{u.username}</span>
                      {u.email ? ` · ${u.email}` : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Associates</CardTitle>
            <p className="text-sm text-muted-foreground">
              GEDCOM <code className="text-xs">ASSO</code> links (not parents, spouses, or children).
            </p>
          </div>
          {id ? (
            <Link
              href={`/admin/individuals/${encodeURIComponent(id)}/edit#person-associates`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Edit associates
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {richRelationships.length > 0 ? (
              <ul className="space-y-2">
                {richRelationships.map((rel) => {
                  const me = rel.participants.find((p) => p.individualId === id);
                  const other = rel.participants.find((p) => p.individualId !== id);
                  const otherName = other ? (other.individual.fullName?.trim() || other.individual.xref) : "Unknown";
                  return (
                    <li key={rel.id} className="rounded-box border border-primary/20 bg-primary/5 p-3 text-sm">
                      <span className="font-medium">{rel.relationshipType.label}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>
                        {me?.role.label ?? "Participant"} →{" "}
                        {other ? (
                          <Link href={`/admin/individuals/${other.individual.id}`} className="link link-primary">
                            {otherName}
                          </Link>
                        ) : (
                          otherName
                        )}{" "}
                        ({other?.role.label ?? "Participant"})
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {associationsAsSubject.length === 0 ? (
              <p className="text-sm text-muted-foreground">No raw ASSO/RELA rows recorded.</p>
            ) : (
              <ul className="space-y-3">
                {associationsAsSubject.map((row) => {
                  const assoc = row.associateIndividual as Record<string, unknown> | undefined;
                  const aid = typeof assoc?.id === "string" ? assoc.id : "";
                  const name =
                    formatDisplayNameFromNameForms(
                      (assoc?.individualNameForms as Parameters<typeof formatDisplayNameFromNameForms>[0]) ?? [],
                      (assoc?.fullName as string) ?? null,
                    ) ||
                    (assoc?.xref as string) ||
                    aid;
                  const rela = typeof row.rela === "string" ? row.rela.trim() : "";
                  return (
                    <li
                      key={typeof row.id === "string" ? row.id : `${aid}-${rela}`}
                      className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-muted-foreground">{rela || "—"}</span>
                        <span className="text-muted-foreground">→</span>
                        {aid ? (
                          <Link href={`/admin/individuals/${aid}`} className="link link-primary font-medium">
                            {name}
                          </Link>
                        ) : (
                          <span>{name}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Events</CardTitle>
            <p className="text-sm text-muted-foreground">Same timeline as the public tree (self, family, relatives).</p>
          </div>
          {id ? (
            <Link
              href={`/admin/events/new?individualId=${encodeURIComponent(id)}&individualLabel=${encodeURIComponent(fullName)}`}
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
                      `ev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.familyId ?? ""}`
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
                      <IndividualAdminEventContext e={e} />
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
              {events.length > INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE ? (
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

      <EntityOpenQuestionsSection entityType="individual" entityId={id} variant="view" />

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
                <div key={String(s.id)} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm">
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

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
            </p>
          </div>
          <ViewAsAlbumLink entityType="individual" entityId={id} label="View all media" count={media.length} />
        </CardHeader>
        <CardContent>
          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media.</p>
          ) : (
            <AssociatedMediaThumbnailGrid items={media} />
          )}
        </CardContent>
      </Card>

      <EntityHistoryCard entityType="individual" entityId={id} />
    </DetailPageShell>
  );
}

function FamilySpouseBlock({
  familyId,
  familyXref,
  spouse,
  childRows,
  childNonBirth,
}: {
  familyId: string;
  familyXref: string;
  spouse: IndiChild | null;
  childRows: { child: IndiChild }[];
  childNonBirth: Map<string, boolean>;
}) {
  return (
    <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15 text-sm">
      <p className="mb-2 font-mono text-xs text-base-content/55">
        <span className="text-muted-foreground">Family </span>
        <Link href={`/admin/families/${familyId}`} className="link link-primary">
          {familyXref || familyId}
        </Link>
      </p>
      <div>
        <p className="text-xs text-muted-foreground">Partner</p>
        {spouse ? <PersonLink person={spouse} /> : <p className="text-sm text-muted-foreground">—</p>}
      </div>
      <PaginatedFamilyChildrenList
        rows={childRows}
        label="Children"
        renderLink={(c) => <PersonLink person={c} nonBirthChild={childNonBirth.get(c.id)} />}
      />
    </div>
  );
}
