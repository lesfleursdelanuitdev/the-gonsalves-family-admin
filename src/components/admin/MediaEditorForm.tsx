"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  mediaImageUnoptimized,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { ApiError, deleteJson, fetchJson, patchJson, postFormData, postJson } from "@/lib/infra/api";
import {
  ADMIN_MEDIA_QUERY_KEY,
  useCreateMedia,
  useUpdateMedia,
} from "@/hooks/useAdminMedia";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { selectClassName } from "@/components/data-viewer/constants";
import { labelGedcomEventType, GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";

export interface MediaEditorInitial {
  id: string;
  xref?: string | null;
  title?: string | null;
  description?: string | null;
  fileRef?: string | null;
  form?: string | null;
  appTags?: Array<{ id: string; tag: { id: string; name: string; color: string | null } }>;
  albumLinks?: Array<{ id: string; album: { id: string; name: string } }>;
  individualMedia?: Array<{
    id: string;
    individual: { id: string; fullName: string | null; xref: string | null };
  }>;
  familyMedia?: Array<{
    id: string;
    family: {
      id: string;
      xref: string | null;
      husband: { id: string; fullName: string | null } | null;
      wife: { id: string; fullName: string | null } | null;
    };
  }>;
  eventMedia?: Array<{
    id: string;
    event: { id: string; eventType: string; customType: string | null };
  }>;
}

type MediaEditorFormProps =
  | { mode: "create"; hideBackLink?: boolean; contextReturnHref?: string }
  | { mode: "edit"; mediaId: string; initialMedia: MediaEditorInitial; hideBackLink?: boolean };

type StagedTag = { tagId: string; linkId?: string; name: string; color: string | null };
type StagedAlbum = { albumId: string; linkId?: string; name: string };
type StagedIndividualMedia = { individualId: string; linkId?: string; label: string };
type StagedFamilyMedia = { familyId: string; linkId?: string; label: string };
type StagedEventMedia = { eventId: string; linkId?: string; label: string };

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  isGlobal: boolean;
}

interface AlbumRow {
  id: string;
  name: string;
}

interface IndividualSearchRow {
  id: string;
  xref: string | null;
  fullName: string | null;
}

interface FamilySearchRow {
  id: string;
  xref: string | null;
  husband: { id: string; fullName: string | null } | null;
  wife: { id: string; fullName: string | null } | null;
}

const MEDIA_EVENT_TYPE_OPTIONS = Object.keys(GEDCOM_EVENT_TYPE_LABELS).sort();

function formatIndividualLabel(i: Pick<IndividualSearchRow, "id" | "xref" | "fullName">): string {
  return i.fullName?.trim() || i.xref?.trim() || i.id;
}

function formatFamilySearchLabel(f: FamilySearchRow): string {
  const hx = f.husband?.fullName?.trim();
  const wx = f.wife?.fullName?.trim();
  const pair = [hx, wx].filter(Boolean).join(" & ");
  const xr = f.xref?.trim();
  if (pair) return xr ? `${pair} (${xr})` : pair;
  return xr || f.id;
}

function formatEventLinkLabel(ev: { eventType: string; customType: string | null }): string {
  const base = labelGedcomEventType(ev.eventType);
  const custom =
    ev.eventType.toUpperCase() === "EVEN" && ev.customType?.trim()
      ? ` (${ev.customType.trim()})`
      : "";
  return base + custom;
}

