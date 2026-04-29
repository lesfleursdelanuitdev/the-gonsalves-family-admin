"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NoteLinkedRecordsPicker } from "@/components/admin/NoteLinkedRecordsPicker";
import { NoteContentEditor } from "@/components/admin/NoteContentEditor";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import { EventPicker } from "@/components/admin/EventPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { useCreateNote, useDeleteNote, useUpdateNote } from "@/hooks/useAdminNotes";
import { ApiError } from "@/lib/infra/api";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import { type SelectedNoteLink, selectedLinksToPayload } from "@/lib/forms/note-form-links";

function safeAdminContextHref(href: string | undefined): string | undefined {
  if (!href?.trim()) return undefined;
  const t = href.trim();
  if (!t.startsWith("/admin/")) return undefined;
  if (t.includes("://")) return undefined;
  return t;
}

interface NoteFormProps {
  mode: "create" | "edit";
  /** When the page shell already shows “Back to notes”, hide the icon button in the header. */
  hideBackLink?: boolean;
  noteId?: string;
  initialContent: string;
  /** Shown read-only on edit; XREF is assigned on create by the API */
  readOnlyXref?: string | null;
  /**
   * Ignored — kept so older call sites do not break. Note XREF is allocated on the server at create.
   * @deprecated
   */
  initialXref?: string;
  initialIsTopLevel: boolean;
  initialLinks: SelectedNoteLink[];
  /**
   * When set (e.g. opened from an individual/family editor), Cancel and successful Save go here instead of /admin/notes.
   */
  contextReturnHref?: string;
}

type NoteStatus = "draft" | "reviewed" | "needs-verification";

function splitTitleAndBody(markdown: string): { title: string; body: string } {
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i]?.trim()) i++;
  const first = lines[i] ?? "";
  const heading = first.match(/^#{1,2}\s+(.+)$/);
  if (heading?.[1]) {
    const rest = lines.slice(i + 1).join("\n").replace(/^\n+/, "");
    return { title: heading[1].trim(), body: rest };
  }
  return { title: "", body: markdown };
}

function combineTitleAndBody(title: string, body: string): string {
  const t = title.trim();
  const b = body.trim();
  if (!t) return b;
  if (!b) return `# ${t}`;
  return `# ${t}\n\n${b}`;
}

