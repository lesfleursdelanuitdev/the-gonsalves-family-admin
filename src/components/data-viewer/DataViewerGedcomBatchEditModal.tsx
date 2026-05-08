"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { EntityType } from "@ligneous/prisma";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminTags, type AdminTagListItem } from "@/hooks/useAdminTags";
import { useAdminMedia, type AdminMediaListItem } from "@/hooks/useAdminMedia";
import { useAdminNoteSearch, type AdminNoteListItem } from "@/hooks/useAdminNotes";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { ApiError, postJson } from "@/lib/infra/api";
import { ADMIN_MEDIA_QUERY_KEY } from "@/hooks/useAdminMedia";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";
import { ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import { ADMIN_EVENTS_QUERY_KEY } from "@/hooks/useAdminEvents";

export type GedcomBatchEntityKind = "individual" | "family" | "event" | "source" | "note";

async function postIgnore409(url: string, body: Record<string, unknown>): Promise<void> {
  try {
    await postJson(url, body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return;
    throw e;
  }
}

type StagedTag = { tagId: string; name: string; color: string | null };

function entityTypeForKind(kind: GedcomBatchEntityKind): EntityType {
  switch (kind) {
    case "individual":
      return EntityType.individual;
    case "family":
      return EntityType.family;
    case "event":
      return EntityType.event;
    case "source":
      return EntityType.source;
    case "note":
      return EntityType.note;
    default:
      return EntityType.individual;
  }
}

function linkMediaConfig(kind: GedcomBatchEntityKind): {
  path: string;
  bodyKey: string;
} | null {
  switch (kind) {
    case "individual":
      return { path: "individual-media", bodyKey: "individualId" };
    case "family":
      return { path: "family-media", bodyKey: "familyId" };
    case "event":
      return { path: "event-media", bodyKey: "eventId" };
    case "source":
      return { path: "source-media", bodyKey: "sourceId" };
    default:
      return null;
  }
}

/** GEDCOM entity kinds that can be linked to notes via junction tables (not `note` rows themselves). */
function supportsBatchNoteLinking(kind: GedcomBatchEntityKind): boolean {
  return kind === "individual" || kind === "family" || kind === "event" || kind === "source";
}

function batchNoteLinkUrl(kind: GedcomBatchEntityKind, entityId: string): string {
  switch (kind) {
    case "individual":
      return `/api/admin/individuals/${entityId}/notes`;
    case "family":
      return `/api/admin/families/${entityId}/notes`;
    case "event":
      return `/api/admin/events/${entityId}/notes`;
    case "source":
      return `/api/admin/sources/${entityId}/notes`;
    default:
      return "";
  }
}

function parsePastedNoteId(raw: string): string | null {
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

function noteListPreview(content: string): string {
  const line = content.replace(/\s+/g, " ").trim().split("\n")[0] ?? "";
  if (line.length <= 96) return line;
  return `${line.slice(0, 93)}…`;
}

export function DataViewerGedcomBatchEditModal({
  open,
  onOpenChange,
  entityKind,
  selectedIds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityKind: GedcomBatchEntityKind;
  selectedIds: string[];
  onApplied: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [batchTags, setBatchTags] = useState<StagedTag[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [pickedMedia, setPickedMedia] = useState<AdminMediaListItem | null>(null);
  const [mediaIdDraft, setMediaIdDraft] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [pickedNote, setPickedNote] = useState<AdminNoteListItem | null>(null);
  const [noteIdDraft, setNoteIdDraft] = useState("");

  const debouncedTagQ = useDebouncedValue(tagQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedMediaQ = useDebouncedValue(mediaQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedNoteQ = useDebouncedValue(noteQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const tagsQuery = useAdminTags({ q: debouncedTagQ, limit: 40 }, { enabled: debouncedTagQ.length >= 1 });
  const mediaQueryEnabled = debouncedMediaQ.length >= 1;
  const mediaListQuery = useAdminMedia(
    {
      scope: "family-tree",
      q: debouncedMediaQ,
      limit: 20,
      offset: 0,
    },
    mediaQueryEnabled && open,
  );

  const noteSearchEnabled =
    open && supportsBatchNoteLinking(entityKind) && debouncedNoteQ.length >= 2;
  const noteSearchQuery = useAdminNoteSearch(debouncedNoteQ, { enabled: noteSearchEnabled, limit: 15 });

  const tagResults = useMemo(() => tagsQuery.data?.tags ?? [], [tagsQuery.data?.tags]);
  const mediaResults = useMemo(() => mediaListQuery.data?.media ?? [], [mediaListQuery.data?.media]);
  const noteResults = useMemo(() => noteSearchQuery.data?.notes ?? [], [noteSearchQuery.data?.notes]);

  const exactTagMatch = useMemo(
    () => tagResults.some((t) => displayTagName(t.name) === displayTagName(tagQuery)),
    [tagResults, tagQuery],
  );

  const linkCfg = useMemo(() => linkMediaConfig(entityKind), [entityKind]);
  const resolvedMediaId = (pickedMedia?.id ?? mediaIdDraft).trim();
  const resolvedNoteId = (pickedNote?.id ?? parsePastedNoteId(noteIdDraft) ?? "").trim();

  const resetForm = useCallback(() => {
    setErr(null);
    setBatchTags([]);
    setTagQuery("");
    setMediaQuery("");
    setPickedMedia(null);
    setMediaIdDraft("");
    setNoteQuery("");
    setPickedNote(null);
    setNoteIdDraft("");
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const addTag = useCallback((t: AdminTagListItem) => {
    setBatchTags((prev) => {
      if (prev.some((x) => x.tagId === t.id)) return prev;
      return [...prev, { tagId: t.id, name: t.name, color: t.color ?? null }];
    });
    setTagQuery("");
  }, []);

  const removeTag = useCallback((tagId: string) => {
    setBatchTags((prev) => prev.filter((t) => t.tagId !== tagId));
  }, []);

  const apply = useCallback(async () => {
    const ids = selectedIds.filter(Boolean);
    if (ids.length === 0) {
      setErr("Nothing selected.");
      return;
    }
    const tagIds = batchTags.map((t) => t.tagId);
    const wantTags = tagIds.length > 0;
    const wantLink = Boolean(linkCfg && resolvedMediaId);
    const wantNoteLink = supportsBatchNoteLinking(entityKind) && Boolean(resolvedNoteId);
    if (!wantTags && !wantLink && !wantNoteLink) {
      setErr("Add at least one tag, pick tree media to link, or choose a note to link.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      if (wantTags) {
        await postJson("/api/admin/tagged-items/batch", {
          entityType: entityTypeForKind(entityKind),
          entityIds: ids,
          tagIds,
        });
        void qc.invalidateQueries({ queryKey: ["admin", "tags"] });
      }

      if (wantLink && linkCfg) {
        const urlBase = `/api/admin/media/${resolvedMediaId}/${linkCfg.path}`;
        for (const entityId of ids) {
          await postIgnore409(urlBase, { [linkCfg.bodyKey]: entityId });
        }
        await qc.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
      }

      if (wantNoteLink && resolvedNoteId) {
        for (const entityId of ids) {
          await postJson(batchNoteLinkUrl(entityKind, entityId), { noteId: resolvedNoteId });
        }
        void qc.invalidateQueries({ queryKey: ["admin", "notes"] });
        if (entityKind === "individual") {
          void qc.invalidateQueries({ queryKey: ADMIN_INDIVIDUALS_QUERY_KEY });
        } else if (entityKind === "family") {
          void qc.invalidateQueries({ queryKey: ADMIN_FAMILIES_QUERY_KEY });
        } else if (entityKind === "event") {
          void qc.invalidateQueries({ queryKey: ADMIN_EVENTS_QUERY_KEY });
        } else if (entityKind === "source") {
          void qc.invalidateQueries({ queryKey: ["admin", "sources"] });
        }
      }

      const applied: string[] = [];
      if (wantTags) applied.push("tags");
      if (wantLink) applied.push("media");
      if (wantNoteLink) applied.push("notes");
      toast.success(
        applied.length > 0
          ? `Applied ${applied.join(" and ")} to ${ids.length} row${ids.length === 1 ? "" : "s"}.`
          : `Updated ${ids.length} row${ids.length === 1 ? "" : "s"}.`,
      );
      resetForm();
      onApplied();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    batchTags,
    entityKind,
    linkCfg,
    qc,
    onApplied,
    onOpenChange,
    resetForm,
    resolvedMediaId,
    resolvedNoteId,
    selectedIds,
  ]);

  const entityLabel =
    entityKind === "individual"
      ? "people"
      : entityKind === "family"
        ? "families"
        : entityKind === "event"
          ? "events"
          : entityKind === "source"
            ? "sources"
            : "notes";

  const entitySingular =
    entityKind === "individual"
      ? "person"
      : entityKind === "family"
        ? "family"
        : entityKind === "event"
          ? "event"
          : entityKind === "source"
            ? "source"
            : "note";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Edit selected {entityLabel}</DialogTitle>
        <DialogDescription>
          Apply tags, optionally link one family-tree media item, and (for people, families, events, and sources) link
          one existing note to every selected row. Existing links are left unchanged; duplicate links are skipped.
        </DialogDescription>

        {err ? (
          <p className="text-sm text-destructive" role="alert">
            {err}
          </p>
        ) : null}

        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {batchTags.length === 0 ? (
                <span className="text-xs text-muted-foreground">No tags staged.</span>
              ) : (
                batchTags.map((t) => (
                  <button
                    key={t.tagId}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-content/[0.04] px-2 py-0.5 text-xs font-medium"
                    onClick={() => removeTag(t.tagId)}
                    title="Remove"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color ?? "var(--muted-foreground)" }}
                      aria-hidden
                    />
                    {displayTagName(t.name)}
                    <span className="text-muted-foreground">×</span>
                  </button>
                ))
              )}
            </div>
            <Input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Search tags to add…"
              className="h-9"
            />
            {debouncedTagQ.length >= 1 ? (
              <div className="max-h-40 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-1">
                {tagsQuery.isLoading ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
                ) : tagResults.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
                ) : (
                  tagResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-base-content/[0.06]"
                      onClick={() => addTag(t)}
                    >
                      <Plus className="size-3.5 shrink-0 opacity-60" aria-hidden />
                      <span className="truncate">{displayTagName(t.name)}</span>
                    </button>
                  ))
                )}
                {!exactTagMatch && tagQuery.trim().length >= 1 ? (
                  <p className="border-t border-base-content/10 px-2 py-1.5 text-[11px] text-muted-foreground">
                    Create new tags from the Tags admin page, then search here.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {supportsBatchNoteLinking(entityKind) ? (
            <div className="space-y-2 border-t border-base-content/10 pt-3">
              <Label>Link an existing note</Label>
              <p className="text-xs text-muted-foreground">
                Search by text or pick a row; the same note is linked to each selected {entitySingular}. Paste a note
                UUID if you already know it.
              </p>
              <Input
                value={noteQuery}
                onChange={(e) => {
                  setNoteQuery(e.target.value);
                  setPickedNote(null);
                }}
                placeholder="Search notes (at least 2 characters)…"
                className="h-9"
              />
              {debouncedNoteQ.length >= 2 ? (
                <div className="max-h-36 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-1">
                  {noteSearchQuery.isLoading ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
                  ) : noteResults.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    noteResults.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-base-content/[0.06] ${
                          pickedNote?.id === n.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          setPickedNote(n);
                          setNoteIdDraft(n.id);
                        }}
                      >
                        <span className="truncate font-medium">{(n.xref ?? "").trim() || n.id}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{noteListPreview(n.content)}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Or paste note UUID</span>
                <Input
                  value={noteIdDraft}
                  onChange={(e) => {
                    setNoteIdDraft(e.target.value);
                    setPickedNote(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
          ) : null}

          {linkCfg ? (
            <div className="space-y-2 border-t border-base-content/10 pt-3">
              <Label>Link family-tree media</Label>
              <p className="text-xs text-muted-foreground">
                Pick a media row or paste its UUID. The same item is linked to each selected {entitySingular}.
              </p>
              <Input
                value={mediaQuery}
                onChange={(e) => {
                  setMediaQuery(e.target.value);
                  setPickedMedia(null);
                }}
                placeholder="Search media by title or file…"
                className="h-9"
              />
              {mediaQueryEnabled ? (
                <div className="max-h-36 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-1">
                  {mediaListQuery.isLoading ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
                  ) : mediaResults.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    mediaResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-base-content/[0.06] ${
                          pickedMedia?.id === m.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          setPickedMedia(m);
                          setMediaIdDraft(m.id);
                        }}
                      >
                        <span className="truncate font-medium">{(m.title ?? "").trim() || m.id}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">{m.id}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Or paste media UUID</span>
                <Input
                  value={mediaIdDraft}
                  onChange={(e) => {
                    setMediaIdDraft(e.target.value);
                    setPickedMedia(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" className="gap-2" onClick={() => void apply()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Apply to {selectedIds.length} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
