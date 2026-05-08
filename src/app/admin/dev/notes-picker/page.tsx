"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { NotesPicker } from "@/components/admin/NotesPicker";
import type { AdminNoteListItem } from "@/hooks/useAdminNotes";

export default function AdminDevNotesPickerPage() {
  const [lastPick, setLastPick] = useState<AdminNoteListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());

  const onPick = useCallback((note: AdminNoteListItem) => {
    setLastPick(note);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(note.id);
      return next;
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <Link href="/admin/notes" className="text-sm text-primary underline-offset-2 hover:underline">
          ← Notes index
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-base-content">NotesPicker (dev)</h1>
        <p className="text-sm text-muted-foreground">
          Dummy page to exercise <code className="rounded bg-base-300/40 px-1">NotesPicker</code>. Picks stay
          highlighted as &quot;Added&quot; in the list.
        </p>
      </div>

      <NotesPicker selectedIds={selectedIds} onPick={onPick} />

      <div className="space-y-2 rounded-lg border border-base-content/12 bg-base-content/[0.03] p-4">
        <p className="text-sm font-medium text-base-content">Last pick</p>
        {lastPick ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
            {JSON.stringify(
              {
                id: lastPick.id,
                xref: lastPick.xref,
                isTopLevel: lastPick.isTopLevel,
                contentPreview: lastPick.content.slice(0, 200) + (lastPick.content.length > 200 ? "…" : ""),
              },
              null,
              2,
            )}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">None yet — use &quot;Add note&quot; on a result.</p>
        )}
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setLastPick(null);
            setSelectedIds(new Set());
          }}
        >
          Clear selection state
        </button>
      </div>
    </div>
  );
}
