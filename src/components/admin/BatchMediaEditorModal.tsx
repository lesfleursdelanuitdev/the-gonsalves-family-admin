"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";
import { emptyDateDraft, emptyPlaceDraft, formatEventDescriptiveLabel } from "@/components/admin/media-editor/media-editor-helpers";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { dateSliceToApiPayload, placeSliceToApiPayload } from "@/lib/forms/media-link-payloads";
import type { GedcomDateFormSlice, GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";
import { fetchJson, postJson, ApiError } from "@/lib/infra/api";
import { ADMIN_MEDIA_QUERY_KEY } from "@/hooks/useAdminMedia";
import { useAdminTags, type AdminTagListItem } from "@/hooks/useAdminTags";
import { useAdminAlbums, type AdminAlbumListItem } from "@/hooks/useAdminAlbums";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { selectClassName } from "@/components/data-viewer/constants";

const MIXED = "— Mixed values —";

function dateFingerprint(m: MediaEditorInitial): string {
  const ids = (m.dateLinks ?? [])
    .map((l) => l.date.id)
    .sort()
    .join(",");
  return ids;
}

function placeFingerprint(m: MediaEditorInitial): string {
  const ids = (m.placeLinks ?? [])
    .map((l) => l.place.id)
    .sort()
    .join(",");
  return ids;
}

async function postIgnore409(url: string, body: Record<string, unknown>): Promise<void> {
  try {
    await postJson(url, body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return;
    throw e;
  }
}

type StagedInd = { individualId: string; label: string };
type StagedFam = { familyId: string; label: string };
type StagedEv = { eventId: string; label: string };
type StagedBatchTag = { tagId: string; name: string; color: string | null };
type StagedBatchAlbum = { albumId: string; name: string };

export function BatchMediaEditorModal({
  open,
  onOpenChange,
  mediaIds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaIds: string[];
  onApplied: () => void;
}) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dateMixed, setDateMixed] = useState(false);
  const [placeMixed, setPlaceMixed] = useState(false);
  const [dateDraft, setDateDraft] = useState<GedcomDateFormSlice>(() => emptyDateDraft());
  const [placeDraft, setPlaceDraft] = useState<GedcomPlaceFormSlice>(() => emptyPlaceDraft());
  const [stagedIndividuals, setStagedIndividuals] = useState<StagedInd[]>([]);
  const [stagedFamilies, setStagedFamilies] = useState<StagedFam[]>([]);
  const [stagedEvents, setStagedEvents] = useState<StagedEv[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");
  const [batchTags, setBatchTags] = useState<StagedBatchTag[]>([]);
  const [batchAlbums, setBatchAlbums] = useState<StagedBatchAlbum[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [createAlbumAsPublic, setCreateAlbumAsPublic] = useState(false);

  const debouncedTagQ = useDebouncedValue(tagQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedAlbumQ = useDebouncedValue(albumQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const tagsQuery = useAdminTags({ q: debouncedTagQ, limit: 40 }, { enabled: debouncedTagQ.length >= 1 });
  const albumsQuery = useAdminAlbums({ q: debouncedAlbumQ, limit: 40 }, { enabled: debouncedAlbumQ.length >= 1 });
  const tagResults = useMemo(() => tagsQuery.data?.tags ?? [], [tagsQuery.data?.tags]);
  const albumResults = useMemo(() => albumsQuery.data?.albums ?? [], [albumsQuery.data?.albums]);
  const exactTagMatch = useMemo(
    () => tagResults.some((t) => displayTagName(t.name) === displayTagName(tagQuery)),
    [tagResults, tagQuery],
  );
  const exactAlbumMatch = useMemo(
    () => albumResults.some((a) => a.name.toLowerCase() === albumQuery.trim().toLowerCase()),
    [albumResults, albumQuery],
  );

  const stagedIndividualIdSet = useMemo(
    () => new Set(stagedIndividuals.map((r) => r.individualId)),
    [stagedIndividuals],
  );
  const stagedFamilyIdSet = useMemo(() => new Set(stagedFamilies.map((r) => r.familyId)), [stagedFamilies]);
  const stagedEventIdSet = useMemo(() => new Set(stagedEvents.map((r) => r.eventId)), [stagedEvents]);

  useEffect(() => {
    if (!open || mediaIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const results = await Promise.all(
          mediaIds.map((id) => fetchJson<{ media: MediaEditorInitial }>(`/api/admin/media/${id}`)),
        );
        if (cancelled) return;
        const media = results.map((r) => r.media);
        const dfps = media.map(dateFingerprint);
        setDateMixed(new Set(dfps).size > 1);
        const pfps = media.map(placeFingerprint);
        setPlaceMixed(new Set(pfps).size > 1);
        setDateDraft(emptyDateDraft());
        setPlaceDraft(emptyPlaceDraft());
        setStagedIndividuals([]);
        setStagedFamilies([]);
        setStagedEvents([]);
        setBatchTags([]);
        setBatchAlbums([]);
        setTagQuery("");
        setAlbumQuery("");
        setPeopleOpen(false);
        setFamilyOpen(false);
        setEventOpen(false);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not load media.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mediaIds]);

  const sectionClass = "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6";

  const addBatchTag = useCallback((row: AdminTagListItem) => {
    setBatchTags((prev) => {
      if (prev.some((t) => t.tagId === row.id)) return prev;
      return [...prev, { tagId: row.id, name: row.name, color: row.color }];
    });
    setTagQuery("");
  }, []);

  const createAndAddBatchTag = useCallback(async () => {
    const name = tagQuery.trim();
    if (!name) return;
    setErr(null);
    try {
      const res = await postJson<{ tag: AdminTagListItem }>("/api/admin/tags", { name });
      addBatchTag(res.tag);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create tag");
    }
  }, [tagQuery, addBatchTag]);

  const addBatchAlbum = useCallback((row: AdminAlbumListItem) => {
    setBatchAlbums((prev) => {
      if (prev.some((a) => a.albumId === row.id)) return prev;
      return [...prev, { albumId: row.id, name: row.name }];
    });
    setAlbumQuery("");
  }, []);

  const createAndAddBatchAlbum = useCallback(async () => {
    const name = albumQuery.trim();
    if (!name) return;
    setErr(null);
    try {
      const res = await postJson<{ album: AdminAlbumListItem }>("/api/admin/albums", {
        name,
        isPublic: createAlbumAsPublic,
      });
      addBatchAlbum(res.album);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not create album");
    }
  }, [albumQuery, createAlbumAsPublic, addBatchAlbum]);

  const handleSave = useCallback(async () => {
    if (mediaIds.length === 0) return;
    const datePayload = dateSliceToApiPayload(dateDraft);
    const placePayload = placeSliceToApiPayload(placeDraft);
    const hasDate = datePayload != null && Object.keys(datePayload).length > 0;
    const hasPlace = placePayload != null && Object.keys(placePayload).length > 0;
    const hasLinks =
      stagedIndividuals.length > 0 || stagedFamilies.length > 0 || stagedEvents.length > 0;
    const hasOrg = batchTags.length > 0 || batchAlbums.length > 0;
    if (!hasDate && !hasPlace && !hasLinks && !hasOrg) {
      toast.message("Nothing to apply", {
        description: "Enter a date or place, or add links, tags, or albums.",
      });
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      for (const id of mediaIds) {
        const base = `/api/admin/media/${id}`;
        if (hasDate) await postIgnore409(`${base}/date-media`, { date: datePayload });
        if (hasPlace) await postIgnore409(`${base}/place-media`, { place: placePayload });
        for (const row of stagedIndividuals) {
          await postIgnore409(`${base}/individual-media`, { individualId: row.individualId });
        }
        for (const row of stagedFamilies) {
          await postIgnore409(`${base}/family-media`, { familyId: row.familyId });
        }
        for (const row of stagedEvents) {
          await postIgnore409(`${base}/event-media`, { eventId: row.eventId });
        }
        for (const row of batchTags) {
          await postIgnore409(`${base}/app-tags`, { tagId: row.tagId });
        }
        for (const row of batchAlbums) {
          await postIgnore409(`${base}/album-links`, { albumId: row.albumId });
        }
      }
      await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
      await qc.invalidateQueries({ queryKey: ["admin", "tags"] });
      await qc.invalidateQueries({ queryKey: ["admin", "albums"] });
      toast.success(`Updated ${mediaIds.length} media ${mediaIds.length === 1 ? "item" : "items"}.`);
      onOpenChange(false);
      onApplied();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [
    mediaIds,
    dateDraft,
    placeDraft,
    stagedIndividuals,
    stagedFamilies,
    stagedEvents,
    batchTags,
    batchAlbums,
    qc,
    onOpenChange,
    onApplied,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,920px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 space-y-1.5 border-b border-base-content/10 px-6 py-4 text-left">
          <DialogTitle>
            Editing {mediaIds.length} media {mediaIds.length === 1 ? "item" : "items"}
          </DialogTitle>
          <DialogDescription>
            Changes apply to every selected item. Title, description, and file metadata are not changed here.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="text-sm">Loading current links…</span>
            </div>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : (
            <div className="space-y-6">
              {dateMixed ? (
                <p className="text-sm font-medium text-muted-foreground">{MIXED} (existing dates)</p>
              ) : null}
              <section className={sectionClass}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Date</h3>
                  <p className="text-sm text-muted-foreground">
                    Adds this date to each selected item (duplicates are skipped).
                  </p>
                </div>
                <GedcomDateInput
                  idPrefix="batch-media-date"
                  value={dateDraft}
                  onChange={(patch) => setDateDraft((prev) => ({ ...prev, ...patch }))}
                  eventStyleHints
                />
              </section>

              {placeMixed ? (
                <p className="text-sm font-medium text-muted-foreground">{MIXED} (existing places)</p>
              ) : null}
              <section className={sectionClass}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Place</h3>
                  <p className="text-sm text-muted-foreground">
                    Adds this place to each selected item (duplicates are skipped).
                  </p>
                </div>
                <GedcomPlaceInput
                  idPrefix="batch-media-place"
                  value={placeDraft}
                  onChange={(patch) => setPlaceDraft((prev) => ({ ...prev, ...patch }))}
                  eventStyleHints
                />
              </section>

              <section className={sectionClass}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Links</h3>
                  <p className="text-sm text-muted-foreground">
                    Add people, families, and events to link to every selected item.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Individuals</Label>
                    <div className="flex flex-wrap gap-2">
                      {stagedIndividuals.map((row) => (
                        <MediaEditorPill
                          key={row.individualId}
                          label={row.label}
                          onRemove={() =>
                            setStagedIndividuals((prev) => prev.filter((x) => x.individualId !== row.individualId))
                          }
                          disabled={saving}
                        />
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPeopleOpen((v) => !v)}>
                      <Plus className="size-4" aria-hidden />
                      Add person
                    </Button>
                    {peopleOpen ? (
                      <IndividualSearchPicker
                        idPrefix="batch-media-indiv"
                        excludeIds={stagedIndividualIdSet}
                        onPick={(ind: AdminIndividualListItem) => {
                          setStagedIndividuals((prev) => [
                            ...prev,
                            {
                              individualId: ind.id,
                              label: individualSearchDisplayName(ind),
                            },
                          ]);
                          setPeopleOpen(false);
                        }}
                        limit={30}
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Families</Label>
                    <div className="flex flex-wrap gap-2">
                      {stagedFamilies.map((row) => (
                        <MediaEditorPill
                          key={row.familyId}
                          label={row.label}
                          onRemove={() =>
                            setStagedFamilies((prev) => prev.filter((x) => x.familyId !== row.familyId))
                          }
                          disabled={saving}
                        />
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setFamilyOpen((v) => !v)}>
                      <Plus className="size-4" aria-hidden />
                      Add family
                    </Button>
                    {familyOpen ? (
                      <FamilySearchPicker
                        idPrefix="batch-media-fam"
                        excludeIds={stagedFamilyIdSet}
                        onPick={(fam: AdminFamilyListItem) => {
                          setStagedFamilies((prev) => [
                            ...prev,
                            { familyId: fam.id, label: familyUnionPrimaryLine(fam) },
                          ]);
                          setFamilyOpen(false);
                        }}
                        limit={30}
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Events</Label>
                    <div className="flex flex-wrap gap-2">
                      {stagedEvents.map((row) => (
                        <MediaEditorPill
                          key={row.eventId}
                          label={row.label}
                          onRemove={() => setStagedEvents((prev) => prev.filter((x) => x.eventId !== row.eventId))}
                          disabled={saving}
                        />
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setEventOpen((v) => !v)}>
                      <Plus className="size-4" aria-hidden />
                      Add event
                    </Button>
                    {eventOpen ? (
                      <EventPicker
                        idPrefix="batch-media-ev"
                        requireEventType
                        eventType={eventTypeFilter}
                        onEventTypeChange={setEventTypeFilter}
                        linkScope={eventLinkKind}
                        onLinkScopeChange={setEventLinkKind}
                        indGiven={eventIndivGiven}
                        indLast={eventIndivLast}
                        onIndGivenChange={setEventIndivGiven}
                        onIndLastChange={setEventIndivLast}
                        famP1Given={eventFamP1Given}
                        famP1Last={eventFamP1Last}
                        famP2Given={eventFamP2Given}
                        famP2Last={eventFamP2Last}
                        onFamP1GivenChange={setEventFamP1Given}
                        onFamP1LastChange={setEventFamP1Last}
                        onFamP2GivenChange={setEventFamP2Given}
                        onFamP2LastChange={setEventFamP2Last}
                        excludeEventIds={stagedEventIdSet}
                        formatRowLabel={formatEventDescriptiveLabel}
                        onPick={(ev: AdminEventListItem) => {
                          setStagedEvents((prev) => [
                            ...prev,
                            { eventId: ev.id, label: formatEventDescriptiveLabel(ev) },
                          ]);
                          setEventOpen(false);
                        }}
                        limit={100}
                        linkScopeAsRadios
                        partner1Legend="Partner 1"
                        partner2Legend="Partner 2"
                      />
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={sectionClass}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Organization</h3>
                  <p className="text-sm text-muted-foreground">
                    Same as the single media editor: search or create tags and albums; they are applied to every
                    selected item (existing links are kept; duplicates are skipped).
                  </p>
                </div>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {batchTags.map((t) => (
                        <MediaEditorPill
                          key={t.tagId}
                          label={displayTagName(t.name)}
                          onRemove={() => setBatchTags((prev) => prev.filter((x) => x.tagId !== t.tagId))}
                          disabled={saving}
                        />
                      ))}
                    </div>
                    <div className="relative">
                      <Input
                        value={tagQuery}
                        onChange={(e) => setTagQuery(e.target.value)}
                        placeholder="Search tags or type a new name…"
                        autoComplete="off"
                        disabled={saving}
                      />
                      {tagQuery.trim().length >= 1 ? (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                          {tagsQuery.isLoading ? (
                            <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                          ) : (
                            <>
                              {tagResults.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200/80"
                                  onClick={() => addBatchTag(t)}
                                >
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: t.color ?? "var(--color-base-content)" }}
                                    aria-hidden
                                  />
                                  <span className="truncate">{displayTagName(t.name)}</span>
                                </button>
                              ))}
                              {!exactTagMatch && tagQuery.trim() ? (
                                <button
                                  type="button"
                                  className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                                  onClick={() => void createAndAddBatchTag()}
                                >
                                  Create tag “{displayTagName(tagQuery)}”
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Albums</Label>
                    <div className="flex flex-wrap gap-2">
                      {batchAlbums.map((a) => (
                        <MediaEditorPill
                          key={a.albumId}
                          label={a.name}
                          onRemove={() => setBatchAlbums((prev) => prev.filter((x) => x.albumId !== a.albumId))}
                          disabled={saving}
                        />
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <div className="relative">
                        <Input
                          value={albumQuery}
                          onChange={(e) => setAlbumQuery(e.target.value)}
                          placeholder="Search albums or type a new name…"
                          autoComplete="off"
                          disabled={saving}
                        />
                        {albumQuery.trim().length >= 1 ? (
                          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                            {albumsQuery.isLoading ? (
                              <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                            ) : (
                              <>
                                {albumResults.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                                    onClick={() => addBatchAlbum(a)}
                                  >
                                    {a.name}
                                  </button>
                                ))}
                                {!exactAlbumMatch && albumQuery.trim() ? (
                                  <button
                                    type="button"
                                    className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                                    onClick={() => void createAndAddBatchAlbum()}
                                  >
                                    Create album “{albumQuery.trim()}”
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="batch-album-visibility">New album visibility</Label>
                        <select
                          id="batch-album-visibility"
                          className={selectClassName}
                          value={createAlbumAsPublic ? "public" : "private"}
                          onChange={(e) => setCreateAlbumAsPublic(e.target.value === "public")}
                          disabled={saving}
                        >
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-base-content/10 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => void handleSave()}
            disabled={loading || saving || mediaIds.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save to all"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
