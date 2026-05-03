"use client";
/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronDown,
  Cog,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  MapPin,
  ShieldAlert,
  Tag,
  Users,
  UsersRound,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_MEDIA_QUERY_KEY, useCreateMedia, useDeleteMedia, useUpdateMedia } from "@/hooks/useAdminMedia";
import type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";

export type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";
import { formatEventDescriptiveLabel } from "@/components/admin/media-editor/media-editor-helpers";
import { useMediaEditorLinks } from "@/hooks/useMediaEditorLinks";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import { MediaEditorFormActions } from "@/components/admin/media-editor/MediaEditorFormActions";
import { Button, buttonVariants } from "@/components/ui/button";
import { EventPicker } from "@/components/admin/EventPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import { useMediaEditorUploadAndMeta } from "@/hooks/useMediaEditorUploadAndMeta";
import { useMediaEditorSubmit } from "@/hooks/useMediaEditorSubmit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { deleteJson, patchJson, postJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { formatBytes } from "@/lib/admin/format-bytes";
import { MediaUploadProgressInline } from "@/components/admin/MediaUploadProgressInline";
import { PersonEditorMobileFormHeader } from "@/components/admin/individual-editor/PersonEditorMobileFormHeader";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MediaDeleteConfirmDialog } from "@/components/admin/MediaDeleteConfirmDialog";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";

type MediaEditorFormProps =
  | {
      mode: "create";
      hideBackLink?: boolean;
      contextReturnHref?: string;
      initialCreateScope?: "family-tree" | "site-assets" | "my-media";
      prefillIndividuals?: { individualId: string; label: string }[];
      prefillFamilies?: { familyId: string; label: string }[];
    }
  | {
      mode: "edit";
      mediaId: string;
      initialMedia: MediaEditorInitial;
      hideBackLink?: boolean;
      scope?: "family-tree" | "site-assets" | "my-media";
    };

type MediaMobileSectionKey =
  | "media-preview"
  | "media-title-description"
  | "media-people"
  | "media-family"
  | "media-date"
  | "media-location"
  | "media-events"
  | "media-organization"
  | "media-advanced"
  | "media-danger";

function MobileSectionToggle({
  isDesktop,
  sectionKey,
  mobileExpanded,
  onToggle,
  icon: Icon,
  title,
  summary,
}: {
  isDesktop: boolean;
  sectionKey: MediaMobileSectionKey;
  mobileExpanded: MediaMobileSectionKey | null;
  onToggle: (key: MediaMobileSectionKey) => void;
  icon: LucideIcon;
  title: string;
  summary: string;
}) {
  if (isDesktop) return null;
  const expanded = mobileExpanded === sectionKey;
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-xl border border-base-content/10 bg-card/80 px-4 py-3 text-left shadow-sm"
      aria-expanded={expanded}
      onClick={() => onToggle(sectionKey)}
    >
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{summary}</span>
      </span>
      <ChevronDown className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
    </button>
  );
}

function MediaSectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function MediaEditorForm(props: MediaEditorFormProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const isDesktop = useMediaQueryMinLg();
  const mode = props.mode;
  const mediaId = mode === "edit" ? props.mediaId : "";
  const hideBackLink = props.hideBackLink ?? false;
  const backHref = props.mode === "create" ? (props.contextReturnHref ?? "/admin/media") : "/admin/media";
  const formId = "media-editor-form";

  const initial = mode === "edit" ? props.initialMedia : null;

  const [sitePublishIsPublic, setSitePublishIsPublic] = useState(() =>
    mode === "edit" && initial?.isPublic !== undefined ? Boolean(initial.isPublic) : true,
  );
  const [sitePublishExportable, setSitePublishExportable] = useState(() =>
    mode === "edit" && initial?.exportable !== undefined ? Boolean(initial.exportable) : false,
  );
  const [userPublishVisibility, setUserPublishVisibility] = useState<"private" | "shared" | "public">(() => {
    const v = initial?.visibility;
    if (mode === "edit" && (v === "private" || v === "shared" || v === "public")) return v;
    return "private";
  });
  const [userPublishReusePolicy, setUserPublishReusePolicy] = useState<
    "private" | "reusable_in_tree" | "reusable_public"
  >(() => {
    const r = initial?.reusePolicy;
    if (mode === "edit" && (r === "private" || r === "reusable_in_tree" || r === "reusable_public")) {
      return r;
    }
    return "private";
  });

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<MediaMobileSectionKey | null>("media-preview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createScope, setCreateScope] = useState<"family-tree" | "site-assets" | "my-media">(
    mode === "create" ? (props.initialCreateScope ?? "family-tree") : (props.scope ?? "family-tree"),
  );
  const activeScope = mode === "create" ? createScope : (props.scope ?? "family-tree");
  const supportsGedcomLinks = activeScope === "family-tree";

  const createMedia = useCreateMedia();
  const updateMedia = useUpdateMedia();
  const deleteMedia = useDeleteMedia();

  const file = useMediaEditorUploadAndMeta({
    mode,
    initial,
    setErrMsg,
    mediaUploadScope: activeScope,
    createMediaForScope: async (payload) => {
      if (createScope === "site-assets") {
        await postJson("/api/admin/site-media", payload);
        return;
      }
      if (createScope === "my-media") {
        await postJson("/api/admin/user-media", payload);
        return;
      }
      await createMedia.mutateAsync({
        title: payload.title,
        fileRef: payload.fileRef,
        form: payload.form,
      });
    },
    queryClient: qc,
    router,
  });

  const {
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
  } = useMediaEditorLinks({
    mode,
    mediaId,
    initial,
    prefillIndividuals: props.mode === "create" ? props.prefillIndividuals : undefined,
    prefillFamilies: props.mode === "create" ? props.prefillFamilies : undefined,
    setErrMsg,
    detailScope: activeScope,
  });

  const getScopedExtraBody = useCallback(() => {
    if (activeScope === "site-assets") {
      return { isPublic: sitePublishIsPublic, exportable: sitePublishExportable };
    }
    if (activeScope === "my-media") {
      return { visibility: userPublishVisibility, reusePolicy: userPublishReusePolicy };
    }
    return {};
  }, [
    activeScope,
    sitePublishIsPublic,
    sitePublishExportable,
    userPublishVisibility,
    userPublishReusePolicy,
  ]);

  const { submitting, handleSubmit } = useMediaEditorSubmit({
    mode,
    mediaId,
    title: file.title,
    description: file.description,
    fileRef: file.fileRef,
    form: file.form,
    getScopedExtraBody,
    contextReturnHref: props.mode === "create" ? props.contextReturnHref : undefined,
    createScope,
    setErrMsg,
    createMediaByScope: async (scope, payload) => {
      if (scope === "site-assets") {
        return (await postJson("/api/admin/site-media", payload)) as { media: { id: string } };
      }
      if (scope === "my-media") {
        return (await postJson("/api/admin/user-media", payload)) as { media: { id: string } };
      }
      return (await createMedia.mutateAsync(payload)) as { media: { id: string } };
    },
    updateMedia: async (payload) => {
      if (activeScope === "site-assets") {
        return patchJson(`/api/admin/site-media/${mediaId}`, payload);
      }
      if (activeScope === "my-media") {
        return patchJson(`/api/admin/user-media/${mediaId}`, payload);
      }
      return updateMedia.mutateAsync(payload);
    },
    persistStagedLinksForNewMedia,
    invalidateMediaQueries,
    invalidateMediaListQuery: async () => qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] }),
    push: router.push,
  });

  const titleValue = file.title;
  const descriptionValue = file.description;
  const fileRefValue = file.fileRef;
  const formValue = file.form;

  const mediaIdOrNew = mediaId || "new";

  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!file.showImagePreview || !file.imagePreviewSrc) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setPreviewDims({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onerror = () => setPreviewDims(null);
    img.src = file.imagePreviewSrc;
  }, [file.showImagePreview, file.imagePreviewSrc]);

  const fileName = useMemo(() => {
    const ref = fileRefValue.trim();
    if (!ref) return "No file selected";
    const clean = ref.split("?")[0]?.split("#")[0] ?? ref;
    const parts = clean.split("/");
    return parts[parts.length - 1] || clean;
  }, [fileRefValue]);

  const fileType = useMemo(() => {
    const t = formValue.trim();
    if (!t) return "Unknown";
    return t.toUpperCase();
  }, [formValue]);
  const createNeedsFileRef = mode === "create" && !fileRefValue.trim();
  const knownSize = file.uploadProgress?.expectedBytes ?? null;
  const sizeMeta = knownSize != null ? formatBytes(knownSize) : "Unknown size";
  const dimMeta = file.showImagePreview && previewDims ? `${previewDims.w}×${previewDims.h}` : "Unknown dimensions";

  const deleteMediaDetail = useMemo(() => {
    if (activeScope === "family-tree") {
      return "This removes the GEDCOM media row, its tree links, tags, and album links.";
    }
    if (activeScope === "site-assets") {
      return "This soft-deletes the site asset record.";
    }
    return "This soft-deletes your private media record.";
  }, [activeScope]);

  const executeDeleteMedia = useCallback(async () => {
    if (mode !== "edit" || !mediaId) {
      throw new Error("Cannot delete: missing media.");
    }
    const label = file.title.trim() || file.fileRef.trim() || mediaId;
    if (activeScope === "site-assets") {
      await deleteJson(`/api/admin/site-media/${mediaId}`);
    } else if (activeScope === "my-media") {
      await deleteJson(`/api/admin/user-media/${mediaId}`);
    } else {
      await deleteMedia.mutateAsync(mediaId);
    }
    await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
    toast.success(`Deleted "${label}".`);
    setDeleteDialogOpen(false);
    const listHref =
      activeScope === "site-assets"
        ? "/admin/media?scope=site-assets"
        : activeScope === "my-media"
          ? "/admin/media?scope=my-media"
          : "/admin/media";
    router.replace(listHref);
  }, [mode, mediaId, file.title, file.fileRef, deleteMedia, router, activeScope, qc]);

  const onMobileToggle = useCallback((key: MediaMobileSectionKey) => {
    setMobileExpanded((cur) => (cur === key ? null : key));
  }, []);

  const previewSummary = file.fileRef.trim() ? `${fileName} · ${fileType}` : "No file selected";
  const titleSummary = titleValue.trim() || "No title";
  const peopleSummary = stagedIndividuals.length ? `${stagedIndividuals.length} linked` : "None linked";
  const familySummary = stagedFamilies.length ? `${stagedFamilies.length} linked` : "None linked";
  const dateSummary = stagedDates.length ? stagedDates[0]?.label ?? "Added" : "Not set";
  const placeSummary = stagedPlaces.length ? stagedPlaces[0]?.label ?? "Added" : "Not set";
  const eventSummary = stagedEvents.length ? `${stagedEvents.length} linked` : "None linked";
  const organizationSummary = `${stagedTags.length} tags · ${stagedAlbums.length} albums`;
  const advancedSummary = showAdvancedDetails ? "Expanded" : "Collapsed";

  return (
    <div className="space-y-6 pb-24">
      {hideBackLink ? (
        <>
          {isDesktop ? (
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
              <div className="space-y-1">
                <Link
                  href={backHref}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Media
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "Add media" : "Edit media"}</h1>
                <p className="text-muted-foreground">Upload a file and set details about this media.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  form={formId}
                  className={cn(buttonVariants())}
                  disabled={submitting || createNeedsFileRef}
                >
                  {submitting ? "Saving…" : mode === "create" ? "Create media" : "Save changes"}
                </button>
              </div>
            </header>
          ) : (
            <div className="space-y-3">
              <PersonEditorMobileFormHeader
                title={mode === "create" ? "Add media" : "Edit media"}
                backHref={backHref}
                treeHref="/admin/media"
              />
              <p className="text-sm text-muted-foreground">Upload a file and set details about this media.</p>
            </div>
          )}
        </>
      ) : null}

      <form
        id={formId}
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full space-y-6"
      >
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        ) : null}

        {mode === "create" ? (
          <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
            <MediaSectionHeader
              icon={ImagePlus}
              title="Media scope"
              description="Choose where this media belongs. This affects linking, permissions, and export behavior."
            />
            <div className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  createScope === "family-tree"
                    ? "border border-primary/35 bg-primary/10"
                    : "border border-base-content/12 bg-base-200/35 text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="media-scope"
                  checked={createScope === "family-tree"}
                  onChange={() => setCreateScope("family-tree")}
                />
                Family Tree Media
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  createScope === "site-assets"
                    ? "border border-primary/35 bg-primary/10"
                    : "border border-base-content/12 bg-base-200/35 text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="media-scope"
                  checked={createScope === "site-assets"}
                  onChange={() => setCreateScope("site-assets")}
                />
                Site Assets
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  createScope === "my-media"
                    ? "border border-primary/35 bg-primary/10"
                    : "border border-base-content/12 bg-base-200/35 text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="media-scope"
                  checked={createScope === "my-media"}
                  onChange={() => setCreateScope("my-media")}
                />
                My Media
              </label>
            </div>
          </section>
        ) : null}

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-preview"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={ImageIcon}
          title="Media preview"
          summary={previewSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-preview" && "hidden",
          )}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-lg border border-base-content/10 bg-base-200/20">
              {file.showImagePreview && file.imagePreviewSrc ? (
                <div className="relative aspect-video w-full">
                  <MediaRasterImage
                    key={file.imagePreviewSrc}
                    fileRef={file.fileRef}
                    form={file.form}
                    src={file.imagePreviewSrc}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-contain p-1.5"
                  />
                </div>
              ) : file.showVideoPreview && file.imagePreviewSrc ? (
                <video src={file.imagePreviewSrc} controls playsInline className="aspect-video w-full" />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => file.fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      file.fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    file.setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    file.setDragOver(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={file.onDrop}
                  className={cn(
                    "flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground",
                    file.dragOver && "bg-primary/5",
                  )}
                >
                  <ImagePlus className="size-8 opacity-70" aria-hidden />
                  <p>{mode === "create" ? "Add media files" : "Drop or choose a replacement image/video"}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{fileType}</p>
                <p className="mt-1 break-all text-sm font-medium text-foreground">{fileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sizeMeta} · {dimMeta}
                </p>
              </div>
              {file.uploadProgress ? (
                <MediaUploadProgressInline
                  loaded={file.uploadProgress.loaded}
                  total={file.uploadProgress.total}
                  expectedSize={file.uploadProgress.expectedBytes}
                  caption={file.uploadProgress.caption ?? "Uploading media…"}
                  subCaption={file.uploadProgress.subCaption ?? null}
                  className="max-w-none"
                />
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => file.fileInputRef.current?.click()}
                  disabled={file.uploading}
                >
                  Replace image
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive sm:w-auto"
                  onClick={() => {
                    file.setFileRef("");
                    file.setForm("");
                  }}
                  disabled={file.uploading}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
          <input
            ref={file.fileInputRef}
            type="file"
            multiple={mode === "create"}
            className="sr-only"
            accept="*/*"
            onChange={(ev) => {
              file.onFilesChosenFromPicker(ev.target.files);
              ev.target.value = "";
            }}
          />
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-title-description"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={FileText}
          title="Title & description"
          summary={titleSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-title-description" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={FileText}
              title="Title & description"
              description="Give this media a title and optional caption."
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="media-title">Title</Label>
              <Input id="media-title" value={titleValue} onChange={(e) => file.setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-description">Description (optional)</Label>
              <textarea
                id="media-description"
                value={descriptionValue}
                onChange={(e) => file.setDescription(e.target.value)}
                rows={3}
                className="flex min-h-[86px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </section>

        {supportsGedcomLinks ? (
          <>
        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-people"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={Users}
          title="People in this photo"
          summary={peopleSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-people" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={Users}
              title="People in this photo"
              description="Tag the people who appear in this media."
            />
          ) : null}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {stagedIndividuals.map((row) => (
                <MediaEditorPill
                  key={row.individualId}
                  label={row.label}
                  onRemove={() => void removeIndividualLink(row)}
                  disabled={submitting}
                />
              ))}
              {stagedIndividuals.length === 0 ? <p className="text-sm text-muted-foreground">No people tagged yet.</p> : null}
            </div>
            <Button type="button" variant="outline" onClick={() => setPeoplePickerOpen((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add person
            </Button>
            {isDesktop ? (
              peoplePickerOpen ? (
                <IndividualSearchPicker
                  idPrefix={`media-indiv-${mediaIdOrNew}`}
                  excludeIds={stagedIndividualIdSet}
                  onPick={(ind) => {
                    void addIndividualLink(ind);
                    setPeoplePickerOpen(false);
                  }}
                  limit={30}
                />
              ) : null
            ) : (
              <Dialog open={peoplePickerOpen} onOpenChange={setPeoplePickerOpen}>
                <DialogContent className="max-w-xl p-4 sm:p-6">
                  <DialogTitle>Add person</DialogTitle>
                  <DialogDescription>Search and link a person to this media.</DialogDescription>
                  <div className="mt-4">
                    <IndividualSearchPicker
                      idPrefix={`media-indiv-mobile-${mediaIdOrNew}`}
                      excludeIds={stagedIndividualIdSet}
                      onPick={(ind) => {
                        void addIndividualLink(ind);
                        setPeoplePickerOpen(false);
                      }}
                      limit={30}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-family"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={UsersRound}
          title="Related family"
          summary={familySummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-family" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={UsersRound}
              title="Related family"
              description="Link this media to a family."
            />
          ) : null}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {stagedFamilies.map((row) => (
                <MediaEditorPill
                  key={row.familyId}
                  label={row.label}
                  onRemove={() => void removeFamilyLink(row)}
                  disabled={submitting}
                />
              ))}
              {stagedFamilies.length === 0 ? <p className="text-sm text-muted-foreground">No families linked yet.</p> : null}
            </div>
            <Button type="button" variant="outline" onClick={() => setFamilyPickerOpen((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add family
            </Button>
            {isDesktop ? (
              familyPickerOpen ? (
                <FamilySearchPicker
                  idPrefix={`media-fam-${mediaIdOrNew}`}
                  excludeIds={stagedFamilyIdSet}
                  onPick={(fam) => {
                    void addFamilyLink(fam);
                    setFamilyPickerOpen(false);
                  }}
                  limit={30}
                />
              ) : null
            ) : (
              <Dialog open={familyPickerOpen} onOpenChange={setFamilyPickerOpen}>
                <DialogContent className="max-w-xl p-4 sm:p-6">
                  <DialogTitle>Add family</DialogTitle>
                  <DialogDescription>Search and link a family to this media.</DialogDescription>
                  <div className="mt-4">
                    <FamilySearchPicker
                      idPrefix={`media-fam-mobile-${mediaIdOrNew}`}
                      excludeIds={stagedFamilyIdSet}
                      onPick={(fam) => {
                        void addFamilyLink(fam);
                        setFamilyPickerOpen(false);
                      }}
                      limit={30}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-date"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={Calendar}
          title="Date taken"
          summary={dateSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-date" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={Calendar}
              title="Date taken"
              description="When was this photo or media captured?"
            />
          ) : null}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Search and reuse existing canonical date records from this tree, or enter a new date.
            </p>
            <GedcomDateInput
              idPrefix={`media-date-${mediaIdOrNew}`}
              value={dateDraft}
              onChange={(patch) => setDateDraft((prev) => ({ ...prev, ...patch }))}
              eventStyleHints
            />
            <div className="flex flex-wrap gap-2">
              {stagedDates.map((row) => (
                <MediaEditorPill key={row.key} label={row.label} onRemove={() => void removeDateLink(row)} disabled={submitting} />
              ))}
              {stagedDates.length === 0 ? <p className="text-sm text-muted-foreground">No date linked yet.</p> : null}
            </div>
            <Button type="button" variant="outline" onClick={() => void addDateFromForm()}>
              Save date taken
            </Button>
          </div>
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-location"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={MapPin}
          title="Location"
          summary={placeSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-location" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={MapPin}
              title="Location"
              description="Where was this media taken?"
            />
          ) : null}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Search and reuse existing canonical place records from this tree, or enter a new location.
            </p>
            <GedcomPlaceInput
              idPrefix={`media-place-${mediaIdOrNew}`}
              value={placeDraft}
              onChange={(patch) => setPlaceDraft((prev) => ({ ...prev, ...patch }))}
              eventStyleHints
            />
            <div className="flex flex-wrap gap-2">
              {stagedPlaces.map((row) => (
                <MediaEditorPill key={row.key} label={row.label} onRemove={() => void removePlaceLink(row)} disabled={submitting} />
              ))}
              {stagedPlaces.length === 0 ? <p className="text-sm text-muted-foreground">No place linked yet.</p> : null}
            </div>
            <Button type="button" variant="outline" onClick={() => void addPlaceFromForm()}>
              Save location
            </Button>
          </div>
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-events"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={CalendarDays}
          title="Related events"
          summary={eventSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-events" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={CalendarDays}
              title="Related events"
              description="Link this media to events."
            />
          ) : null}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {stagedEvents.map((row) => (
                <MediaEditorPill key={row.eventId} label={row.label} onRemove={() => void removeEventLink(row)} disabled={submitting} />
              ))}
              {stagedEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events linked yet.</p> : null}
            </div>
            <Button type="button" variant="outline" onClick={() => setEventPickerOpen((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add event
            </Button>
            {isDesktop ? (
              eventPickerOpen ? (
                <EventPicker
                  idPrefix={`media-ev-${mediaIdOrNew}`}
                  requireEventType
                  eventType={eventTypeFilter}
                  onEventTypeChange={setEventTypeFilter}
                  linkScope={eventLinkKind}
                  onLinkScopeChange={onEventLinkScopeChange}
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
                  onPick={(row) => {
                    void addEventLink(row);
                    setEventPickerOpen(false);
                  }}
                  limit={100}
                  linkScopeAsRadios
                  partner1Legend="Partner 1"
                  partner2Legend="Partner 2"
                />
              ) : null
            ) : (
              <Dialog open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
                <DialogContent className="max-w-2xl p-4 sm:p-6">
                  <DialogTitle>Add event</DialogTitle>
                  <DialogDescription>Search and link an event to this media.</DialogDescription>
                  <div className="mt-4">
                    <EventPicker
                      idPrefix={`media-ev-mobile-${mediaIdOrNew}`}
                      requireEventType
                      eventType={eventTypeFilter}
                      onEventTypeChange={setEventTypeFilter}
                      linkScope={eventLinkKind}
                      onLinkScopeChange={onEventLinkScopeChange}
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
                      onPick={(row) => {
                        void addEventLink(row);
                        setEventPickerOpen(false);
                      }}
                      limit={100}
                      linkScopeAsRadios
                      partner1Legend="Partner 1"
                      partner2Legend="Partner 2"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>
          </>
        ) : null}

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-organization"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={Tag}
          title="Organization"
          summary={organizationSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-organization" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={Tag}
              title="Organization"
              description="Organize with tags and albums."
            />
          ) : null}
          <div className="space-y-5">
            <div className="space-y-3">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {stagedTags.map((t) => (
                  <MediaEditorPill
                    key={t.tagId}
                    label={displayTagName(t.name)}
                    onRemove={() => void removeTag(t)}
                    disabled={submitting}
                  />
                ))}
              </div>
              <div className="relative">
                <Input
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Search tags or type a new name…"
                  autoComplete="off"
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
                            onClick={() => void addTag(t)}
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
                  <MediaEditorPill key={a.albumId} label={a.name} onRemove={() => void removeAlbum(a)} disabled={submitting} />
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <div className="relative">
                  <Input
                    value={albumQuery}
                    onChange={(e) => setAlbumQuery(e.target.value)}
                    placeholder="Search albums or type a new name…"
                    autoComplete="off"
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
                <div className="space-y-2">
                  <Label htmlFor="media-visibility">Visibility</Label>
                  <select
                    id="media-visibility"
                    className={selectClassName}
                    value={createAlbumAsPublic ? "public" : "private"}
                    onChange={(e) => setCreateAlbumAsPublic(e.target.value === "public")}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <MobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="media-advanced"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={Cog}
          title="Advanced details"
          summary={advancedSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "media-advanced" && "hidden",
          )}
        >
          {isDesktop ? (
            <MediaSectionHeader
              icon={Cog}
              title="Advanced details"
              description="GEDCOM and technical fields."
            />
          ) : null}
          {!showAdvancedDetails ? (
            <Button type="button" variant="outline" onClick={() => setShowAdvancedDetails(true)}>
              Show advanced details
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-file-ref">File reference (GEDCOM)</Label>
                  <Input
                    id="media-file-ref"
                    value={fileRefValue}
                    onChange={(e) => file.setFileRef(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-form">MIME type / Form</Label>
                  <Input id="media-form" value={formValue} onChange={(e) => file.setForm(e.target.value)} />
                </div>
              </div>
              {activeScope === "site-assets" ? (
                <div className="grid gap-4 border-t border-base-content/10 pt-4 md:grid-cols-2">
                  <div className="flex items-start gap-3 space-y-0">
                    <input
                      id="site-media-is-public"
                      type="checkbox"
                      className="mt-1 size-4 rounded border-input"
                      checked={sitePublishIsPublic}
                      onChange={(e) => setSitePublishIsPublic(e.target.checked)}
                    />
                    <div>
                      <Label htmlFor="site-media-is-public" className="font-medium">
                        Public on site
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When off, the asset stays limited to admin workflows that check this flag.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 space-y-0">
                    <input
                      id="site-media-exportable"
                      type="checkbox"
                      className="mt-1 size-4 rounded border-input"
                      checked={sitePublishExportable}
                      onChange={(e) => setSitePublishExportable(e.target.checked)}
                    />
                    <div>
                      <Label htmlFor="site-media-exportable" className="font-medium">
                        Exportable
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow this file to be included in downstream exports when those features are enabled.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {activeScope === "my-media" ? (
                <div className="grid gap-4 border-t border-base-content/10 pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-media-visibility">Visibility</Label>
                    <select
                      id="user-media-visibility"
                      className={selectClassName}
                      value={userPublishVisibility}
                      onChange={(e) =>
                        setUserPublishVisibility(e.target.value as "private" | "shared" | "public")
                      }
                    >
                      <option value="private">Private (only you)</option>
                      <option value="shared">Shared (tree collaborators)</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-media-reuse">Reuse policy</Label>
                    <select
                      id="user-media-reuse"
                      className={selectClassName}
                      value={userPublishReusePolicy}
                      onChange={(e) =>
                        setUserPublishReusePolicy(
                          e.target.value as "private" | "reusable_in_tree" | "reusable_public",
                        )
                      }
                    >
                      <option value="private">Private — not reusable by others</option>
                      <option value="reusable_in_tree">Reusable within this tree</option>
                      <option value="reusable_public">Reusable publicly (when visibility allows)</option>
                    </select>
                  </div>
                </div>
              ) : null}
              {mode === "edit" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">XREF:</span>{" "}
                    <span className="font-mono">{initial?.xref ?? "—"}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Media ID:</span>{" "}
                    <span className="font-mono">{mediaId}</span>
                  </p>
                </div>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvancedDetails(false)}>
                Hide advanced details
              </Button>
            </div>
          )}
        </section>

        {mode === "edit" ? (
          <>
            <MobileSectionToggle
              isDesktop={isDesktop}
              sectionKey="media-danger"
              mobileExpanded={mobileExpanded}
              onToggle={onMobileToggle}
              icon={ShieldAlert}
              title="Danger zone"
              summary="Delete this media"
            />
            <div
              className={cn(
                "rounded-xl border border-destructive/30 bg-destructive/5 p-4",
                !isDesktop && mobileExpanded !== "media-danger" && "hidden",
              )}
            >
            <p className="text-sm font-medium text-destructive">9. Danger zone</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeScope === "family-tree"
                ? "Deleting removes this media record and all links to people, families, events, sources, places, dates, tags, and albums. This cannot be undone."
                : activeScope === "site-assets"
                  ? "Deleting soft-deletes this site asset and removes its tag and album links. This cannot be undone."
                  : "Deleting soft-deletes this private media row and removes its tag and album links. This cannot be undone."}
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-3"
              disabled={submitting || deleteMedia.isPending || deleteDialogOpen}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete media
            </Button>
            </div>
          </>
        ) : null}

        <MediaEditorFormActions
          mode={mode}
          mediaId={mediaId}
          backHref={backHref}
          submitting={submitting}
          saveDisabled={createNeedsFileRef}
        />
      </form>

      {mode === "edit" ? (
        <MediaDeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          mediaLabel={file.title.trim() || file.fileRef.trim() || mediaId}
          detail={deleteMediaDetail}
          onDelete={executeDeleteMedia}
        />
      ) : null}
    </div>
  );
}
