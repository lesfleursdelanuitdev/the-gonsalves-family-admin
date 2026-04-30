"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EventPicker } from "@/components/admin/EventPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { MediaPicker } from "@/components/admin/media-picker/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, deleteJson, postJson } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

export type SourceCitationsPanelProps = {
  isCreate: boolean;
  sourceId: string;
  source: Record<string, unknown>;
};

function CitationFields({
  idPrefix,
  page,
  citationText,
  onPage,
  onCitationText,
}: {
  idPrefix: string;
  page: string;
  citationText: string;
  onPage: (v: string) => void;
  onCitationText: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-page`} className="text-xs">
          Page / film frame (optional)
        </Label>
        <Input id={`${idPrefix}-page`} value={page} onChange={(e) => onPage(e.target.value)} placeholder="e.g. p. 42" className="text-sm" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-cite`} className="text-xs">
          Citation detail (optional)
        </Label>
        <textarea
          id={`${idPrefix}-cite`}
          value={citationText}
          onChange={(e) => onCitationText(e.target.value)}
          rows={2}
          placeholder="Specific reference, quotation, or assessment…"
          className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

export function SourceCitationsPanel({ isCreate, sourceId, source }: SourceCitationsPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [indPage, setIndPage] = useState("");
  const [indCite, setIndCite] = useState("");
  const [famPage, setFamPage] = useState("");
  const [famCite, setFamCite] = useState("");
  const [evPage, setEvPage] = useState("");
  const [evCite, setEvCite] = useState("");

  const [evType, setEvType] = useState("");
  const [evScope, setEvScope] = useState<"individual" | "family">("individual");
  const [evIndGiven, setEvIndGiven] = useState("");
  const [evIndLast, setEvIndLast] = useState("");
  const [evP1Given, setEvP1Given] = useState("");
  const [evP1Last, setEvP1Last] = useState("");
  const [evP2Given, setEvP2Given] = useState("");
  const [evP2Last, setEvP2Last] = useState("");

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const individualSources = Array.isArray(source.individualSources) ? source.individualSources : [];
  const familySources = Array.isArray(source.familySources) ? source.familySources : [];
  const eventSources = Array.isArray(source.eventSources) ? source.eventSources : [];
  const sourceNotes = Array.isArray(source.sourceNotes) ? source.sourceNotes : [];
  const sourceMedia = Array.isArray(source.sourceMedia) ? source.sourceMedia : [];

  const excludeIndividualIds = useMemo(
    () =>
      new Set(
        individualSources
          .map((row: Record<string, unknown>) => {
            const ind = row.individual as Record<string, unknown> | undefined;
            return typeof ind?.id === "string" ? ind.id : "";
          })
          .filter(Boolean),
      ),
    [individualSources],
  );

  const excludeFamilyIds = useMemo(
    () =>
      new Set(
        familySources
          .map((row: Record<string, unknown>) => {
            const fam = row.family as Record<string, unknown> | undefined;
            return typeof fam?.id === "string" ? fam.id : "";
          })
          .filter(Boolean),
      ),
    [familySources],
  );

  const excludeEventIds = useMemo(
    () =>
      new Set(
        eventSources
          .map((row: Record<string, unknown>) => {
            const ev = row.event as Record<string, unknown> | undefined;
            return typeof ev?.id === "string" ? ev.id : "";
          })
          .filter(Boolean),
      ),
    [eventSources],
  );

  const excludeMediaIds = useMemo(
    () =>
      new Set(
        sourceMedia
          .map((row: Record<string, unknown>) => {
            const media = row.media as Record<string, unknown> | undefined;
            return typeof media?.id === "string" ? media.id : "";
          })
          .filter(Boolean),
      ),
    [sourceMedia],
  );

  const linkIndividual = async (individualId: string) => {
    setBusy(true);
    try {
      await postJson(`/api/admin/sources/${sourceId}/individual-sources`, {
        individualId,
        page: indPage.trim() || undefined,
        citationText: indCite.trim() || undefined,
      });
      toast.success("Linked to person.");
      setIndPage("");
      setIndCite("");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Link failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const linkFamily = async (familyId: string) => {
    setBusy(true);
    try {
      await postJson(`/api/admin/sources/${sourceId}/family-sources`, {
        familyId,
        page: famPage.trim() || undefined,
        citationText: famCite.trim() || undefined,
      });
      toast.success("Linked to family.");
      setFamPage("");
      setFamCite("");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Link failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const linkEvent = async (eventId: string) => {
    setBusy(true);
    try {
      await postJson(`/api/admin/sources/${sourceId}/event-sources`, {
        eventId,
        page: evPage.trim() || undefined,
        citationText: evCite.trim() || undefined,
      });
      toast.success("Linked to event.");
      setEvPage("");
      setEvCite("");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Link failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const unlinkIndividual = async (linkId: string) => {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/sources/${sourceId}/individual-sources/${linkId}`);
      toast.success("Citation removed.");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unlink failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const unlinkFamily = async (linkId: string) => {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/sources/${sourceId}/family-sources/${linkId}`);
      toast.success("Citation removed.");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unlink failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const unlinkEvent = async (linkId: string) => {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/sources/${sourceId}/event-sources/${linkId}`);
      toast.success("Citation removed.");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unlink failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const unlinkMedia = async (mediaId: string, linkId: string) => {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/media/${mediaId}/source-media/${linkId}`);
      toast.success("Media link removed.");
      refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unlink failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (isCreate) {
    return (
      <p className="text-sm text-muted-foreground">
        Save this source first, then you can link it to people, families, events, and media from this section.
      </p>
    );
  }

  const hasAnyLinks =
    individualSources.length > 0 ||
    familySources.length > 0 ||
    eventSources.length > 0 ||
    sourceNotes.length > 0 ||
    sourceMedia.length > 0;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-base-content/12 bg-base-content/[0.02] p-4 space-y-6">
        <div>
          <p className="text-sm font-medium text-foreground">Add citations</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search the tree and attach this source. Optional page and citation fields apply to the next link you pick.
          </p>
        </div>

        <div className="space-y-3 border-b border-base-content/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Person</p>
          <CitationFields
            idPrefix="src-cite-ind"
            page={indPage}
            citationText={indCite}
            onPage={setIndPage}
            onCitationText={setIndCite}
          />
          <IndividualSearchPicker
            idPrefix="src-cite-ind-pick"
            label="Search people"
            description="Pick someone to cite this source on their record."
            excludeIds={excludeIndividualIds}
            isPickDisabled={() => busy}
            onPick={(ind) => void linkIndividual(ind.id)}
            allowEmptySearch={false}
          />
        </div>

        <div className="space-y-3 border-b border-base-content/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family</p>
          <CitationFields
            idPrefix="src-cite-fam"
            page={famPage}
            citationText={famCite}
            onPage={setFamPage}
            onCitationText={setFamCite}
          />
          <FamilySearchPicker
            idPrefix="src-cite-fam-pick"
            label="Search families"
            description="Pick a couple record to attach this source."
            excludeIds={excludeFamilyIds}
            isPickDisabled={() => busy}
            onPick={(fam) => void linkFamily(fam.id)}
            allowEmptySearch={false}
          />
        </div>

        <div className="space-y-3 border-b border-base-content/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event</p>
          <CitationFields
            idPrefix="src-cite-ev"
            page={evPage}
            citationText={evCite}
            onPage={setEvPage}
            onCitationText={setEvCite}
          />
          <EventPicker
            idPrefix="src-cite-ev-pick"
            requireEventType={false}
            eventType={evType}
            onEventTypeChange={setEvType}
            linkScope={evScope}
            onLinkScopeChange={setEvScope}
            indGiven={evIndGiven}
            indLast={evIndLast}
            onIndGivenChange={setEvIndGiven}
            onIndLastChange={setEvIndLast}
            famP1Given={evP1Given}
            famP1Last={evP1Last}
            famP2Given={evP2Given}
            famP2Last={evP2Last}
            onFamP1GivenChange={setEvP1Given}
            onFamP1LastChange={setEvP1Last}
            onFamP2GivenChange={setEvP2Given}
            onFamP2LastChange={setEvP2Last}
            excludeEventIds={excludeEventIds}
            isPickDisabled={() => busy}
            onPick={(ev) => void linkEvent(ev.id)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media</p>
          <p className="text-xs text-muted-foreground">
            Attach archive items as evidence for this source (same as linking from the media library).
          </p>
          <MediaPicker
            targetType="source"
            targetId={sourceId}
            triggerLabel="Link media"
            excludeMediaIds={excludeMediaIds}
            onAttach={() => refresh()}
          />
        </div>
      </div>

      {!hasAnyLinks ? (
        <p className="text-sm text-muted-foreground">
          Nothing linked yet. Use the tools above, or attach this source from a person, family, or event screen.
        </p>
      ) : (
        <div className="space-y-6">
          {individualSources.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Individuals</p>
              <ul className="mt-2 space-y-2 text-sm">
                {individualSources.map((row: Record<string, unknown>) => {
                  const ind = row.individual as Record<string, unknown> | undefined;
                  const id = typeof ind?.id === "string" ? ind.id : "";
                  const name = stripSlashesFromName(typeof ind?.fullName === "string" ? ind.fullName : null) || "—";
                  const page = typeof row.page === "string" ? row.page.trim() : "";
                  const cite = typeof row.citationText === "string" ? row.citationText.trim() : "";
                  const linkId = String(row.id ?? "");
                  return (
                    <li key={linkId || `${id}-ind`} className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {id ? (
                          <Link href={`/admin/individuals/${id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                        {page ? <p className="mt-1 text-xs text-muted-foreground">Page: {page}</p> : null}
                        {cite ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{cite}</p> : null}
                      </div>
                      {linkId ? (
                        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => void unlinkIndividual(linkId)}>
                          Unlink
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {familySources.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Families</p>
              <ul className="mt-2 space-y-2 text-sm">
                {familySources.map((row: Record<string, unknown>) => {
                  const fam = row.family as Record<string, unknown> | undefined;
                  const id = typeof fam?.id === "string" ? fam.id : "";
                  const h = stripSlashesFromName((fam?.husband as Record<string, unknown> | undefined)?.fullName as string | undefined);
                  const w = stripSlashesFromName((fam?.wife as Record<string, unknown> | undefined)?.fullName as string | undefined);
                  const label = [h, w].filter(Boolean).join(" · ") || "Family";
                  const page = typeof row.page === "string" ? row.page.trim() : "";
                  const linkId = String(row.id ?? "");
                  return (
                    <li key={linkId || `${id}-fam`} className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {id ? (
                          <Link href={`/admin/families/${id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                            {label}
                          </Link>
                        ) : (
                          <span className="font-medium">{label}</span>
                        )}
                        {page ? <p className="mt-1 text-xs text-muted-foreground">Page: {page}</p> : null}
                      </div>
                      {linkId ? (
                        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => void unlinkFamily(linkId)}>
                          Unlink
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {eventSources.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Events</p>
              <ul className="mt-2 space-y-2 text-sm">
                {eventSources.map((row: Record<string, unknown>) => {
                  const ev = row.event as Record<string, unknown> | undefined;
                  const id = typeof ev?.id === "string" ? ev.id : "";
                  const et = typeof ev?.eventType === "string" ? ev.eventType : "";
                  const eventLabel = labelGedcomEventType(et) || et || "Event";
                  const page = typeof row.page === "string" ? row.page.trim() : "";
                  const linkId = String(row.id ?? "");
                  return (
                    <li key={linkId || `${id}-ev`} className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {id ? (
                          <Link href={`/admin/events/${id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                            {eventLabel}
                          </Link>
                        ) : (
                          <span className="font-medium">{eventLabel}</span>
                        )}
                        {page ? <p className="mt-1 text-xs text-muted-foreground">Page: {page}</p> : null}
                      </div>
                      {linkId ? (
                        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => void unlinkEvent(linkId)}>
                          Unlink
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {sourceNotes.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              <ul className="mt-2 space-y-2 text-sm">
                {sourceNotes.map((row: Record<string, unknown>) => {
                  const note = row.note as Record<string, unknown> | undefined;
                  const id = typeof note?.id === "string" ? note.id : "";
                  const nx = typeof note?.xref === "string" ? note.xref.trim() : "";
                  return (
                    <li key={String(row.id ?? id)} className="rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2">
                      {id ? (
                        <Link href={`/admin/notes/${id}/edit`} className="font-medium text-primary underline-offset-2 hover:underline">
                          {nx || "Note"}
                        </Link>
                      ) : (
                        <span>{nx || "Note"}</span>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">Unlink from the note editor.</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {sourceMedia.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media</p>
              <ul className="mt-2 space-y-2 text-sm">
                {sourceMedia.map((row: Record<string, unknown>) => {
                  const media = row.media as Record<string, unknown> | undefined;
                  const mediaId = typeof media?.id === "string" ? media.id : "";
                  const mt = typeof media?.title === "string" && media.title.trim() ? media.title.trim() : "Media";
                  const linkId = String(row.id ?? "");
                  return (
                    <li key={linkId || mediaId} className="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.02] px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {mediaId ? (
                          <Link href={`/admin/media/${mediaId}`} className="font-medium text-primary underline-offset-2 hover:underline">
                            {mt}
                          </Link>
                        ) : (
                          <span>{mt}</span>
                        )}
                      </div>
                      {linkId && mediaId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={busy}
                          onClick={() => void unlinkMedia(mediaId, linkId)}
                        >
                          Unlink
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
