"use client";

/** REST body shapes for media junction routes: see `src/lib/admin/media-junction-api.ts`. */
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, deleteJson, postJson } from "@/lib/infra/api";
import { ADMIN_MEDIA_QUERY_KEY, type AdminMediaScope } from "@/hooks/useAdminMedia";

function mediaOrganisationBase(mediaId: string, scope: AdminMediaScope): string {
  if (scope === "site-assets") return `/api/admin/site-media/${mediaId}`;
  if (scope === "my-media") return `/api/admin/user-media/${mediaId}`;
  return `/api/admin/media/${mediaId}`;
}
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminAlbums, type AdminAlbumListItem } from "@/hooks/useAdminAlbums";
import { useAdminTags, type AdminTagListItem } from "@/hooks/useAdminTags";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { dateSliceToApiPayload, placeSliceToApiPayload } from "@/lib/forms/media-link-payloads";
import { formatGedcomDateFormSliceLabel } from "@/lib/forms/admin-date-suggestions";
import { formatGedcomPlaceFormSliceLabel } from "@/lib/forms/admin-place-suggestions";
import { displayTagName } from "@/lib/admin/display-tag-name";
import type {
  FamilySearchRow,
  MediaEditorInitial,
  StagedAlbum,
  StagedDateLink,
  StagedEventMedia,
  StagedFamilyMedia,
  StagedIndividualMedia,
  StagedPlaceLink,
  StagedTag,
} from "@/components/admin/media-editor/media-editor-types";
import {
  emptyDateDraft,
  emptyPlaceDraft,
  formatEventDescriptiveLabel,
  formatEventLinkLabel,
  labelFromDateApi,
  labelFromPlaceApi,
  minimalIndividualListItem,
} from "@/components/admin/media-editor/media-editor-helpers";

export type UseMediaEditorLinksArgs = {
  mode: "create" | "edit";
  /** Empty string in create mode. */
  mediaId: string;
  initial: MediaEditorInitial | null;
  prefillIndividuals?: { individualId: string; label: string }[];
  prefillFamilies?: { familyId: string; label: string }[];
  setErrMsg: (msg: string | null) => void;
  /** For React Query detail key; must match {@link useAdminMediaItem}. */
  detailScope?: AdminMediaScope;
};

type UseMediaEditorOrganisationLinksArgs = {
  mode: "create" | "edit";
  mediaId: string;
  initial: MediaEditorInitial | null;
  setErrMsg: (msg: string | null) => void;
  invalidateMediaQueries: () => Promise<void>;
  organisationScope: AdminMediaScope;
};

