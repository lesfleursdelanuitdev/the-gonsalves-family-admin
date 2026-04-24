"use client";

import { useId, useMemo, useState } from "react";
import { useAdminNoteSearch, type AdminNoteListItem } from "@/hooks/useAdminNotes";
import { notePickerContentPreviewLines } from "@/lib/admin/note-picker-preview";
import { notePickerLinkedBlocks } from "@/lib/admin/note-picker-linked-summary";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type NotePickerProps = {
  /** Notes already chosen in this flow — row stays visible; add action disabled. */
  selectedIds?: Set<string>;
  /** Notes to omit from results (e.g. already linked elsewhere). */
  excludeIds?: Set<string>;
  onPick: (note: AdminNoteListItem) => void;
  /** Input placeholder; keep oriented toward natural language. */
  placeholder?: string;
  limit?: number;
  /** Minimum trimmed query length before hitting the API. */
  minSearchLength?: number;
  idPrefix?: string;
  className?: string;
};

export function NotePicker({
  selectedIds,
  excludeIds,
  onPick,
  placeholder = 'e.g. madeira migration "sugar estate"',
  limit = 15,
  minSearchLength = 2,
  idPrefix: idPrefixProp,
  className,
}: NotePickerProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `np-${auto}-`;
  const [rawQuery, setRawQuery] = useState("");
  const debouncedQuery = useDebouncedValue(rawQuery.trim(), 300);

  const search = useAdminNoteSearch(debouncedQuery, { limit, minLength: minSearchLength });

  const visibleNotes = useMemo(() => {
    const xs = search.data?.notes ?? [];
    if (!excludeIds?.size) return xs;
    return xs.filter((n) => !excludeIds.has(n.id));
  }, [search.data?.notes, excludeIds]);

  const showPanel = debouncedQuery.length >= minSearchLength;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label htmlFor={`${p}note-search`}>Search note text</Label>
        <Input
          id={`${p}note-search`}
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Uses full-text search: words in any order, quoted phrases, natural queries — not exact field
          matching.
        </p>
      </div>

      {!showPanel ? (
        <p className="text-xs text-muted-foreground">
          Type at least {minSearchLength} characters to search.
        </p>
      ) : search.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          Searching…
        </div>
      ) : search.isError ? (
        <p className="text-sm text-destructive">
          {search.error instanceof Error ? search.error.message : "Search failed."}
        </p>
      ) : visibleNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes matched.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {visibleNotes.map((note) => {
            const preview = notePickerContentPreviewLines(note.content, 3, 180);
            const blocks = notePickerLinkedBlocks(note);
            const isSelected = selectedIds?.has(note.id) ?? false;

            return (
              <li
                key={note.id}
                className="rounded-lg border border-base-content/12 bg-base-100/60 p-3 shadow-sm"
              >
                <pre className="mb-2 max-h-28 overflow-hidden whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-base-content/90">
                  {preview || "(empty note)"}
                </pre>

                {blocks.length > 0 ? (
                  <div className="mb-2 space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-medium text-base-content/80">Linked to</p>
                    {blocks.map((b) => (
                      <div key={b.heading}>
                        <span className="font-medium text-muted-foreground">{b.heading}: </span>
                        <span>{b.lines.join("; ")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-2 text-xs italic text-muted-foreground">Not linked to records yet.</p>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isSelected}
                  onClick={() => onPick(note)}
                >
                  {isSelected ? "Added" : "Add note"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
