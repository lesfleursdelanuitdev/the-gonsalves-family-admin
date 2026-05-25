"use client";

// Adapter components bridging the admin's picker implementations to the
// @ligneous/story-creator/editor injection contract. Each adapter matches the
// package's prop type exactly; internally it delegates to admin picker components.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { StoryPlaceSearchPicker } from "@/components/admin/story-creator/StoryPlaceSearchPicker";
import { TagsPicker } from "@/components/admin/TagsPicker";
import { AlbumsPicker } from "@/components/admin/AlbumsPicker";
import { MediaPicker } from "@/components/admin/media-picker";
import { MediaPickerModal as AdminMediaPickerModal } from "@/components/admin/media-picker";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import { NotesPicker } from "@/components/admin/NotesPicker";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import type {
  IndividualSearchPickerProps,
  FamilySearchPickerProps,
  EventPickerModalProps,
  PlaceSearchPickerProps,
  TagsPickerProps,
  AlbumsManagerProps,
  MediaPickerButtonProps,
  MediaPickerModalProps,
  EditorPillProps,
  NotesPickerProps,
} from "@ligneous/story-creator/editor";

// ── Individual ────────────────────────────────────────────────────────────────
// AdminIndividualListItem structurally matches StoryPickerIndividualItem.

export function AdminIndividualPickerAdapter({
  idPrefix,
  label,
  description,
  allowEmptySearch,
  limit,
  excludeIds,
  onPick,
}: IndividualSearchPickerProps) {
  return (
    <IndividualSearchPicker
      idPrefix={idPrefix}
      label={label}
      description={description}
      allowEmptySearch={allowEmptySearch}
      limit={limit}
      excludeIds={excludeIds}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPick={onPick as (ind: any) => void}
    />
  );
}

// ── Family ────────────────────────────────────────────────────────────────────
// AdminFamilyListItem → StoryPickerFamilyItem (compute primaryLine from husband/wife).

export function AdminFamilyPickerAdapter({
  idPrefix,
  excludeIds,
  onPick,
}: FamilySearchPickerProps) {
  return (
    <FamilySearchPicker
      idPrefix={idPrefix}
      excludeIds={excludeIds}
      onPick={(fam) =>
        onPick({
          id: fam.id,
          xref: fam.xref,
          primaryLine: familyUnionPrimaryLine(fam),
        })
      }
    />
  );
}

// ── Event picker modal ────────────────────────────────────────────────────────
// The package's EventPickerModalProps is a controlled modal (open/onOpenChange).
// We wrap the admin's stateless EventPicker in a Dialog with local form state.