function formatEventDescriptiveLabel(ev: AdminEventListItem): string {
  const head = formatEventLinkLabel({
    eventType: ev.eventType,
    customType: ev.customType ?? null,
  });
  const year = ev.date?.year;
  const yearBit = year != null ? ` (${year})` : "";
  const place = (ev.place?.name ?? ev.place?.original ?? "").trim();
  const placeBit = place ? ` — ${place.length > 52 ? `${place.slice(0, 49)}…` : place}` : "";

  const ie = ev.individualEvents?.[0];
  if (ie?.individual) {
    const ind = ie.individual;
    const dn =
      formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
      stripSlashesFromName(ind.fullName) ||
      "";
    const core = dn ? `${head} of ${dn}` : head;
    return `${core}${yearBit}${placeBit}`;
  }

  const fe = ev.familyEvents?.[0];
  if (fe?.family) {
    const h = stripSlashesFromName(fe.family.husband?.fullName ?? "") || "";
    const w = stripSlashesFromName(fe.family.wife?.fullName ?? "") || "";
    const pair = [h, w].filter(Boolean).join(" and ");
    const core = pair ? `${head} of ${pair}` : head;
    return `${core}${yearBit}${placeBit}`;
  }

  return `${head}${yearBit}${placeBit}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

function Pill({
  label,
  onRemove,
  disabled,
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2.5 py-0.5 text-xs font-medium text-base-content">
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="rounded-full p-0.5 text-base-content/60 hover:bg-base-300/80 hover:text-base-content disabled:opacity-40"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
      >
        <X className="size-3.5 shrink-0" />
      </button>
    </span>
  );
}

export function MediaEditorForm(props: MediaEditorFormProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const mode = props.mode;
  const mediaId = mode === "edit" ? props.mediaId : "";
  const hideBackLink = props.hideBackLink ?? false;
  const backHref = props.mode === "create" ? (props.contextReturnHref ?? "/admin/media") : "/admin/media";

  const initial = mode === "edit" ? props.initialMedia : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [fileRef, setFileRef] = useState(initial?.fileRef ?? "");
  const [form, setForm] = useState(initial?.form ?? "");
  const [stagedTags, setStagedTags] = useState<StagedTag[]>(() =>
    (initial?.appTags ?? []).map((r) => ({
      tagId: r.tag.id,
      linkId: r.id,
      name: r.tag.name,
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
  const [stagedIndividuals, setStagedIndividuals] = useState<StagedIndividualMedia[]>(() =>
    (initial?.individualMedia ?? []).map((r) => ({
      individualId: r.individual.id,
      linkId: r.id,
      label: formatIndividualLabel(r.individual),
    })),
  );
  const [stagedFamilies, setStagedFamilies] = useState<StagedFamilyMedia[]>(() =>
    (initial?.familyMedia ?? []).map((r) => ({
      familyId: r.family.id,
      linkId: r.id,
      label: formatFamilySearchLabel(r.family as FamilySearchRow),
    })),
  );
  const [stagedEvents, setStagedEvents] = useState<StagedEventMedia[]>(() =>
    (initial?.eventMedia ?? []).map((r) => ({
      eventId: r.event.id,
      linkId: r.id,
      label: formatEventLinkLabel(r.event),
    })),
  );

  const [tagQuery, setTagQuery] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [individualQuery, setIndividualQuery] = useState("");
  const [familyQuery, setFamilyQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamGiven, setEventFamGiven] = useState("");
  const [eventFamLast, setEventFamLast] = useState("");
  const debouncedTagQ = useDebounced(tagQuery.trim(), 250);
  const debouncedAlbumQ = useDebounced(albumQuery.trim(), 250);
  const debouncedIndividualQ = useDebounced(individualQuery.trim(), 250);
  const debouncedFamilyQ = useDebounced(familyQuery.trim(), 250);
  const debouncedEventIndivGiven = useDebounced(eventIndivGiven.trim().toLowerCase(), 250);
  const debouncedEventIndivLast = useDebounced(eventIndivLast.trim(), 250);
  const debouncedEventFamGiven = useDebounced(eventFamGiven.trim().toLowerCase(), 250);
  const debouncedEventFamLast = useDebounced(eventFamLast.trim(), 250);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  /** Set from upload API so we can preview before `form` is edited. */
  const [uploadMimeType, setUploadMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMedia = useCreateMedia();
  const updateMedia = useUpdateMedia();

  const tagsQuery = useQuery({
    queryKey: ["admin", "tags", "search", debouncedTagQ],
    queryFn: () =>
      fetchJson<{ tags: TagRow[] }>(
        `/api/admin/tags?q=${encodeURIComponent(debouncedTagQ)}&limit=40`,
      ),
    enabled: debouncedTagQ.length >= 1,
  });

  const albumsQuery = useQuery({
    queryKey: ["admin", "albums", "search", debouncedAlbumQ],
    queryFn: () =>
      fetchJson<{ albums: AlbumRow[] }>(
        `/api/admin/albums?q=${encodeURIComponent(debouncedAlbumQ)}&limit=40`,
      ),
    enabled: debouncedAlbumQ.length >= 1,
  });

  const individualsSearchQuery = useQuery({
    queryKey: ["admin", "individuals", "search", debouncedIndividualQ],
    queryFn: () =>
      fetchJson<{ individuals: IndividualSearchRow[] }>(
        `/api/admin/individuals?q=${encodeURIComponent(debouncedIndividualQ)}&limit=30`,
      ),
    enabled: debouncedIndividualQ.length >= 1,
  });

  const familiesSearchQuery = useQuery({
    queryKey: ["admin", "families", "search", debouncedFamilyQ],
    queryFn: () =>
      fetchJson<{ families: FamilySearchRow[] }>(
        `/api/admin/families?q=${encodeURIComponent(debouncedFamilyQ)}&limit=30`,
      ),
    enabled: debouncedFamilyQ.length >= 1,
  });

  const eventsPickerReady = useMemo(() => {
    if (!eventTypeFilter.trim()) return false;
    if (eventLinkKind === "individual") {
      return !!(debouncedEventIndivGiven || debouncedEventIndivLast);
    }
    return !!(debouncedEventFamGiven || debouncedEventFamLast);
  }, [
    eventTypeFilter,
    eventLinkKind,
    debouncedEventIndivGiven,
    debouncedEventIndivLast,
    debouncedEventFamGiven,
    debouncedEventFamLast,
  ]);

  const eventsPickerQuery = useQuery({
    queryKey: [
      "admin",
      "events",
      "media-picker",
      eventTypeFilter,
      eventLinkKind,
      debouncedEventIndivGiven,
      debouncedEventIndivLast,
      debouncedEventFamGiven,
      debouncedEventFamLast,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", String(ADMIN_LIST_MAX_LIMIT));
      params.set("eventType", eventTypeFilter.trim());
      params.set("linkType", eventLinkKind);
      if (eventLinkKind === "individual") {
        if (debouncedEventIndivGiven) params.set("linkedGiven", debouncedEventIndivGiven);
        if (debouncedEventIndivLast) params.set("linkedLast", debouncedEventIndivLast);
      } else {
        if (debouncedEventFamGiven) params.set("familyPartnerGiven", debouncedEventFamGiven);
        if (debouncedEventFamLast) params.set("familyPartnerLast", debouncedEventFamLast);
      }
      return fetchJson<{ events: AdminEventListItem[] }>(`/api/admin/events?${params.toString()}`);
    },
    enabled: eventsPickerReady,
  });

  const tagResults = tagsQuery.data?.tags ?? [];
  const albumResults = albumsQuery.data?.albums ?? [];
  const individualResults = individualsSearchQuery.data?.individuals ?? [];
  const familyResults = familiesSearchQuery.data?.families ?? [];
  const eventPickerResults = eventsPickerQuery.data?.events ?? [];

  const exactTagMatch = useMemo(
    () => tagResults.some((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase()),
    [tagResults, tagQuery],
  );

  const exactAlbumMatch = useMemo(
    () => albumResults.some((a) => a.name.toLowerCase() === albumQuery.trim().toLowerCase()),
    [albumResults, albumQuery],
  );

  const invalidateMediaQueries = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
    if (mode === "edit") {
      await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY, "detail", mediaId] });
    }
  }, [qc, mode, mediaId]);

  const imagePreviewSrc = useMemo(() => resolveMediaImageSrc(fileRef), [fileRef]);
  const showImagePreview = useMemo(
    () => Boolean(imagePreviewSrc && isLikelyRasterImage(fileRef, form, uploadMimeType)),
    [fileRef, form, imagePreviewSrc, uploadMimeType],
  );
  const showVideoPreview = useMemo(
    () =>
      Boolean(
        imagePreviewSrc &&
          !showImagePreview &&
          isLikelyVideoFile(fileRef, form) &&
          isPlayableVideoRef(fileRef),
      ),
    [fileRef, form, imagePreviewSrc, showImagePreview],
  );

  const processUploadFile = useCallback(async (file: File) => {
    setErrMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await postFormData<{
        fileRef: string;
        suggestedForm: string | null;
        originalName: string;
        mimeType: string | null;
      }>("/api/admin/media/upload", fd);
      setFileRef(res.fileRef);
      setUploadMimeType(res.mimeType ?? null);
      if (res.suggestedForm) {
        setForm((prev) => (prev.trim() ? prev : res.suggestedForm!));
      }
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void processUploadFile(f);
    },
    [processUploadFile],
  );

  const addTag = async (row: { id: string; name: string; color: string | null }) => {
    if (stagedTags.some((t) => t.tagId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ appTag: { id: string; tag: { id: string; name: string; color: string | null } } }>(
          `/api/admin/media/${mediaId}/app-tags`,
          { tagId: row.id },
        );
        setStagedTags((s) => [
          ...s,
          {
            tagId: res.appTag.tag.id,
            linkId: res.appTag.id,
            name: res.appTag.tag.name,
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
    setStagedTags((s) => [...s, { tagId: row.id, name: row.name, color: row.color }]);
    setTagQuery("");
  };

  const removeTag = async (t: StagedTag) => {
    setErrMsg(null);
    if (mode === "edit" && t.linkId) {
      try {
        await deleteJson(`/api/admin/media/${mediaId}/app-tags/${t.linkId}`);
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
      const res = await postJson<{ tag: TagRow }>("/api/admin/tags", { name });
      await addTag(res.tag);
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Could not create tag");
    }
  };

  const addAlbum = async (row: AlbumRow) => {
    if (stagedAlbums.some((a) => a.albumId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{ albumLink: { id: string; album: { id: string; name: string } } }>(
          `/api/admin/media/${mediaId}/album-links`,
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
        await deleteJson(`/api/admin/media/${mediaId}/album-links/${a.linkId}`);
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not remove album");
        return;
      }
    }
    setStagedAlbums((s) => s.filter((x) => x.albumId !== a.albumId));
  };

  const addIndividualLink = async (row: IndividualSearchRow) => {
    if (stagedIndividuals.some((x) => x.individualId === row.id)) return;
    setErrMsg(null);
    if (mode === "edit") {
      try {
        const res = await postJson<{
          individualMedia: { id: string; individual: IndividualSearchRow };
        }>(`/api/admin/media/${mediaId}/individual-media`, { individualId: row.id });
        setStagedIndividuals((s) => [
          ...s,
          {
            individualId: res.individualMedia.individual.id,
            linkId: res.individualMedia.id,
            label: formatIndividualLabel(res.individualMedia.individual),
          },
        ]);
        setIndividualQuery("");
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link individual");
      }
      return;
    }
    setStagedIndividuals((s) => [...s, { individualId: row.id, label: formatIndividualLabel(row) }]);
    setIndividualQuery("");
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

  const addFamilyLink = async (row: FamilySearchRow) => {
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
            label: formatFamilySearchLabel(res.familyMedia.family),
          },
        ]);
        setFamilyQuery("");
        await invalidateMediaQueries();
      } catch (e) {
        setErrMsg(e instanceof ApiError ? e.message : "Could not link family");
      }
      return;
    }
    setStagedFamilies((s) => [...s, { familyId: row.id, label: formatFamilySearchLabel(row) }]);
    setFamilyQuery("");
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
    setEventFamGiven("");
    setEventFamLast("");
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

  const createAndAddAlbum = async () => {
    const name = albumQuery.trim();
    if (!name) return;
    setErrMsg(null);
    try {
      const res = await postJson<{ album: AlbumRow }>("/api/admin/albums", { name });
      await addAlbum(res.album);
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Could not create album");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim() || null,
        description: description.trim() || null,
        fileRef: fileRef.trim() || null,
        form: form.trim() || null,
      };
      if (mode === "create") {
        const res = (await createMedia.mutateAsync(payload)) as { media: { id: string } };
        const newId = res.media.id;
        for (const t of stagedTags) {
          await postJson(`/api/admin/media/${newId}/app-tags`, { tagId: t.tagId });
        }
        for (const a of stagedAlbums) {
          await postJson(`/api/admin/media/${newId}/album-links`, { albumId: a.albumId });
        }
        for (const ind of stagedIndividuals) {
          await postJson(`/api/admin/media/${newId}/individual-media`, { individualId: ind.individualId });
        }
        for (const fam of stagedFamilies) {
          await postJson(`/api/admin/media/${newId}/family-media`, { familyId: fam.familyId });
        }
        for (const ev of stagedEvents) {
          await postJson(`/api/admin/media/${newId}/event-media`, { eventId: ev.eventId });
        }
        await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        router.push(`/admin/media/${newId}`);
        return;
      }
      await updateMedia.mutateAsync({ id: mediaId, ...payload });
      await invalidateMediaQueries();
      router.push(`/admin/media/${mediaId}`);
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn("flex gap-2", hideBackLink ? "flex-col" : "items-center")}>
        {!hideBackLink ? (
          <Link
            href={backHref}
            aria-label="Back to media"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "create" ? "Add media" : "Edit media"}
          </h1>
          <p className="text-muted-foreground">
            Upload any file type, set GEDCOM fields, link people/families/events in this tree, then attach tags and
            albums. Tags and albums apply per signed-in user (same as the site).
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-2xl space-y-8">
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="media-file-drop">File</Label>
          <div
            id="media-file-drop"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-base-content/15 bg-base-200/20",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Upload className="size-8 text-muted-foreground" aria-hidden />
            )}
            <p className="font-medium text-base-content">Drag and drop a file here</p>
            <p className="text-muted-foreground">or click to choose a file from your device</p>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="*/*"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) void processUploadFile(f);
                ev.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-file-ref">File reference (GEDCOM)</Label>
          <Input
            id="media-file-ref"
            value={fileRef}
            onChange={(e) => setFileRef(e.target.value)}
            placeholder="/uploads/... or https://..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Populated automatically after upload; you can paste a URL or path instead.
          </p>
        </div>

        {showImagePreview && imagePreviewSrc ? (
          <div className="space-y-2">
            <Label>Preview</Label>
            <p className="text-xs text-muted-foreground">
              Same file as above — shown at a small size using Next.js Image (no separate thumbnail on disk).
            </p>
            <div className="relative h-40 w-40 overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
              <Image
                key={imagePreviewSrc}
                src={imagePreviewSrc}
                alt=""
                fill
                sizes="160px"
                className="object-contain p-1"
                unoptimized={mediaImageUnoptimized(imagePreviewSrc)}
              />
            </div>
          </div>
        ) : null}

        {showVideoPreview && imagePreviewSrc ? (
          <div className="space-y-2">
            <Label>Preview</Label>
            <p className="text-xs text-muted-foreground">Inline video (no generated poster file).</p>
            <div className="max-w-xl overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
              <video
                key={imagePreviewSrc}
                src={imagePreviewSrc}
                controls
                playsInline
                className="max-h-64 w-full"
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="media-title">Title</Label>
            <Input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="media-description">Description</Label>
            <textarea
              id="media-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional longer caption or notes for this media object"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-form">Form (MIME / GEDCOM)</Label>
            <Input
              id="media-form"
              value={form}
              onChange={(e) => setForm(e.target.value)}
              placeholder="jpeg, pdf, …"
            />
          </div>
        </div>

        {mode === "edit" && initial?.xref ? (
          <div className="space-y-1">
            <Label>XREF</Label>
            <p className="font-mono text-sm">{initial.xref}</p>
          </div>
        ) : null}

        <div className="space-y-6 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
          <p className="text-sm font-medium text-base-content">GEDCOM links (this tree)</p>
          <p className="text-xs text-muted-foreground">
            Search by name or xref. Links are stored on the GEDCOM junction tables (same as when attaching media from a
            person, family, or event page).
          </p>

          <div className="space-y-3">
            <Label>Individuals</Label>
            <div className="flex flex-wrap gap-2">
              {stagedIndividuals.map((t) => (
                <Pill
                  key={t.individualId}
                  label={t.label}
                  onRemove={() => void removeIndividualLink(t)}
                  disabled={submitting}
                />
              ))}
              {stagedIndividuals.length === 0 ? (
                <span className="text-sm text-muted-foreground">None linked.</span>
              ) : null}
            </div>
            <div className="relative space-y-2">
              <Input
                value={individualQuery}
                onChange={(e) => setIndividualQuery(e.target.value)}
                placeholder="Search people by name or xref…"
                autoComplete="off"
              />
              {individualQuery.trim().length >= 1 ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                  {individualsSearchQuery.isLoading ? (
                    <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                  ) : (
                    individualResults
                      .filter((r) => !stagedIndividuals.some((s) => s.individualId === r.id))
                      .map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                          onClick={() => void addIndividualLink(r)}
                        >
                          <span className="font-medium">{formatIndividualLabel(r)}</span>
                          {r.xref ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{r.xref}</span>
                          ) : null}
                        </button>
                      ))
                  )}
                  {!individualsSearchQuery.isLoading &&
                  individualResults.filter((r) => !stagedIndividuals.some((s) => s.individualId === r.id)).length ===
                    0 ? (
                    <p className="px-3 py-2 text-muted-foreground">No matches.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Families</Label>
            <div className="flex flex-wrap gap-2">
              {stagedFamilies.map((t) => (
                <Pill
                  key={t.familyId}
                  label={t.label}
                  onRemove={() => void removeFamilyLink(t)}
                  disabled={submitting}
                />
              ))}
              {stagedFamilies.length === 0 ? (
                <span className="text-sm text-muted-foreground">None linked.</span>
              ) : null}
            </div>
            <div className="relative space-y-2">
              <Input
                value={familyQuery}
                onChange={(e) => setFamilyQuery(e.target.value)}
                placeholder="Search families by xref or partner names…"
                autoComplete="off"
              />
              {familyQuery.trim().length >= 1 ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                  {familiesSearchQuery.isLoading ? (
                    <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                  ) : (
                    familyResults
                      .filter((r) => !stagedFamilies.some((s) => s.familyId === r.id))
                      .map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                          onClick={() => void addFamilyLink(r)}
                        >
                          {formatFamilySearchLabel(r)}
                        </button>
                      ))
                  )}
                  {!familiesSearchQuery.isLoading &&
                  familyResults.filter((r) => !stagedFamilies.some((s) => s.familyId === r.id)).length === 0 ? (
                    <p className="px-3 py-2 text-muted-foreground">No matches.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-2">
              {stagedEvents.map((t) => (
                <Pill
                  key={t.eventId}
                  label={t.label}
                  onRemove={() => void removeEventLink(t)}
                  disabled={submitting}
                />
              ))}
              {stagedEvents.length === 0 ? (
                <span className="text-sm text-muted-foreground">None linked.</span>
              ) : null}
            </div>
            <div className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/15 p-4">
              <p className="text-xs text-muted-foreground">
                Pick the GEDCOM event tag, whether it is tied to a person or a family, then narrow by name (same rules as
                the Events list: given names search name forms; last name prefix matches slash-surnames in{" "}
                <code className="text-[10px]">full_name_lower</code>).
              </p>
              <div className="space-y-2">
                <Label htmlFor="media-event-type-filter">Event type</Label>
                <select
                  id="media-event-type-filter"
                  className={selectClassName}
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                >
                  <option value="">Select type…</option>
                  {MEDIA_EVENT_TYPE_OPTIONS.map((et) => (
                    <option key={et} value={et}>
                      {GEDCOM_EVENT_TYPE_LABELS[et] ?? et} ({et})
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-base-content">This event is linked to</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="media-event-link-kind"
                      className="radio radio-sm"
                      checked={eventLinkKind === "individual"}
                      onChange={() => {
                        setEventLinkKind("individual");
                        setEventFamGiven("");
                        setEventFamLast("");
                      }}
                    />
                    Individual
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="media-event-link-kind"
                      className="radio radio-sm"
                      checked={eventLinkKind === "family"}
                      onChange={() => {
                        setEventLinkKind("family");
                        setEventIndivGiven("");
                        setEventIndivLast("");
                      }}
                    />
                    Family
                  </label>
                </div>
              </fieldset>
              {eventLinkKind === "individual" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="media-event-indiv-given">Given names contain</Label>
                    <Input
                      id="media-event-indiv-given"
                      value={eventIndivGiven}
                      onChange={(e) => setEventIndivGiven(e.target.value)}
                      placeholder="e.g. monica"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="media-event-indiv-last">Last name prefix</Label>
                    <Input
                      id="media-event-indiv-last"
                      value={eventIndivLast}
                      onChange={(e) => setEventIndivLast(e.target.value)}
                      placeholder="e.g. G matches /Gon/, /Gonsalves/"
                      autoComplete="off"
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Prefix against GEDCOM surname tokens in the person’s full name (slash-aware).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="media-event-fam-given">Partner given names contain</Label>
                    <Input
                      id="media-event-fam-given"
                      value={eventFamGiven}
                      onChange={(e) => setEventFamGiven(e.target.value)}
                      placeholder="Matches husband or wife"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="media-event-fam-last">Partner last name prefix</Label>
                    <Input
                      id="media-event-fam-last"
                      value={eventFamLast}
                      onChange={(e) => setEventFamLast(e.target.value)}
                      placeholder="e.g. G matches either spouse’s surnames"
                      autoComplete="off"
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      If either partner’s name matches (given + last combined per spouse when both filled), the family
                      event appears.
                    </p>
                  </div>
                </div>
              )}
              {!eventsPickerReady ? (
                <p className="text-xs text-muted-foreground">
                  Choose an event type and enter at least one name filter (given and/or last) to load matches.
                </p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-sm">
                  {eventsPickerQuery.isFetching ? (
                    <p className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                      Searching…
                    </p>
                  ) : (
                    eventPickerResults
                      .filter((r) => !stagedEvents.some((s) => s.eventId === r.id))
                      .map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                          onClick={() => void addEventLink(r)}
                        >
                          <span className="line-clamp-2 whitespace-normal">{formatEventDescriptiveLabel(r)}</span>
                        </button>
                      ))
                  )}
                  {!eventsPickerQuery.isFetching &&
                  eventPickerResults.filter((r) => !stagedEvents.some((s) => s.eventId === r.id)).length === 0 ? (
                    <p className="px-3 py-2 text-muted-foreground">No matches.</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {stagedTags.map((t) => (
              <Pill key={t.tagId} label={t.name} onRemove={() => void removeTag(t)} disabled={submitting} />
            ))}
            {stagedTags.length === 0 ? (
              <span className="text-sm text-muted-foreground">No tags yet.</span>
            ) : null}
          </div>
          <div className="relative space-y-2">
            <Input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Search tags or type a new name…"
              autoComplete="off"
            />
            {tagQuery.trim().length >= 1 ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                {tagsQuery.isLoading ? (
                  <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                ) : (
                  <>
                    {tagResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200/80"
                        onClick={() => void addTag(t)}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: t.color ?? "var(--color-base-content)" }}
                          aria-hidden
                        />
                        <span className="truncate">{t.name}</span>
                        {t.isGlobal ? (
                          <span className="ml-auto text-xs text-muted-foreground">global</span>
                        ) : null}
                      </button>
                    ))}
                    {!exactTagMatch && tagQuery.trim() ? (
                      <button
                        type="button"
                        className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                        onClick={() => void createAndAddTag()}
                      >
                        Create tag “{tagQuery.trim()}”
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
            {stagedAlbums.map((a) => (
              <Pill key={a.albumId} label={a.name} onRemove={() => void removeAlbum(a)} disabled={submitting} />
            ))}
            {stagedAlbums.length === 0 ? (
              <span className="text-sm text-muted-foreground">No albums yet.</span>
            ) : null}
          </div>
          <div className="relative space-y-2">
            <Input
              value={albumQuery}
              onChange={(e) => setAlbumQuery(e.target.value)}
              placeholder="Search your albums or type a new name…"
              autoComplete="off"
            />
            {albumQuery.trim().length >= 1 ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
                {albumsQuery.isLoading ? (
                  <p className="px-3 py-2 text-muted-foreground">Searching…</p>
                ) : (
                  <>
                    {albumResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                        onClick={() => void addAlbum(a)}
                      >
                        {a.name}
                      </button>
                    ))}
                    {!exactAlbumMatch && albumQuery.trim() ? (
                      <button
                        type="button"
                        className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                        onClick={() => void createAndAddAlbum()}
                      >
                        Create album “{albumQuery.trim()}”
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={cn(buttonVariants())} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : mode === "create" ? (
              "Create media"
            ) : (
              "Save changes"
            )}
          </button>
          <Link href={mode === "edit" ? `/admin/media/${mediaId}` : backHref} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
