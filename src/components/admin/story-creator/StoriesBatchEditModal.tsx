"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminIndividuals, type AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { useAdminEvents, type AdminEventListItem } from "@/hooks/useAdminEvents";
import { useAdminNoteSearch, type AdminNoteListItem } from "@/hooks/useAdminNotes";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { postJson } from "@/lib/infra/api";

// ── Label helpers ──────────────────────────────────────────────────────────────

function individualLabel(ind: AdminIndividualListItem): string {
  return stripSlashesFromName(ind.fullName) || ind.xref || ind.id;
}

function eventLabel(ev: AdminEventListItem): string {
  const type = ev.customType?.trim() || ev.eventType || "Event";
  const year = ev.date?.year != null ? String(ev.date.year) : "";
  const names = ev.individualEvents
    .map((ie) => stripSlashesFromName(ie.individual.fullName))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return [type, year, names].filter(Boolean).join(" · ");
}

function notePreview(content: string): string {
  const line = content.replace(/\s+/g, " ").trim();
  return line.length <= 90 ? line : `${line.slice(0, 87)}…`;
}

// ── Staged-items chips ─────────────────────────────────────────────────────────

function StagedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-content/[0.04] px-2.5 py-0.5 text-xs font-medium"
      onClick={onRemove}
      title="Remove"
    >
      <span className="truncate max-w-[14rem]">{label}</span>
      <X className="size-3 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

// ── Search results dropdown ────────────────────────────────────────────────────

function SearchResults({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="max-h-40 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-1">
      {loading ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
      ) : empty ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No results.</p>
      ) : (
        children
      )}
    </div>
  );
}

