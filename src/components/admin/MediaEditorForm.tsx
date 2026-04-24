"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  FileText,
  Loader2,
  MapPin,
  Tags,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { displayTagName } from "@/lib/admin/display-tag-name";
import { ApiError, deleteJson, fetchJson, postFormData, postJson } from "@/lib/infra/api";
import {
  ADMIN_MEDIA_QUERY_KEY,
  useCreateMedia,
  useUpdateMedia,
} from "@/hooks/useAdminMedia";
import { titleFromUploadedFilename } from "@/lib/admin/media-upload-title";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import {
  emptyKeyFactFormState,
  type GedcomDateFormSlice,
  type GedcomPlaceFormSlice,
} from "@/lib/forms/individual-editor-form";
import { dateSliceToApiPayload, placeSliceToApiPayload } from "@/lib/forms/media-link-payloads";
import {
  formatDateSuggestionLabel,
  formatGedcomDateFormSliceLabel,
} from "@/lib/forms/admin-date-suggestions";
import { formatGedcomPlaceFormSliceLabel, formatPlaceSuggestionLabel } from "@/lib/forms/admin-place-suggestions";

function safeAdminContextHref(href: string | undefined): string | undefined {
  if (!href?.trim()) return undefined;
  const t = href.trim();
  if (!t.startsWith("/admin/")) return undefined;
  if (t.includes("://")) return undefined;
  return t;
}

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
  placeLinks?: Array<{
    id: string;
    place: {
      id: string;
      original: string;
      name: string | null;
      county: string | null;
      state: string | null;
      country: string | null;
    };
  }>;
  dateLinks?: Array<{
    id: string;
    date: {
      id: string;
      original: string | null;
      dateType: string;
      year: number | null;
      month: number | null;
      day: number | null;
      endYear: number | null;
      endMonth: number | null;
      endDay: number | null;
    };
  }>;
}

type MediaEditorFormProps =
  | {
      mode: "create";
      hideBackLink?: boolean;
      contextReturnHref?: string;
      /** Seed “Linked individuals” when opening from an individual (or other) editor. */
      prefillIndividuals?: { individualId: string; label: string }[];
      /** Seed “Linked families” when opening from a family editor. */
      prefillFamilies?: { familyId: string; label: string }[];
    }
  | { mode: "edit"; mediaId: string; initialMedia: MediaEditorInitial; hideBackLink?: boolean };

type MediaEditorTab = "file" | "individuals" | "families" | "events" | "places" | "dates" | "organisation";

type StagedPlaceLink = {
  key: string;
  linkId?: string;
  placeId?: string;
  label: string;
  /** Create mode: applied after the media row exists. */
  pendingPlace?: Record<string, unknown>;
};

type StagedDateLink = {
  key: string;
  linkId?: string;
  dateId?: string;
  label: string;
  pendingDate?: Record<string, unknown>;
};

function emptyPlaceDraft(): GedcomPlaceFormSlice {
  const e = emptyKeyFactFormState();
  return {
    placeName: e.placeName,
    placeCounty: e.placeCounty,
    placeState: e.placeState,
    placeCountry: e.placeCountry,
    placeOriginal: e.placeOriginal,
    placeLat: e.placeLat,
    placeLng: e.placeLng,
  };
}

function emptyDateDraft(): GedcomDateFormSlice {
  const e = emptyKeyFactFormState();
  return {
    dateSpecifier: e.dateSpecifier,
    dateOriginal: e.dateOriginal,
    y: e.y,
    m: e.m,
    d: e.d,
    ey: e.ey,
    em: e.em,
    ed: e.ed,
  };
}

function labelFromPlaceApi(p: NonNullable<MediaEditorInitial["placeLinks"]>[0]["place"]): string {
  return formatPlaceSuggestionLabel({
    id: p.id,
    original: p.original,
    name: p.name,
    county: p.county,
    state: p.state,
    country: p.country,
    latitude: null,
    longitude: null,
  });
}

function labelFromDateApi(d: NonNullable<MediaEditorInitial["dateLinks"]>[0]["date"]): string {
  return formatDateSuggestionLabel({
    id: d.id,
    original: d.original,
    dateType: d.dateType,
    calendar: "GREGORIAN",
    year: d.year,
    month: d.month,
    day: d.day,
    endYear: d.endYear,
    endMonth: d.endMonth,
    endDay: d.endDay,
  });
}

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

