"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ADMIN_MEDIA_QUERY_KEY, useCreateMedia, useDeleteMedia, useUpdateMedia } from "@/hooks/useAdminMedia";
import type { MediaEditorInitial, MediaEditorTab } from "@/components/admin/media-editor/media-editor-types";

export type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";
import { formatEventDescriptiveLabel } from "@/components/admin/media-editor/media-editor-helpers";
import { useMediaEditorLinks } from "@/hooks/useMediaEditorLinks";
import { MediaEditorTabBar } from "@/components/admin/media-editor/MediaEditorTabBar";
import { MediaEditorFileTabPanel } from "@/components/admin/media-editor/MediaEditorFileTabPanel";
import { MediaEditorIndividualsTabPanel } from "@/components/admin/media-editor/MediaEditorIndividualsTabPanel";
import { MediaEditorFamiliesTabPanel } from "@/components/admin/media-editor/MediaEditorFamiliesTabPanel";
import { MediaEditorEventsTabPanel } from "@/components/admin/media-editor/MediaEditorEventsTabPanel";
import { MediaEditorPlacesTabPanel } from "@/components/admin/media-editor/MediaEditorPlacesTabPanel";
import { MediaEditorDatesTabPanel } from "@/components/admin/media-editor/MediaEditorDatesTabPanel";
import { MediaEditorOrganisationTabPanel } from "@/components/admin/media-editor/MediaEditorOrganisationTabPanel";
import { MediaEditorPreviewSection } from "@/components/admin/media-editor/MediaEditorPreviewSection";
import { MediaEditorFormHeader } from "@/components/admin/media-editor/MediaEditorFormHeader";
import { MediaEditorFormActions } from "@/components/admin/media-editor/MediaEditorFormActions";
import { Button } from "@/components/ui/button";
import { useMediaEditorUploadAndMeta } from "@/hooks/useMediaEditorUploadAndMeta";
import { useMediaEditorSubmit } from "@/hooks/useMediaEditorSubmit";

type MediaEditorFormProps =
  | {
      mode: "create";
      hideBackLink?: boolean;
      contextReturnHref?: string;
      prefillIndividuals?: { individualId: string; label: string }[];
      prefillFamilies?: { familyId: string; label: string }[];
    }
  | { mode: "edit"; mediaId: string; initialMedia: MediaEditorInitial; hideBackLink?: boolean };

