"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NoteLinkedRecordsPicker } from "@/components/admin/NoteLinkedRecordsPicker";
import { NoteContentEditor } from "@/components/admin/NoteContentEditor";
import { useCreateNote, useUpdateNote } from "@/hooks/useAdminNotes";
import { ApiError } from "@/lib/infra/api";
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

export function NoteForm({
  mode,
  hideBackLink = false,
  noteId,
  initialContent,
  readOnlyXref,
  initialXref: _deprecatedInitialXref,
  initialIsTopLevel,
  initialLinks,
  contextReturnHref,
}: NoteFormProps) {
  const router = useRouter();
  const doneHref = safeAdminContextHref(contextReturnHref) ?? "/admin/notes";
  const [content, setContent] = useState(initialContent);
  const [isTopLevel, setIsTopLevel] = useState(initialIsTopLevel);
  const [selectedLinks, setSelectedLinks] = useState<SelectedNoteLink[]>(initialLinks);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();

  const isPending = createNote.isPending || updateNote.isPending;
  const err = createNote.error ?? updateNote.error;
  const errMsg = err?.message;
  const errStatus = err instanceof ApiError ? err.status : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    const links = selectedLinksToPayload(selectedLinks);

    if (mode === "create") {
      createNote.mutate(
        {
          content: trimmed,
          isTopLevel,
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
          isTopLevel,
          links,
        },
        {
          onSuccess: () => router.push(doneHref),
        },
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn("flex gap-2", hideBackLink ? "flex-col" : "items-center")}>
        {!hideBackLink ? (
          <Link
            href="/admin/notes"
            aria-label="Back to notes"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "create" ? "New note" : "Edit note"}
          </h1>
          <p className="text-muted-foreground">
            Markdown content. Link to individuals, families, events, or sources in this tree.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {errMsg && (
          <p className="text-sm text-destructive">
            {errMsg}
            {errStatus != null ? ` (${errStatus})` : ""}
          </p>
        )}

        <div className="space-y-2" role="group" aria-labelledby="note-content-label">
          <Label id="note-content-label">Content *</Label>
          <NoteContentEditor
            noteKey={mode === "create" ? "new" : (noteId ?? "edit")}
            value={content}
            onChange={setContent}
            className="w-full min-w-0"
          />
        </div>

        {mode === "edit" && (
          <div className="space-y-1">
            <Label>XREF</Label>
            <p className="font-mono text-sm text-base-content">{readOnlyXref?.trim() || "—"}</p>
            <p className="text-xs text-muted-foreground">
              Assigned when the note was created; it cannot be changed here.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-base-content/12 bg-base-200/30 px-4 py-3">
          <Checkbox
            id="note-top-level"
            checked={isTopLevel}
            onCheckedChange={(v) => setIsTopLevel(v === true)}
            className="mt-0.5"
            aria-describedby="note-top-level-hint"
          />
          <div className="min-w-0">
            <Label htmlFor="note-top-level" className="cursor-pointer font-medium leading-snug">
              Top-level note
            </Label>
            <p id="note-top-level-hint" className="text-xs text-muted-foreground">
              When checked, this note is treated as a standalone GEDCOM NOTE record (not only inline under another
              entity).
            </p>
          </div>
        </div>

        <NoteLinkedRecordsPicker value={selectedLinks} onChange={setSelectedLinks} />

        <div className="flex flex-wrap gap-2">
          <Link href={doneHref} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
          <Button type="submit" disabled={isPending || !content.trim()}>
            {isPending ? "Saving…" : mode === "create" ? "Create note" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