function minimalIndividualListItem(i: {
  id: string;
  xref: string | null;
  fullName: string | null;
}): AdminIndividualListItem {
  return {
    id: i.id,
    xref: i.xref ?? "",
    fullName: i.fullName,
    sex: null,
    birthYear: null,
    deathYear: null,
  };
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

const MEDIA_TREE_PICKER_CARD_CLASS =
  "space-y-3 rounded-lg border border-base-content/12 bg-base-200/15 p-4";

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
  const [stagedIndividuals, setStagedIndividuals] = useState<StagedIndividualMedia[]>(() => {
    if (mode === "edit" && initial) {
      return (initial.individualMedia ?? []).map((r) => ({
        individualId: r.individual.id,
        linkId: r.id,
        label: individualSearchDisplayName(minimalIndividualListItem(r.individual)),
      }));
    }
    if (mode === "create" && "prefillIndividuals" in props && props.prefillIndividuals?.length) {
      return props.prefillIndividuals.map((p) => ({
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
    if (mode === "create" && "prefillFamilies" in props && props.prefillFamilies?.length) {
      return props.prefillFamilies.map((p) => ({
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
  const [placeDraft, setPlaceDraft] = useState<GedcomPlaceFormSlice>(() => emptyPlaceDraft());
  const [dateDraft, setDateDraft] = useState<GedcomDateFormSlice>(() => emptyDateDraft());

  const [tagQuery, setTagQuery] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");
  const debouncedTagQ = useDebounced(tagQuery.trim(), 250);
  const debouncedAlbumQ = useDebounced(albumQuery.trim(), 250);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  /** Set from upload API so we can preview before `form` is edited. */
  const [uploadMimeType, setUploadMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaEditorTab, setMediaEditorTab] = useState<MediaEditorTab>("file");
  const mediaEditorTabId = useId();

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

  const tagResults = tagsQuery.data?.tags ?? [];
  const albumResults = albumsQuery.data?.albums ?? [];
  const stagedIndividualIdSet = useMemo(
    () => new Set(stagedIndividuals.map((s) => s.individualId)),
    [stagedIndividuals],
  );
  const stagedFamilyIdSet = useMemo(
    () => new Set(stagedFamilies.map((s) => s.familyId)),
    [stagedFamilies],
  );
  const stagedEventIdSet = useMemo(() => new Set(stagedEvents.map((s) => s.eventId)), [stagedEvents]);
  const exactTagMatch = useMemo(
    () => tagResults.some((t) => displayTagName(t.name) === displayTagName(tagQuery)),
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
      const derived = titleFromUploadedFilename(res.originalName);
      setTitle((t) => (t.trim() ? t : derived));
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const processBulkCreateFromFiles = useCallback(
    async (files: File[]) => {
      setErrMsg(null);
      setUploading(true);
      const errors: string[] = [];
      let created = 0;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          if (file.size <= 0) continue;
          const label = file.name?.trim() || `File ${i + 1}`;
          try {
            const fd = new FormData();
            fd.set("file", file);
            const up = await postFormData<{
              fileRef: string;
              suggestedForm: string | null;
              originalName: string;
              mimeType: string | null;
            }>("/api/admin/media/upload", fd);
            const title = titleFromUploadedFilename(up.originalName);
            await createMedia.mutateAsync({
              title,
              fileRef: up.fileRef,
              form: up.suggestedForm ?? null,
            });
            created++;
          } catch (e) {
            const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed";
            errors.push(`${label}: ${msg}`);
          }
        }
        await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        if (errors.length === 0) {
          toast.success(created === 1 ? "Created 1 media item." : `Created ${created} media items.`);
          router.push("/admin/media");
          return;
        }
        if (created > 0) {
          toast.warning(`Created ${created} of ${files.length} items.`, {
            description: errors.slice(0, 5).join(" · "),
          });
          router.push("/admin/media");
          return;
        }
        setErrMsg(errors.slice(0, 6).join("\n"));
      } finally {
        setUploading(false);
      }
    },
    [createMedia, qc, router],
  );

  const onFilesChosenFromPicker = useCallback(
    (list: FileList | null) => {
      const files = list ? Array.from(list).filter((f) => f.size > 0) : [];
      if (files.length === 0) return;
      if (mode === "edit") {
        if (files.length > 1) {
          toast.message("Using the first file only", {
            description: "When editing media, replace one file at a time.",
          });
        }
        void processUploadFile(files[0]!);
        return;
      }
      if (files.length === 1) {
        void processUploadFile(files[0]!);
        return;
      }
      void processBulkCreateFromFiles(files);
    },
    [mode, processBulkCreateFromFiles, processUploadFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const list = e.dataTransfer.files;
      if (list?.length) onFilesChosenFromPicker(list);
    },
    [onFilesChosenFromPicker],
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

  const addIndividualLink = async (ind: AdminIndividualListItem) => {
    if (stagedIndividuals.some((x) => x.individualId === ind.id)) return;
    setErrMsg(null);
    const label = individualSearchDisplayName(ind);
    if (mode === "edit") {
      try {
        const res = await postJson<{
          individualMedia: { id: string; individual: IndividualSearchRow };
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
        await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        const back = props.mode === "create" ? safeAdminContextHref(props.contextReturnHref) : undefined;
        router.push(back ?? `/admin/media/${newId}`);
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
          <p className="text-muted-foreground">Upload a file and set details.</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-8">
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        ) : null}

        <section
          aria-label="Media preview"
          className="overflow-hidden rounded-box border border-base-content/10 bg-base-200/30"
        >
          {showImagePreview && imagePreviewSrc ? (
            <div className="relative mx-auto aspect-video max-h-[min(50vh,28rem)] w-full max-w-3xl">
              <Image
                key={imagePreviewSrc}
                src={imagePreviewSrc}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain p-2"
                unoptimized={mediaImageUnoptimized(imagePreviewSrc)}
              />
            </div>
          ) : showVideoPreview && imagePreviewSrc ? (
            <div className="mx-auto max-w-3xl p-4">
              <video
                key={imagePreviewSrc}
                src={imagePreviewSrc}
                controls
                playsInline
                className="max-h-[min(50vh,28rem)] w-full rounded-md"
              />
            </div>
          ) : (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <Upload className="size-10 opacity-40" aria-hidden />
              <p>No visual preview yet. Upload an image or video, or set a playable file reference.</p>
            </div>
          )}
        </section>

        <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
          <div
            className="flex gap-0 overflow-x-auto overscroll-x-contain"
            role="tablist"
            aria-label="Media editor sections"
          >
            {(
              [
                { id: "file" as const, label: "File info", Icon: FileText },
                { id: "individuals" as const, label: "Individuals", Icon: User },
                { id: "families" as const, label: "Families", Icon: Users },
                { id: "events" as const, label: "Events", Icon: CalendarDays },
                { id: "places" as const, label: "Places", Icon: MapPin },
                { id: "dates" as const, label: "Dates", Icon: CalendarRange },
                { id: "organisation" as const, label: "Organisation", Icon: Tags },
              ] as const
            ).map(({ id, label, Icon }) => {
              const selected = mediaEditorTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${mediaEditorTabId}-panel-${id}`}
                  id={`${mediaEditorTabId}-tab-${id}`}
                  title={label}
                  className={cn(
                    "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                    selected
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
                  )}
                  onClick={() => setMediaEditorTab(id)}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="sr-only md:hidden">{label}</span>
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-file`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-file`}
          hidden={mediaEditorTab !== "file"}
          className="space-y-6 pt-2"
        >
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
              "flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-base-content/15 bg-base-200/20",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Upload className="size-8 text-muted-foreground" aria-hidden />
            )}
            <p className="font-medium text-base-content">
              {mode === "create" ? "Drop multiple files or click to choose several" : "Drop a file or click to choose"}
            </p>
            {mode === "create" && !uploading ? (
              <span className="badge badge-sm border border-primary/30 bg-primary/10 font-normal text-primary">
                Multi-select in the file dialog
              </span>
            ) : null}
            <p className="text-muted-foreground">
              {mode === "create"
                ? "Up to 80 MB each · each file becomes a new media row (you return to the media list if you pick more than one)"
                : "Up to 80 MB · one file replaces the current upload"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple={mode === "create"}
              className="sr-only"
              accept="*/*"
              aria-label={
                mode === "create"
                  ? "Choose one or more media files (multi-select supported)"
                  : "Choose a file to replace the current media upload"
              }
              onChange={(ev) => {
                onFilesChosenFromPicker(ev.target.files);
                ev.target.value = "";
              }}
            />
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

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <p className="text-xs text-muted-foreground">
              Same media as the preview above, shown compactly (no separate thumbnail file on disk).
            </p>
            {showImagePreview && imagePreviewSrc ? (
              <div className="relative h-40 w-40 overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
                <Image
                  key={`thumb-${imagePreviewSrc}`}
                  src={imagePreviewSrc}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-contain p-1"
                  unoptimized={mediaImageUnoptimized(imagePreviewSrc)}
                />
              </div>
            ) : showVideoPreview && imagePreviewSrc ? (
              <div className="max-w-sm overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
                <video
                  key={`thumb-v-${imagePreviewSrc}`}
                  src={imagePreviewSrc}
                  controls
                  playsInline
                  className="max-h-40 w-full"
                />
              </div>
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-box border border-dashed border-base-content/15 bg-base-200/20 text-center text-xs text-muted-foreground">
                Set a file reference or upload to show a thumbnail.
              </div>
            )}
          </div>

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
        </div>

        <div
          id={`${mediaEditorTabId}-panel-individuals`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-individuals`}
          hidden={mediaEditorTab !== "individuals"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              Link this media to individuals using the same GEDCOM slash-aware name search as elsewhere in admin. Links
              are stored on the junction table.
            </p>
            <div className="space-y-3">
              <Label>Linked individuals</Label>
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
              <div className={MEDIA_TREE_PICKER_CARD_CLASS}>
                <IndividualSearchPicker
                  idPrefix={`media-indiv-${mediaId || "new"}`}
                  excludeIds={stagedIndividualIdSet}
                  onPick={(ind) => void addIndividualLink(ind)}
                  limit={30}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-families`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-families`}
          hidden={mediaEditorTab !== "families"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              Link this media to family records. Uses the same family search as elsewhere in admin.
            </p>
            <div className="space-y-3">
              <Label>Linked families</Label>
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
              <div className={MEDIA_TREE_PICKER_CARD_CLASS}>
                <FamilySearchPicker
                  idPrefix={`media-fam-${mediaId || "new"}`}
                  excludeIds={stagedFamilyIdSet}
                  onPick={(fam) => void addFamilyLink(fam)}
                  limit={30}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-events`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-events`}
          hidden={mediaEditorTab !== "events"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              Pick the GEDCOM event tag, whether it is tied to a person or a family, then narrow by name (same rules as
              the Events list). Family events use two partner fields.
            </p>
            <div className="space-y-3">
              <Label>Linked events</Label>
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
              <div className={MEDIA_TREE_PICKER_CARD_CLASS}>
                <EventPicker
                  idPrefix={`media-ev-${mediaId || "new"}`}
                  requireEventType
                  eventType={eventTypeFilter}
                  onEventTypeChange={setEventTypeFilter}
                  linkScope={eventLinkKind}
                  onLinkScopeChange={(v) => {
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
                  }}
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
                  onPick={(row) => void addEventLink(row)}
                  limit={ADMIN_LIST_MAX_LIMIT}
                  linkScopeAsRadios
                  partner1Legend="Partner 1"
                  partner2Legend="Partner 2"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-places`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-places`}
          hidden={mediaEditorTab !== "places"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              Link this OBJE to canonical place records (same deduplicated rows as elsewhere in the tree). Fill the
              fields, optionally pick a suggestion, then add the link. Multiple places are allowed.
            </p>
            <div className="space-y-3">
              <Label>Linked places</Label>
              <div className="flex flex-wrap gap-2">
                {stagedPlaces.map((row) => (
                  <Pill
                    key={row.key}
                    label={row.label}
                    onRemove={() => void removePlaceLink(row)}
                    disabled={submitting}
                  />
                ))}
                {stagedPlaces.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None linked.</span>
                ) : null}
              </div>
              <div className={MEDIA_TREE_PICKER_CARD_CLASS}>
                <GedcomPlaceInput
                  idPrefix={`media-place-${mediaId || "new"}`}
                  value={placeDraft}
                  onChange={(patch) => setPlaceDraft((prev) => ({ ...prev, ...patch }))}
                  eventStyleHints
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  disabled={submitting}
                  onClick={() => void addPlaceFromForm()}
                >
                  Add place link
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-dates`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-dates`}
          hidden={mediaEditorTab !== "dates"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              Link this OBJE to canonical date records (structured + original text, same as events and key facts).
              Multiple dates are allowed.
            </p>
            <div className="space-y-3">
              <Label>Linked dates</Label>
              <div className="flex flex-wrap gap-2">
                {stagedDates.map((row) => (
                  <Pill
                    key={row.key}
                    label={row.label}
                    onRemove={() => void removeDateLink(row)}
                    disabled={submitting}
                  />
                ))}
                {stagedDates.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None linked.</span>
                ) : null}
              </div>
              <div className={MEDIA_TREE_PICKER_CARD_CLASS}>
                <GedcomDateInput
                  idPrefix={`media-date-${mediaId || "new"}`}
                  value={dateDraft}
                  onChange={(patch) => setDateDraft((prev) => ({ ...prev, ...patch }))}
                  eventStyleHints
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  disabled={submitting}
                  onClick={() => void addDateFromForm()}
                >
                  Add date link
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          id={`${mediaEditorTabId}-panel-organisation`}
          role="tabpanel"
          aria-labelledby={`${mediaEditorTabId}-tab-organisation`}
          hidden={mediaEditorTab !== "organisation"}
          className="space-y-6 pt-2"
        >
          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {stagedTags.map((t) => (
                <Pill
                  key={t.tagId}
                  label={displayTagName(t.name)}
                  onRemove={() => void removeTag(t)}
                  disabled={submitting}
                />
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
                          <span className="truncate">{displayTagName(t.name)}</span>
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
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-base-content/[0.08] bg-base-100/95 px-0 py-3 backdrop-blur-md">
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