function useMediaEditorOrganisationLinks({
  mode,
  mediaId,
  initial,
  setErrMsg,
  invalidateMediaQueries,
  organisationScope,
}: UseMediaEditorOrganisationLinksArgs) {
  const orgBase = mediaOrganisationBase(mediaId, organisationScope);
  const [stagedTags, setStagedTags] = useState<StagedTag[]>(() =>
    (initial?.appTags ?? []).map((r) => ({
      tagId: r.tag.id,
      linkId: r.id,
      name: displayTagName(r.tag.name),
      color: r.tag.color,
    })),
  );
  const [stagedAlbums, setStagedAlbums] = useState<StagedAlbum[]>(() =>
    (initial?.albumLinks ?? []).map((r) => ({
      albumId: r.album.id,
      linkId: r.id,
      name: r.album.name,
    })),
  );
  const [tagQuery, setTagQuery] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  /** When creating an album from the media editor search ("Create album …"), maps to `is_public` (uniqueness applies only to public). */
  const [createAlbumAsPublic, setCreateAlbumAsPublic] = useState(false);

  const debouncedTagQ = useDebouncedValue(tagQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedAlbumQ = useDebouncedValue(albumQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const tagsQuery = useAdminTags(
    { q: debouncedTagQ, limit: 40 },
    { enabled: debouncedTagQ.length >= 1 },
  );
  const albumsQuery = useAdminAlbums(
    { q: debouncedAlbumQ, limit: 40 },
    { enabled: debouncedAlbumQ.length >= 1 },
  );
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

  const addTag = async (row: AdminTagListItem) => {
    if (stagedTags.some((t) => t.tagId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ appTag: { id: string; tag: { id: string; name: string; color: string | null } } }>(
          `${orgBase}/app-tags`,
          { tagId: row.id },
        );
        setStagedTags((s) => [
          ...s,
          {
            tagId: res.appTag.tag.id,
            linkId: res.appTag.id,
            name: displayTagName(res.appTag.tag.name),
            color: res.appTag.tag.color,
          },
        ]);
        setTagQuery("");
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not add tag");
      }
      return;
    }
    setStagedTags((s) => [...s, { tagId: row.id, name: displayTagName(row.name), color: row.color }]);
    setTagQuery("");
  };

  const removeTag = async (t: StagedTag) => {
    setErrMsg(null);
    if (mode === "edit" && t.linkId) {
      try {
        await deleteJson(`${orgBase}/app-tags/${t.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove tag");
        return;
      }
    }
    setStagedTags((s) => s.filter((x) => x.tagId !== t.tagId));
  };

  const createAndAddTag = async () => {
    const name = tagQuery.trim();
    if (!name) return;
    setErrMsg(null);
    try {
      const res = await postJson<{ tag: AdminTagListItem }>("/api/admin/tags", { name });
      await addTag(res.tag);
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Could not create tag");
    }
  };

  const addAlbum = async (row: AdminAlbumListItem) => {
    if (stagedAlbums.some((a) => a.albumId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ albumLink: { id: string; album: { id: string; name: string } } }>(
          `${orgBase}/album-links`,
          { albumId: row.id },
        );
        setStagedAlbums((s) => [
          ...s,
          { albumId: res.albumLink.album.id, linkId: res.albumLink.id, name: res.albumLink.album.name },
        ]);
        setAlbumQuery("");
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not add album");
      }
      return;
    }
    setStagedAlbums((s) => [...s, { albumId: row.id, name: row.name }]);
    setAlbumQuery("");
  };

  const removeAlbum = async (a: StagedAlbum) => {
    setErrMsg(null);
    if (mode === "edit" && a.linkId) {
      try {
        await deleteJson(`${orgBase}/album-links/${a.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove album");
        return;
      }
    }
    setStagedAlbums((s) => s.filter((x) => x.albumId !== a.albumId));
  };

  const createAndAddAlbum = async () => {
    const name = albumQuery.trim();
    if (!name) return;
    setErrMsg(null);
    try {
      const res = await postJson<{ album: AdminAlbumListItem }>("/api/admin/albums", {
        name,
        isPublic: createAlbumAsPublic,
      });
      await addAlbum(res.album);
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Could not create album");
    }
  };

  return {
    stagedTags,
    stagedAlbums,
    tagQuery,
    setTagQuery,
    albumQuery,
    setAlbumQuery,
    createAlbumAsPublic,
    setCreateAlbumAsPublic,
    tagsQuery,
    albumsQuery,
    tagResults,
    albumResults,
    exactTagMatch,
    exactAlbumMatch,
    addTag,
    removeTag,
    createAndAddTag,
    addAlbum,
    removeAlbum,
    createAndAddAlbum,
  };
}

type UseMediaEditorEntityLinksArgs = {
  mode: "create" | "edit";
  mediaId: string;
  initial: MediaEditorInitial | null;
  prefillIndividuals?: { individualId: string; label: string }[];
  prefillFamilies?: { familyId: string; label: string }[];
  setErrMsg: (msg: string | null) => void;
  invalidateMediaQueries: () => Promise<void>;
};

function useMediaEditorEntityLinks({
  mode,
  mediaId,
  initial,
  prefillIndividuals,
  prefillFamilies,
  setErrMsg,
  invalidateMediaQueries,
}: UseMediaEditorEntityLinksArgs) {
  const [stagedIndividuals, setStagedIndividuals] = useState<StagedIndividualMedia[]>(() => {
    if (mode === "edit" && initial) {
      return (initial.individualMedia ?? []).map((r) => ({
        individualId: r.individual.id,
        linkId: r.id,
        label: individualSearchDisplayName(minimalIndividualListItem(r.individual)),
      }));
    }
    if (mode === "create" && prefillIndividuals?.length) {
      return prefillIndividuals.map((p) => ({
        individualId: p.individualId,
        label: p.label,
      }));
    }
    return [];
  });
  const [stagedFamilies, setStagedFamilies] = useState<StagedFamilyMedia[]>(() => {
    if (mode === "edit" && initial) {
      return (initial.familyMedia ?? []).map((r) => ({
        familyId: r.family.id,
        linkId: r.id,
        label: familyUnionPrimaryLine(r.family as FamilySearchRow),
      }));
    }
    if (mode === "create" && prefillFamilies?.length) {
      return prefillFamilies.map((p) => ({
        familyId: p.familyId,
        label: p.label,
      }));
    }
    return [];
  });
  const [stagedEvents, setStagedEvents] = useState<StagedEventMedia[]>(() =>
    (initial?.eventMedia ?? []).map((r) => ({
      eventId: r.event.id,
      linkId: r.id,
      label: formatEventLinkLabel(r.event),
    })),
  );

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");

  const addIndividualLink = async (ind: AdminIndividualListItem) => {
    if (stagedIndividuals.some((x) => x.individualId === ind.id)) return;
    setErrMsg(null);
    const label = individualSearchDisplayName(ind);
    if (mode === "edit") {
      try {
        const res = await postJson<{
          individualMedia: { id: string; individual: { id: string; xref: string | null; fullName: string | null } };
        }>(`/api/admin/media/${mediaId}/individual-media`, { individualId: ind.id });
        setStagedIndividuals((s) => [
          ...s,
          {
            individualId: res.individualMedia.individual.id,
            linkId: res.individualMedia.id,
            label: individualSearchDisplayName(minimalIndividualListItem(res.individualMedia.individual)),
          },
        ]);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link individual");
      }
      return;
    }
    setStagedIndividuals((s) => [...s, { individualId: ind.id, label }]);
  };

  const removeIndividualLink = async (t: StagedIndividualMedia) => {
    setErrMsg(null);
    if (mode === "edit" && t.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/individual-media/${t.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove individual link");
        return;
      }
    }
    setStagedIndividuals((s) => s.filter((x) => x.individualId !== t.individualId));
  };

  const addFamilyLink = async (row: AdminFamilyListItem) => {
    if (stagedFamilies.some((x) => x.familyId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ familyMedia: { id: string; family: FamilySearchRow } }>(
          `/api/admin/media/${mediaId}/family-media`,
          { familyId: row.id },
        );
        setStagedFamilies((s) => [
          ...s,
          {
            familyId: res.familyMedia.family.id,
            linkId: res.familyMedia.id,
            label: familyUnionPrimaryLine(res.familyMedia.family),
          },
        ]);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link family");
      }
      return;
    }
    setStagedFamilies((s) => [...s, { familyId: row.id, label: familyUnionPrimaryLine(row) }]);
  };

  const removeFamilyLink = async (t: StagedFamilyMedia) => {
    setErrMsg(null);
    if (mode === "edit" && t.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/family-media/${t.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove family link");
        return;
      }
    }
    setStagedFamilies((s) => s.filter((x) => x.familyId !== t.familyId));
  };

  const clearEventPickerFields = useCallback(() => {
    setEventIndivGiven("");
    setEventIndivLast("");
    setEventFamP1Given("");
    setEventFamP1Last("");
    setEventFamP2Given("");
    setEventFamP2Last("");
  }, []);

  const onEventLinkScopeChange = useCallback((v: "individual" | "family") => {
    setEventLinkKind(v);
    if (v === "individual") {
      setEventFamP1Given("");
      setEventFamP1Last("");
      setEventFamP2Given("");
      setEventFamP2Last("");
    } else {
      setEventIndivGiven("");
      setEventIndivLast("");
    }
  }, []);

  const addEventLink = async (row: AdminEventListItem) => {
    if (stagedEvents.some((x) => x.eventId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ eventMedia: { id: string; event: AdminEventListItem } }>(
          `/api/admin/media/${mediaId}/event-media`,
          { eventId: row.id },
        );
        setStagedEvents((s) => [
          ...s,
          {
            eventId: res.eventMedia.event.id,
            linkId: res.eventMedia.id,
            label: formatEventDescriptiveLabel(res.eventMedia.event),
          },
        ]);
        clearEventPickerFields();
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link event");
      }
      return;
    }
    setStagedEvents((s) => [...s, { eventId: row.id, label: formatEventDescriptiveLabel(row) }]);
    clearEventPickerFields();
  };

  const removeEventLink = async (t: StagedEventMedia) => {
    setErrMsg(null);
    if (mode === "edit" && t.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/event-media/${t.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove event link");
        return;
      }
    }
    setStagedEvents((s) => s.filter((x) => x.eventId !== t.eventId));
  };

  return {
    stagedIndividuals,
    stagedFamilies,
    stagedEvents,
    eventTypeFilter,
    setEventTypeFilter,
    eventLinkKind,
    eventIndivGiven,
    eventIndivLast,
    setEventIndivGiven,
    setEventIndivLast,
    eventFamP1Given,
    eventFamP1Last,
    eventFamP2Given,
    eventFamP2Last,
    setEventFamP1Given,
    setEventFamP1Last,
    setEventFamP2Given,
    setEventFamP2Last,
    addIndividualLink,
    removeIndividualLink,
    addFamilyLink,
    removeFamilyLink,
    onEventLinkScopeChange,
    addEventLink,
    removeEventLink,
  };
}

type UseMediaEditorPlaceDateLinksArgs = {
  mode: "create" | "edit";
  mediaId: string;
  initial: MediaEditorInitial | null;
  setErrMsg: (msg: string | null) => void;
  invalidateMediaQueries: () => Promise<void>;
};

function useMediaEditorPlaceDateLinks({
  mode,
  mediaId,
  initial,
  setErrMsg,
  invalidateMediaQueries,
}: UseMediaEditorPlaceDateLinksArgs) {
  const [stagedPlaces, setStagedPlaces] = useState<StagedPlaceLink[]>(() =>
    (initial?.placeLinks ?? []).map((r) => ({
      key: r.place.id,
      linkId: r.id,
      placeId: r.place.id,
      label: labelFromPlaceApi(r.place),
    })),
  );
  const [stagedDates, setStagedDates] = useState<StagedDateLink[]>(() =>
    (initial?.dateLinks ?? []).map((r) => ({
      key: r.date.id,
      linkId: r.id,
      dateId: r.date.id,
      label: labelFromDateApi(r.date),
    })),
  );
  const [placeDraft, setPlaceDraft] = useState(() => emptyPlaceDraft());
  const [dateDraft, setDateDraft] = useState(() => emptyDateDraft());

  const addPlaceFromForm = async () => {
    const pending = placeSliceToApiPayload(placeDraft);
    if (!pending) {
      toast.message("Add place details", { description: "Enter locality, jurisdiction fields, or full place text." });
      return;
    }
    const label = formatGedcomPlaceFormSliceLabel(placeDraft);
    if (mode === "edit") {
      setErrMsg(null);
      try {
        const res = await postJson<{
          placeMedia: { id: string; place: { id: string } };
        }>(`/api/admin/media/${mediaId}/place-media`, { place: pending });
        setStagedPlaces((s) => [
          ...s,
          {
            key: res.placeMedia.place.id,
            linkId: res.placeMedia.id,
            placeId: res.placeMedia.place.id,
            label,
          },
        ]);
        setPlaceDraft(emptyPlaceDraft());
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link place");
      }
      return;
    }
    const key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setStagedPlaces((s) => [...s, { key, label, pendingPlace: pending }]);
    setPlaceDraft(emptyPlaceDraft());
  };

  const removePlaceLink = async (row: StagedPlaceLink) => {
    setErrMsg(null);
    if (mode === "edit" && row.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/place-media/${row.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove place link");
        return;
      }
    }
    setStagedPlaces((s) => s.filter((x) => x.key !== row.key));
  };

  const addDateFromForm = async () => {
    const pending = dateSliceToApiPayload(dateDraft);
    if (!pending) {
      toast.message("Add date details", {
        description: "Change the specifier from Exact, add original text, or enter year / month / day.",
      });
      return;
    }
    const label = formatGedcomDateFormSliceLabel(dateDraft);
    if (mode === "edit") {
      setErrMsg(null);
      try {
        const res = await postJson<{
          dateMedia: { id: string; date: { id: string } };
        }>(`/api/admin/media/${mediaId}/date-media`, { date: pending });
        setStagedDates((s) => [
          ...s,
          {
            key: res.dateMedia.date.id,
            linkId: res.dateMedia.id,
            dateId: res.dateMedia.date.id,
            label,
          },
        ]);
        setDateDraft(emptyDateDraft());
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link date");
      }
      return;
    }
    const key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setStagedDates((s) => [...s, { key, label, pendingDate: pending }]);
    setDateDraft(emptyDateDraft());
  };

  const removeDateLink = async (row: StagedDateLink) => {
    setErrMsg(null);
    if (mode === "edit" && row.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/date-media/${row.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove date link");
        return;
      }
    }
    setStagedDates((s) => s.filter((x) => x.key !== row.key));
  };

  return {
    stagedPlaces,
    stagedDates,
    placeDraft,
    setPlaceDraft,
    dateDraft,
    setDateDraft,
    addPlaceFromForm,
    removePlaceLink,
    addDateFromForm,
    removeDateLink,
  };
}

export function useMediaEditorLinks({
  mode,
  mediaId,
  initial,
  prefillIndividuals,
  prefillFamilies,
  setErrMsg,
  detailScope = "family-tree",
}: UseMediaEditorLinksArgs) {
  const qc = useQueryClient();

  const invalidateMediaQueries = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
    if (mode === "edit" && mediaId) {
      await qc.invalidateQueries({
        queryKey: [...ADMIN_MEDIA_QUERY_KEY, "detail", detailScope, mediaId],
      });
    }
  }, [qc, mode, mediaId, detailScope]);
  const {
    stagedTags,
    stagedAlbums,
    tagQuery,
    setTagQuery,
    albumQuery,
    setAlbumQuery,
    createAlbumAsPublic,
    setCreateAlbumAsPublic,
    tagsQuery,
    albumsQuery,
    tagResults,
    albumResults,
    exactTagMatch,
    exactAlbumMatch,
    addTag,
    removeTag,
    createAndAddTag,
    addAlbum,
    removeAlbum,
    createAndAddAlbum,
  } = useMediaEditorOrganisationLinks({
    mode,
    mediaId,
    initial,
    setErrMsg,
    invalidateMediaQueries,
    organisationScope: detailScope,
  });
  const {
    stagedIndividuals,
    stagedFamilies,
    stagedEvents,
    eventTypeFilter,
    setEventTypeFilter,
    eventLinkKind,
    eventIndivGiven,
    eventIndivLast,
    setEventIndivGiven,
    setEventIndivLast,
    eventFamP1Given,
    eventFamP1Last,
    eventFamP2Given,
    eventFamP2Last,
    setEventFamP1Given,
    setEventFamP1Last,
    setEventFamP2Given,
    setEventFamP2Last,
    addIndividualLink,
    removeIndividualLink,
    addFamilyLink,
    removeFamilyLink,
    onEventLinkScopeChange,
    addEventLink,
    removeEventLink,
  } = useMediaEditorEntityLinks({
    mode,
    mediaId,
    initial,
    prefillIndividuals,
    prefillFamilies,
    setErrMsg,
    invalidateMediaQueries,
  });
  const stagedIndividualIdSet = useMemo(
    () => new Set(stagedIndividuals.map((s) => s.individualId)),
    [stagedIndividuals],
  );
  const stagedFamilyIdSet = useMemo(() => new Set(stagedFamilies.map((s) => s.familyId)), [stagedFamilies]);
  const stagedEventIdSet = useMemo(() => new Set(stagedEvents.map((s) => s.eventId)), [stagedEvents]);
  const {
    stagedPlaces,
    stagedDates,
    placeDraft,
    setPlaceDraft,
    dateDraft,
    setDateDraft,
    addPlaceFromForm,
    removePlaceLink,
    addDateFromForm,
    removeDateLink,
  } = useMediaEditorPlaceDateLinks({
    mode,
    mediaId,
    initial,
    setErrMsg,
    invalidateMediaQueries,
  });

  const persistStagedLinksForNewMedia = useCallback(
    async (newId: string) => {
      const orgBase = mediaOrganisationBase(newId, detailScope);
      for (const t of stagedTags) {
        await postJson(`${orgBase}/app-tags`, { tagId: t.tagId });
      }
      for (const a of stagedAlbums) {
        await postJson(`${orgBase}/album-links`, { albumId: a.albumId });
      }
      if (detailScope !== "family-tree") return;
      for (const ind of stagedIndividuals) {
        await postJson(`/api/admin/media/${newId}/individual-media`, { individualId: ind.individualId });
      }
      for (const fam of stagedFamilies) {
        await postJson(`/api/admin/media/${newId}/family-media`, { familyId: fam.familyId });
      }
      for (const ev of stagedEvents) {
        await postJson(`/api/admin/media/${newId}/event-media`, { eventId: ev.eventId });
      }
      for (const pl of stagedPlaces) {
        if (pl.pendingPlace) {
          await postJson(`/api/admin/media/${newId}/place-media`, { place: pl.pendingPlace });
        }
      }
      for (const dl of stagedDates) {
        if (dl.pendingDate) {
          await postJson(`/api/admin/media/${newId}/date-media`, { date: dl.pendingDate });
        }
      }
    },
    [
      detailScope,
      stagedTags,
      stagedAlbums,
      stagedIndividuals,
      stagedFamilies,
      stagedEvents,
      stagedPlaces,
      stagedDates,
    ],
  );

  return {
    stagedTags,
    stagedAlbums,
    stagedIndividuals,
    stagedFamilies,
    stagedEvents,
    stagedPlaces,
    stagedDates,
    placeDraft,
    setPlaceDraft,
    dateDraft,
    setDateDraft,
    tagQuery,
    setTagQuery,
    albumQuery,
    setAlbumQuery,
    createAlbumAsPublic,
    setCreateAlbumAsPublic,
    eventTypeFilter,
    setEventTypeFilter,
    eventLinkKind,
    eventIndivGiven,
    eventIndivLast,
    setEventIndivGiven,
    setEventIndivLast,
    eventFamP1Given,
    eventFamP1Last,
    eventFamP2Given,
    eventFamP2Last,
    setEventFamP1Given,
    setEventFamP1Last,
    setEventFamP2Given,
    setEventFamP2Last,
    tagsQuery,
    albumsQuery,
    tagResults,
    albumResults,
    stagedIndividualIdSet,
    stagedFamilyIdSet,
    stagedEventIdSet,
    exactTagMatch,
    exactAlbumMatch,
    invalidateMediaQueries,
    persistStagedLinksForNewMedia,
    addTag,
    removeTag,
    createAndAddTag,
    addAlbum,
    removeAlbum,
    createAndAddAlbum,
    addIndividualLink,
    removeIndividualLink,
    addFamilyLink,
    removeFamilyLink,
    onEventLinkScopeChange,
    addEventLink,
    removeEventLink,
    addPlaceFromForm,
    removePlaceLink,
    addDateFromForm,
    removeDateLink,
  };
}
