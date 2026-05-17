"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAdminAlbums, type AdminAlbumListItem } from "@/hooks/useAdminAlbums";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Input } from "@/components/ui/input";

export type SelectedAlbum = {
  id: string;
  name: string;
};

export function AlbumsPicker({
  selected,
  onAdd,
  onRemove,
  onCreate,
  disabled,
  placeholder = "Search albums…",
}: {
  selected: SelectedAlbum[];
  onAdd: (album: AdminAlbumListItem) => void;
  onRemove: (album: SelectedAlbum) => void;
  onCreate?: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const debouncedQ = useDebouncedValue(query.trim(), ADMIN_PICKER_DEBOUNCE_MS);

  const { data, isLoading } = useAdminAlbums(
    { q: debouncedQ, limit: 40 },
    { enabled: debouncedQ.length >= 1 },
  );

  const results = data?.albums ?? [];
  const selectedIds = new Set(selected.map((a) => a.id));
  const filteredResults = results.filter((a) => !selectedIds.has(a.id));
  const exactMatch = results.some(
    (a) => a.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const showDropdown = query.trim().length >= 1;
  const showCreate = onCreate && !exactMatch && query.trim().length >= 1;
  const showNoMatches = !isLoading && filteredResults.length === 0 && !showCreate;

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((album) => (
            <span
              key={album.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2.5 py-0.5 text-xs font-medium text-base-content"
            >
              <span className="truncate">{album.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-base-content/60 hover:bg-base-300/80 hover:text-base-content disabled:opacity-40"
                onClick={() => onRemove(album)}
                disabled={disabled}
                aria-label={`Remove ${album.name}`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
        />
        {showDropdown && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
            {isLoading ? (
              <p className="px-3 py-2 text-muted-foreground">Searching…</p>
            ) : (
              <>
                {filteredResults.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                    onClick={() => {
                      onAdd(a);
                      setQuery("");
                    }}
                  >
                    {a.name}
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                    onClick={() => {
                      onCreate!(query.trim());
                      setQuery("");
                    }}
                  >
                    Create album "{query.trim()}"
                  </button>
                )}
                {showNoMatches && (
                  <p className="px-3 py-2 text-muted-foreground">No albums found.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