export function AdminEventPickerModalAdapter({
  open,
  onOpenChange,
  excludeEventIds,
  onPick,
}: EventPickerModalProps) {
  const [eventType, setEventType] = useState("");
  const [linkScope, setLinkScope] = useState<"individual" | "family">("individual");
  const [indGiven, setIndGiven] = useState("");
  const [indLast, setIndLast] = useState("");
  const [famP1Given, setFamP1Given] = useState("");
  const [famP1Last, setFamP1Last] = useState("");
  const [famP2Given, setFamP2Given] = useState("");
  const [famP2Last, setFamP2Last] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Choose event</DialogTitle>
        <DialogDescription className="sr-only">
          Search and select an event by type and linked individual or family.
        </DialogDescription>
        <EventPicker
          eventType={eventType}
          onEventTypeChange={setEventType}
          linkScope={linkScope}
          onLinkScopeChange={setLinkScope}
          indGiven={indGiven}
          indLast={indLast}
          onIndGivenChange={setIndGiven}
          onIndLastChange={setIndLast}
          famP1Given={famP1Given}
          famP1Last={famP1Last}
          famP2Given={famP2Given}
          famP2Last={famP2Last}
          onFamP1GivenChange={setFamP1Given}
          onFamP1LastChange={setFamP1Last}
          onFamP2GivenChange={setFamP2Given}
          onFamP2LastChange={setFamP2Last}
          excludeEventIds={excludeEventIds}
          onPick={(ev) => {
            onPick({ id: ev.id, label: formatNoteEventPickerLabel(ev) });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Place ─────────────────────────────────────────────────────────────────────
// AdminPlaceSuggestionRow structurally matches StoryPickerPlaceRow.

export function AdminPlacePickerAdapter({ idPrefix, excludeIds, onPick, className }: PlaceSearchPickerProps) {
  return (
    <StoryPlaceSearchPicker
      idPrefix={idPrefix}
      excludeIds={excludeIds}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPick={onPick as (row: any) => void}
      className={className}
    />
  );
}

// ── Tags ──────────────────────────────────────────────────────────────────────
// Admin's TagsPicker.onRemove receives a SelectedTag object; package expects an id string.

export function AdminTagsPickerAdapter({ selected, onAdd, onRemove, placeholder }: TagsPickerProps) {
  return (
    <TagsPicker
      selected={selected}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onAdd={onAdd as (tag: any) => void}
      onRemove={(tag) => onRemove(tag.id)}
      placeholder={placeholder}
    />
  );
}

// ── Albums manager ────────────────────────────────────────────────────────────
// Package's AlbumsManagerProps uses linkedAlbums + onChange(newList).
// Admin's AlbumsPicker uses selected + onAdd/onRemove.

export function AdminAlbumsManagerAdapter({ linkedAlbums, onChange }: AlbumsManagerProps) {
  return (
    <AlbumsPicker
      selected={linkedAlbums}
      onAdd={(album) => onChange([...linkedAlbums, { id: album.id, name: album.name }])}
      onRemove={(album) => onChange(linkedAlbums.filter((a) => a.id !== album.id))}
    />
  );
}

// ── Media picker button ───────────────────────────────────────────────────────
// AdminMediaListItem structurally matches StoryPickerMediaItem.

export function AdminMediaPickerButtonAdapter({
  targetType,
  targetId,
  mode,
  purpose,
  triggerLabel,
  triggerClassName,
  onAttach,
}: MediaPickerButtonProps) {
  return (
    <MediaPicker
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetType={targetType as any}
      targetId={targetId}
      mode={mode === "single" ? "single" : "multiple"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purpose={purpose as any}
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      onAttach={(items) => onAttach(items.map((m) => ({ id: m.id, title: m.title, description: m.description, fileRef: m.fileRef, form: m.form })))}
    />
  );
}

// ── Media picker modal ────────────────────────────────────────────────────────

export function AdminMediaPickerModalAdapter({
  open,
  onOpenChange,
  targetType,
  targetId,
  mode,
  purpose,
  onAttach,
}: MediaPickerModalProps) {
  return (
    <AdminMediaPickerModal
      open={open}
      onOpenChange={onOpenChange}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetType={targetType as any}
      targetId={targetId}
      mode={mode === "single" ? "single" : "multiple"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purpose={purpose as any}
      onAttach={(items) => onAttach(items.map((m) => ({ id: m.id, title: m.title, description: m.description, fileRef: m.fileRef, form: m.form })))}
    />
  );
}

// ── Editor pill ───────────────────────────────────────────────────────────────
// MediaEditorPill accepts { label, onRemove, disabled? } — structurally matches EditorPillProps.

export function AdminEditorPillAdapter({ label, onRemove }: EditorPillProps) {
  return <MediaEditorPill label={label} onRemove={onRemove} />;
}

// ── Notes picker ──────────────────────────────────────────────────────────────
// Admin's NotesPicker.onPick receives AdminNoteListItem; package expects StoryPickerNoteItem.

export function AdminNotesPickerAdapter({ idPrefix, onPick }: NotesPickerProps) {
  return (
    <NotesPicker
      idPrefix={idPrefix}
      onPick={(note) => onPick({ id: note.id, xref: note.xref ?? undefined })}
    />
  );
}