export function NoteForm({
  mode,
  hideBackLink = false,
  noteId,
  initialContent,
  readOnlyXref,
  initialIsTopLevel,
  initialLinks,
  contextReturnHref,
}: NoteFormProps) {
  const router = useRouter();
  const doneHref = safeAdminContextHref(contextReturnHref) ?? "/admin/notes";
  const initialParts = useMemo(() => splitTitleAndBody(initialContent), [initialContent]);
  const [title, setTitle] = useState(initialParts.title);
  const [bodyContent, setBodyContent] = useState(initialParts.body);
  const [isTopLevel, setIsTopLevel] = useState(initialIsTopLevel);
  const [selectedLinks, setSelectedLinks] = useState<SelectedNoteLink[]>(initialLinks);
  const [noteStatus, setNoteStatus] = useState<NoteStatus>("draft");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "family-only">(initialIsTopLevel ? "public" : "family-only");

  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const isPending = createNote.isPending || updateNote.isPending || deleteNote.isPending;
  const err = createNote.error ?? updateNote.error;
  const errMsg = err?.message;
  const errStatus = err instanceof ApiError ? err.status : undefined;
  const markdownContent = combineTitleAndBody(title, bodyContent);

  const peopleLinks = selectedLinks.filter((l) => l.kind === "individual");
  const familyLinks = selectedLinks.filter((l) => l.kind === "family");
  const eventLinks = selectedLinks.filter((l) => l.kind === "event");

  const selectedIdSetByKind = (kind: SelectedNoteLink["kind"]) =>
    new Set(selectedLinks.filter((l) => l.kind === kind).map((l) => l.id));

  const addLink = (next: SelectedNoteLink) => {
    setSelectedLinks((prev) => {
      if (prev.some((p) => p.kind === next.kind && p.id === next.id)) return prev;
      return [...prev, next];
    });
  };

  const removeLink = (kind: SelectedNoteLink["kind"], id: string) => {
    setSelectedLinks((prev) => prev.filter((p) => !(p.kind === kind && p.id === id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = markdownContent.trim();
    if (!trimmed) return;

    const links = selectedLinksToPayload(selectedLinks);
    const isTopLevelFromVisibility = isTopLevel || visibility === "public";

    if (mode === "create") {
      createNote.mutate(
        {
          content: trimmed,
          isTopLevel: isTopLevelFromVisibility,
          links,
        },
        {
          onSuccess: () => router.push(doneHref),
        },
      );
    } else if (noteId) {
      updateNote.mutate(
        {
          id: noteId,
          content: trimmed,
          isTopLevel: isTopLevelFromVisibility,
          links,
        },
        {
          onSuccess: () => router.push(doneHref),
        },
      );
    }
  };

  const onAddTag = () => {
    const next = tagDraft.trim();
    if (!next) return;
    setTags((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setTagDraft("");
  };

  const handleDelete = () => {
    if (mode !== "edit" || !noteId) return;
    if (!window.confirm("Delete this note and all of its links? This cannot be undone.")) return;
    deleteNote.mutate(noteId, {
      onSuccess: () => router.push("/admin/notes"),
    });
  };

  return (
    <div className="space-y-6 pb-28">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
        <div className="min-w-0 space-y-1">
          {!hideBackLink ? (
            <Link href={doneHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}>
              <ArrowLeft className="size-4" aria-hidden />
              Notes
            </Link>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "New note" : "Edit note"}</h1>
          <p className="text-sm text-muted-foreground">Write a note and link it to people, families, events, or media.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={doneHref} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
          <Button type="submit" form="note-editor-form" disabled={isPending || !markdownContent.trim()}>
            {isPending ? "Saving…" : "Save note"}
          </Button>
        </div>
      </header>

      <form id="note-editor-form" onSubmit={handleSubmit} className="space-y-6">
        {errMsg && (
          <p className="text-sm text-destructive">
            {errMsg}
            {errStatus != null ? ` (${errStatus})` : ""}
          </p>
        )}

        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="mb-2 flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">1</span>
                <div>
                  <h2 className="text-base font-semibold">Note content</h2>
                  <p className="text-sm text-muted-foreground">Write your note using Markdown and rich text formatting.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-title">Title</Label>
                <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <NoteContentEditor
                  noteKey={mode === "create" ? "new" : (noteId ?? "edit")}
                  value={bodyContent}
                  onChange={setBodyContent}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Markdown · {markdownContent.trim().split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-base-content/10 bg-base-content/[0.02] p-4">
              <div className="mb-1 flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">2</span>
                <div>
                  <h2 className="text-base font-semibold">Linked records</h2>
                  <p className="text-sm text-muted-foreground">Connect this note to the records it relates to.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>People</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPeoplePicker((v) => !v)}>
                    <Plus className="size-4" aria-hidden />
                    Add person
                  </Button>
                </div>
                {peopleLinks.map((l) => (
                  <div key={`p-${l.id}`} className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2">
                    <p className="text-sm">{l.label}</p>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeLink("individual", l.id)}>×</button>
                  </div>
                ))}
                {showPeoplePicker ? (
                  <IndividualSearchPicker
                    idPrefix={`note-ind-${noteId ?? "new"}`}
                    excludeIds={selectedIdSetByKind("individual")}
                    onPick={(ind) => {
                      addLink({ kind: "individual", id: ind.id, label: ind.fullName?.trim() || ind.xref || ind.id });
                      setShowPeoplePicker(false);
                    }}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Families</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowFamilyPicker((v) => !v)}>
                    <Plus className="size-4" aria-hidden />
                    Add family
                  </Button>
                </div>
                {familyLinks.map((l) => (
                  <div key={`f-${l.id}`} className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2">
                    <p className="text-sm">{l.label}</p>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeLink("family", l.id)}>×</button>
                  </div>
                ))}
                {showFamilyPicker ? (
                  <FamilySearchPicker
                    idPrefix={`note-fam-${noteId ?? "new"}`}
                    excludeIds={selectedIdSetByKind("family")}
                    onPick={(fam) => {
                      addLink({ kind: "family", id: fam.id, label: fam.xref || fam.id });
                      setShowFamilyPicker(false);
                    }}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Events</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowEventPicker((v) => !v)}>
                    <Plus className="size-4" aria-hidden />
                    Add event
                  </Button>
                </div>
                {eventLinks.map((l) => (
                  <div key={`e-${l.id}`} className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2">
                    <p className="text-sm">{l.label}</p>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeLink("event", l.id)}>×</button>
                  </div>
                ))}
                {showEventPicker ? (
                  <EventPicker
                    idPrefix={`note-ev-${noteId ?? "new"}`}
                    requireEventType={false}
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
                    excludeEventIds={selectedIdSetByKind("event")}
                    onPick={(ev) => {
                      addLink({ kind: "event", id: ev.id, label: formatNoteEventPickerLabel(ev) });
                      setShowEventPicker(false);
                    }}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Media</Label>
                  {mode === "edit" && noteId ? (
                    <Link
                      href={`/admin/media/new?returnTo=${encodeURIComponent(`/admin/notes/${noteId}/edit`)}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add media
                    </Link>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled>
                      <Plus className="size-4" aria-hidden />
                      Add media
                    </Button>
                  )}
                </div>
                {mode === "edit" && noteId ? (
                  <ViewAsAlbumLink entityType="note" entityId={noteId} label="View linked media" includeCount />
                ) : (
                  <p className="text-sm text-muted-foreground">Save the note first to attach media.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">3</span>
            <div>
              <h2 className="text-base font-semibold">Organization</h2>
              <p className="text-sm text-muted-foreground">Organize your note with tags and settings.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-content/[0.05] px-2 py-1 text-xs">
                    {t}
                    <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>×</button>
                  </span>
                ))}
                <div className="flex items-center gap-2">
                  <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Tag" className="h-9 w-28" />
                  <Button type="button" variant="outline" size="sm" onClick={onAddTag}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-visibility">Visibility</Label>
              <select
                id="note-visibility"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={visibility}
                onChange={(e) => {
                  const next = e.target.value as "public" | "private" | "family-only";
                  setVisibility(next);
                  setIsTopLevel(next === "public");
                }}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="family-only">Family only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-status">Status</Label>
              <select
                id="note-status"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={noteStatus}
                onChange={(e) => setNoteStatus(e.target.value as NoteStatus)}
              >
                <option value="draft">Draft</option>
                <option value="reviewed">Reviewed</option>
                <option value="needs-verification">Needs verification</option>
              </select>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-base-content/12 bg-base-200/30 px-4 py-3">
              <Checkbox
                id="note-top-level"
                checked={isTopLevel}
                onCheckedChange={(v) => setIsTopLevel(v === true)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label htmlFor="note-top-level" className="cursor-pointer font-medium leading-snug">
                  Top-level note
                </Label>
                <p className="text-xs text-muted-foreground">Stored as standalone GEDCOM NOTE when enabled.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">4</span>
            <div>
              <h2 className="text-base font-semibold">Advanced details</h2>
              <p className="text-sm text-muted-foreground">Technical and system information.</p>
            </div>
          </div>
          {!showAdvancedDetails ? (
            <Button type="button" variant="outline" onClick={() => setShowAdvancedDetails(true)}>
              Show advanced details
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="text-muted-foreground">GEDCOM XREF:</span> <span className="font-mono">{readOnlyXref?.trim() || "—"}</span>
              </p>
              {mode === "edit" && noteId ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Internal ID:</span> <span className="font-mono">{noteId}</span>
                </p>
              ) : null}
              <NoteLinkedRecordsPicker
                value={selectedLinks}
                onChange={setSelectedLinks}
                allowedLinkKinds={["source"]}
                linkingHint="Optional: link source records to this note."
                addLinkButtonLabel="Add source"
                idleBuildersHint='No source search open. Use "Add source".'
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvancedDetails(false)}>
                Hide advanced details
              </Button>
            </div>
          )}
        </section>

        {mode === "edit" ? (
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-5 text-destructive" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deleting removes this note and all links to people, families, events, and sources.
                </p>
              </div>
            </div>
            <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={handleDelete} disabled={isPending}>
              {deleteNote.isPending ? "Deleting…" : "Delete note"}
            </Button>
          </section>
        ) : null}
      </form>
    </div>
  );
}