function ResultRow({
  picked,
  onClick,
  children,
}: {
  picked?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-base-content/[0.06] ${picked ? "bg-primary/10" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

type StagedItem = { id: string; label: string };

export function StoriesBatchEditModal({
  open,
  onOpenChange,
  selectedIds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onApplied: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Tags (free-form strings)
  const [tagInput, setTagInput] = useState("");
  const [stagedTags, setStagedTags] = useState<string[]>([]);

  // Individuals
  const [indQ, setIndQ] = useState("");
  const [stagedInds, setStagedInds] = useState<StagedItem[]>([]);
  const debouncedIndQ = useDebouncedValue(indQ.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const indsQuery = useAdminIndividuals(
    { q: debouncedIndQ, limit: 20 },
    { enabled: open && debouncedIndQ.length >= 2 },
  );
  const indResults = useMemo(() => indsQuery.data?.individuals ?? [], [indsQuery.data]);

  // Events
  const [evQ, setEvQ] = useState("");
  const [stagedEvs, setStagedEvs] = useState<StagedItem[]>([]);
  const debouncedEvQ = useDebouncedValue(evQ.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const evsQuery = useAdminEvents(
    { q: debouncedEvQ, limit: 20 },
    { enabled: open && debouncedEvQ.length >= 2 },
  );
  const evResults = useMemo(() => evsQuery.data?.events ?? [], [evsQuery.data]);

  // Notes
  const [noteQ, setNoteQ] = useState("");
  const [stagedNotes, setStagedNotes] = useState<StagedItem[]>([]);
  const debouncedNoteQ = useDebouncedValue(noteQ.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const noteSearch = useAdminNoteSearch(debouncedNoteQ, { enabled: open && debouncedNoteQ.length >= 2 });
  const noteResults = useMemo(() => noteSearch.data?.notes ?? [], [noteSearch.data]);

  const resetForm = useCallback(() => {
    setErr(null);
    setTagInput("");
    setStagedTags([]);
    setIndQ("");
    setStagedInds([]);
    setEvQ("");
    setStagedEvs([]);
    setNoteQ("");
    setStagedNotes([]);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  // Tag helpers
  const addTag = () => {
    const t = tagInput.trim().slice(0, 100);
    if (!t) return;
    setStagedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagInput("");
  };

  // Individual helpers
  const addInd = (ind: AdminIndividualListItem) => {
    setStagedInds((prev) => (prev.some((x) => x.id === ind.id) ? prev : [...prev, { id: ind.id, label: individualLabel(ind) }]));
    setIndQ("");
  };

  // Event helpers
  const addEv = (ev: AdminEventListItem) => {
    setStagedEvs((prev) => (prev.some((x) => x.id === ev.id) ? prev : [...prev, { id: ev.id, label: eventLabel(ev) }]));
    setEvQ("");
  };

  // Note helpers
  const addNote = (note: AdminNoteListItem) => {
    const label = notePreview(note.content) || note.id;
    setStagedNotes((prev) => (prev.some((x) => x.id === note.id) ? prev : [...prev, { id: note.id, label }]));
    setNoteQ("");
  };

  const apply = useCallback(async () => {
    const ids = selectedIds.filter(Boolean);
    if (ids.length === 0) { setErr("Nothing selected."); return; }
    if (stagedTags.length === 0 && stagedInds.length === 0 && stagedEvs.length === 0 && stagedNotes.length === 0) {
      setErr("Stage at least one tag, person, event, or note to apply.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      await postJson("/api/admin/stories/batch-edit", {
        storyIds: ids,
        tagNames: stagedTags,
        individualIds: stagedInds.map((i) => i.id),
        eventIds: stagedEvs.map((e) => e.id),
        noteIds: stagedNotes.map((n) => n.id),
      });

      const parts: string[] = [];
      if (stagedTags.length > 0) parts.push(`${stagedTags.length} tag${stagedTags.length !== 1 ? "s" : ""}`);
      if (stagedInds.length > 0) parts.push(`${stagedInds.length} person${stagedInds.length !== 1 ? "s" : ""}`);
      if (stagedEvs.length > 0) parts.push(`${stagedEvs.length} event${stagedEvs.length !== 1 ? "s" : ""}`);
      if (stagedNotes.length > 0) parts.push(`${stagedNotes.length} note${stagedNotes.length !== 1 ? "s" : ""}`);
      toast.success(`Applied ${parts.join(", ")} to ${ids.length} stor${ids.length !== 1 ? "ies" : "y"}.`);

      resetForm();
      onApplied();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [selectedIds, stagedTags, stagedInds, stagedEvs, stagedNotes, resetForm, onApplied, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Edit {selectedIds.length} selected stor{selectedIds.length !== 1 ? "ies" : "y"}</DialogTitle>
        <DialogDescription>
          Add tags, link people, events, or notes to every selected story. Existing links are kept; duplicates are skipped.
        </DialogDescription>

        {err ? (
          <p className="text-sm text-destructive" role="alert">{err}</p>
        ) : null}

        <div className="space-y-5 pt-1">
          {/* ── Tags ── */}
          <div className="space-y-2">
            <Label>Tags</Label>
            {stagedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stagedTags.map((t) => (
                  <StagedChip key={t} label={t} onRemove={() => setStagedTags((p) => p.filter((x) => x !== t))} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tags staged.</p>
            )}
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Type a tag and press Enter or Add…"
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={addTag}>
                <Plus className="size-3.5" aria-hidden />
                Add
              </Button>
            </div>
          </div>

          {/* ── People ── */}
          <div className="space-y-2 border-t border-base-content/10 pt-4">
            <Label>Link people</Label>
            {stagedInds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stagedInds.map((i) => (
                  <StagedChip key={i.id} label={i.label} onRemove={() => setStagedInds((p) => p.filter((x) => x.id !== i.id))} />
                ))}
              </div>
            ) : null}
            <Input
              value={indQ}
              onChange={(e) => setIndQ(e.target.value)}
              placeholder="Search individuals (2+ characters)…"
              className="h-9"
            />
            {debouncedIndQ.length >= 2 ? (
              <SearchResults loading={indsQuery.isLoading} empty={indResults.length === 0}>
                {indResults.map((ind) => (
                  <ResultRow
                    key={ind.id}
                    picked={stagedInds.some((s) => s.id === ind.id)}
                    onClick={() => addInd(ind)}
                  >
                    <Plus className="size-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate">{individualLabel(ind)}</span>
                    {ind.birthYear ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ind.birthYear}</span> : null}
                  </ResultRow>
                ))}
              </SearchResults>
            ) : null}
          </div>

          {/* ── Events ── */}
          <div className="space-y-2 border-t border-base-content/10 pt-4">
            <Label>Link events</Label>
            {stagedEvs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stagedEvs.map((e) => (
                  <StagedChip key={e.id} label={e.label} onRemove={() => setStagedEvs((p) => p.filter((x) => x.id !== e.id))} />
                ))}
              </div>
            ) : null}
            <Input
              value={evQ}
              onChange={(e) => setEvQ(e.target.value)}
              placeholder="Search events (2+ characters)…"
              className="h-9"
            />
            {debouncedEvQ.length >= 2 ? (
              <SearchResults loading={evsQuery.isLoading} empty={evResults.length === 0}>
                {evResults.map((ev) => (
                  <ResultRow
                    key={ev.id}
                    picked={stagedEvs.some((s) => s.id === ev.id)}
                    onClick={() => addEv(ev)}
                  >
                    <Plus className="size-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate">{eventLabel(ev)}</span>
                  </ResultRow>
                ))}
              </SearchResults>
            ) : null}
          </div>

          {/* ── Notes ── */}
          <div className="space-y-2 border-t border-base-content/10 pt-4">
            <Label>Link notes</Label>
            {stagedNotes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stagedNotes.map((n) => (
                  <StagedChip key={n.id} label={n.label} onRemove={() => setStagedNotes((p) => p.filter((x) => x.id !== n.id))} />
                ))}
              </div>
            ) : null}
            <Input
              value={noteQ}
              onChange={(e) => setNoteQ(e.target.value)}
              placeholder="Search notes (2+ characters)…"
              className="h-9"
            />
            {debouncedNoteQ.length >= 2 ? (
              <SearchResults loading={noteSearch.isLoading} empty={noteResults.length === 0}>
                {noteResults.map((note) => (
                  <ResultRow
                    key={note.id}
                    picked={stagedNotes.some((s) => s.id === note.id)}
                    onClick={() => addNote(note)}
                  >
                    <Plus className="size-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate text-xs">{notePreview(note.content)}</span>
                  </ResultRow>
                ))}
              </SearchResults>
            ) : null}
          </div>
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