export function MediaEditorForm(props: MediaEditorFormProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const mode = props.mode;
  const mediaId = mode === "edit" ? props.mediaId : "";
  const hideBackLink = props.hideBackLink ?? false;
  const backHref = props.mode === "create" ? (props.contextReturnHref ?? "/admin/media") : "/admin/media";

  const initial = mode === "edit" ? props.initialMedia : null;

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [mediaEditorTab, setMediaEditorTab] = useState<MediaEditorTab>("file");
  const mediaEditorTabId = useId();

  const createMedia = useCreateMedia();
  const updateMedia = useUpdateMedia();
  const deleteMedia = useDeleteMedia();

  const file = useMediaEditorUploadAndMeta({
    mode,
    initial,
    setErrMsg,
    createMedia,
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
  });

  const { submitting, handleSubmit } = useMediaEditorSubmit({
    mode,
    mediaId,
    title: file.title,
    description: file.description,
    fileRef: file.fileRef,
    form: file.form,
    contextReturnHref: props.mode === "create" ? props.contextReturnHref : undefined,
    setErrMsg,
    createMedia: async (payload) => {
      return (await createMedia.mutateAsync(payload)) as { media: { id: string } };
    },
    updateMedia: async (payload) => updateMedia.mutateAsync(payload),
    persistStagedLinksForNewMedia,
    invalidateMediaQueries,
    invalidateMediaListQuery: async () => qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] }),
    push: router.push,
  });

  const mediaIdOrNew = mediaId || "new";
  const tab = mediaEditorTab;

  const handleDeleteMedia = useCallback(async () => {
    if (mode !== "edit" || !mediaId) return;
    const label = file.title.trim() || file.fileRef.trim() || mediaId;
    if (
      !window.confirm(
        `Delete media "${label}"? This removes the GEDCOM media row, its tree links, tags, and album links. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await deleteMedia.mutateAsync(mediaId);
      toast.success(`Deleted "${label}".`);
      router.push("/admin/media");
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [mode, mediaId, file.title, file.fileRef, deleteMedia, router]);

  return (
    <div className="space-y-6">
      <MediaEditorFormHeader hideBackLink={hideBackLink} backHref={backHref} mode={mode} />

      <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-8">
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        ) : null}

        <MediaEditorPreviewSection
          showImagePreview={file.showImagePreview}
          showVideoPreview={file.showVideoPreview}
          imagePreviewSrc={file.imagePreviewSrc}
          fileRef={file.fileRef}
          form={file.form}
        />

        <MediaEditorTabBar activeTab={tab} onTabChange={setMediaEditorTab} tabIdPrefix={mediaEditorTabId} />

        <MediaEditorFileTabPanel
          panelId={`${mediaEditorTabId}-panel-file`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-file`}
          hidden={tab !== "file"}
          mode={mode}
          initialXref={initial?.xref ?? null}
          dragOver={file.dragOver}
          setDragOver={file.setDragOver}
          uploading={file.uploading}
          uploadProgress={file.uploadProgress}
          onDrop={file.onDrop}
          fileInputRef={file.fileInputRef}
          onFilesChosenFromPicker={file.onFilesChosenFromPicker}
          fileRef={file.fileRef}
          setFileRef={file.setFileRef}
          showImagePreview={file.showImagePreview}
          showVideoPreview={file.showVideoPreview}
          imagePreviewSrc={file.imagePreviewSrc}
          title={file.title}
          setTitle={file.setTitle}
          description={file.description}
          setDescription={file.setDescription}
          form={file.form}
          setForm={file.setForm}
        />

        <MediaEditorIndividualsTabPanel
          panelId={`${mediaEditorTabId}-panel-individuals`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-individuals`}
          hidden={tab !== "individuals"}
          mediaIdOrNew={mediaIdOrNew}
          stagedIndividuals={stagedIndividuals}
          stagedIndividualIdSet={stagedIndividualIdSet}
          submitting={submitting}
          onRemoveIndividual={removeIndividualLink}
          onPickIndividual={addIndividualLink}
        />

        <MediaEditorFamiliesTabPanel
          panelId={`${mediaEditorTabId}-panel-families`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-families`}
          hidden={tab !== "families"}
          mediaIdOrNew={mediaIdOrNew}
          stagedFamilies={stagedFamilies}
          stagedFamilyIdSet={stagedFamilyIdSet}
          submitting={submitting}
          onRemoveFamily={removeFamilyLink}
          onPickFamily={addFamilyLink}
        />

        <MediaEditorEventsTabPanel
          panelId={`${mediaEditorTabId}-panel-events`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-events`}
          hidden={tab !== "events"}
          mediaIdOrNew={mediaIdOrNew}
          stagedEvents={stagedEvents}
          stagedEventIdSet={stagedEventIdSet}
          submitting={submitting}
          onRemoveEvent={removeEventLink}
          onPickEvent={addEventLink}
          formatRowLabel={formatEventDescriptiveLabel}
          eventTypeFilter={eventTypeFilter}
          setEventTypeFilter={setEventTypeFilter}
          eventLinkKind={eventLinkKind}
          onEventLinkScopeChange={onEventLinkScopeChange}
          eventIndivGiven={eventIndivGiven}
          eventIndivLast={eventIndivLast}
          setEventIndivGiven={setEventIndivGiven}
          setEventIndivLast={setEventIndivLast}
          eventFamP1Given={eventFamP1Given}
          eventFamP1Last={eventFamP1Last}
          eventFamP2Given={eventFamP2Given}
          eventFamP2Last={eventFamP2Last}
          setEventFamP1Given={setEventFamP1Given}
          setEventFamP1Last={setEventFamP1Last}
          setEventFamP2Given={setEventFamP2Given}
          setEventFamP2Last={setEventFamP2Last}
        />

        <MediaEditorPlacesTabPanel
          panelId={`${mediaEditorTabId}-panel-places`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-places`}
          hidden={tab !== "places"}
          mediaIdOrNew={mediaIdOrNew}
          stagedPlaces={stagedPlaces}
          placeDraft={placeDraft}
          setPlaceDraft={setPlaceDraft}
          submitting={submitting}
          onRemovePlace={removePlaceLink}
          onAddPlaceFromForm={addPlaceFromForm}
        />

        <MediaEditorDatesTabPanel
          panelId={`${mediaEditorTabId}-panel-dates`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-dates`}
          hidden={tab !== "dates"}
          mediaIdOrNew={mediaIdOrNew}
          stagedDates={stagedDates}
          dateDraft={dateDraft}
          setDateDraft={setDateDraft}
          submitting={submitting}
          onRemoveDate={removeDateLink}
          onAddDateFromForm={addDateFromForm}
        />

        <MediaEditorOrganisationTabPanel
          panelId={`${mediaEditorTabId}-panel-organisation`}
          ariaLabelledBy={`${mediaEditorTabId}-tab-organisation`}
          hidden={tab !== "organisation"}
          stagedTags={stagedTags}
          stagedAlbums={stagedAlbums}
          submitting={submitting}
          onRemoveTag={removeTag}
          onRemoveAlbum={removeAlbum}
          tagQuery={tagQuery}
          setTagQuery={setTagQuery}
          albumQuery={albumQuery}
          setAlbumQuery={setAlbumQuery}
          createAlbumAsPublic={createAlbumAsPublic}
          setCreateAlbumAsPublic={setCreateAlbumAsPublic}
          tagsLoading={tagsQuery.isLoading}
          albumsLoading={albumsQuery.isLoading}
          tagResults={tagResults}
          albumResults={albumResults}
          exactTagMatch={exactTagMatch}
          exactAlbumMatch={exactAlbumMatch}
          onPickTag={addTag}
          onPickAlbum={addAlbum}
          onCreateAndAddTag={createAndAddTag}
          onCreateAndAddAlbum={createAndAddAlbum}
        />

        {mode === "edit" ? (
          <div className="rounded-box border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deleting removes this media record and all links to people, families, events, sources, places, dates,
              tags, and albums. This cannot be undone.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-3"
              disabled={submitting || deleteMedia.isPending}
              onClick={() => void handleDeleteMedia()}
            >
              {deleteMedia.isPending ? "Deleting…" : "Delete media"}
            </Button>
          </div>
        ) : null}

        <MediaEditorFormActions mode={mode} mediaId={mediaId} backHref={backHref} submitting={submitting} />
      </form>
    </div>
  );
}
