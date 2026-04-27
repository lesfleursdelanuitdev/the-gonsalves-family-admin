"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedAlbum, StagedTag } from "@/components/admin/media-editor/media-editor-types";
import type { AdminAlbumListItem } from "@/hooks/useAdminAlbums";
import type { AdminTagListItem } from "@/hooks/useAdminTags";

export type MediaEditorOrganisationTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  stagedTags: StagedTag[];
  stagedAlbums: StagedAlbum[];
  submitting: boolean;
  onRemoveTag: (t: StagedTag) => void;
  onRemoveAlbum: (a: StagedAlbum) => void;
  tagQuery: string;
  setTagQuery: (v: string) => void;
  albumQuery: string;
  setAlbumQuery: (v: string) => void;
  createAlbumAsPublic: boolean;
  setCreateAlbumAsPublic: (v: boolean) => void;
  tagsLoading: boolean;
  albumsLoading: boolean;
  tagResults: AdminTagListItem[];
  albumResults: AdminAlbumListItem[];
  exactTagMatch: boolean;
  exactAlbumMatch: boolean;
  onPickTag: (t: AdminTagListItem) => void;
  onPickAlbum: (a: AdminAlbumListItem) => void;
  onCreateAndAddTag: () => void;
  onCreateAndAddAlbum: () => void;
};

export function MediaEditorOrganisationTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  stagedTags,
  stagedAlbums,
  submitting,
  onRemoveTag,
  onRemoveAlbum,
  tagQuery,
  setTagQuery,
  albumQuery,
  setAlbumQuery,
  createAlbumAsPublic,
  setCreateAlbumAsPublic,
  tagsLoading,
  albumsLoading,
  tagResults,
  albumResults,
  exactTagMatch,
  exactAlbumMatch,
  onPickTag,
  onPickAlbum,
  onCreateAndAddTag,
  onCreateAndAddAlbum,
}: MediaEditorOrganisationTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <div className="space-y-3">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {stagedTags.map((t) => (
            <MediaEditorPill
              key={t.tagId}
              label={displayTagName(t.name)}
              onRemove={() => void onRemoveTag(t)}
              disabled={submitting}
            />
          ))}
          {stagedTags.length === 0 ? (
            <span className="text-sm text-muted-foreground">No tags yet.</span>
          ) : null}
        </div>
        <div className="relative space-y-2">
          <Input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search tags or type a new name…"
            autoComplete="off"
          />
          {tagQuery.trim().length >= 1 ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
              {tagsLoading ? (
                <p className="px-3 py-2 text-muted-foreground">Searching…</p>
              ) : (
                <>
                  {tagResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200/80"
                      onClick={() => void onPickTag(t)}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color ?? "var(--color-base-content)" }}
                        aria-hidden
                      />
                      <span className="truncate">{displayTagName(t.name)}</span>
                      {t.isGlobal ? (
                        <span className="ml-auto text-xs text-muted-foreground">global</span>
                      ) : null}
                    </button>
                  ))}
                  {!exactTagMatch && tagQuery.trim() ? (
                    <button
                      type="button"
                      className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                      onClick={() => void onCreateAndAddTag()}
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
            <MediaEditorPill
              key={a.albumId}
              label={a.name}
              onRemove={() => void onRemoveAlbum(a)}
              disabled={submitting}
            />
          ))}
          {stagedAlbums.length === 0 ? (
            <span className="text-sm text-muted-foreground">No albums yet.</span>
          ) : null}
        </div>
        <div className="flex items-start gap-3 rounded-md border border-base-content/10 p-3">
          <Checkbox
            id={`${panelId}-album-public`}
            checked={createAlbumAsPublic}
            onCheckedChange={(v) => setCreateAlbumAsPublic(v === true)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor={`${panelId}-album-public`} className="cursor-pointer font-medium">
              Public album
            </Label>
            <p className="text-xs text-muted-foreground">
              Public names must be unique on your account. Leave unchecked for a personal album (duplicate names allowed).
            </p>
          </div>
        </div>
        <div className="relative space-y-2">
          <Input
            value={albumQuery}
            onChange={(e) => setAlbumQuery(e.target.value)}
            placeholder="Search your albums or type a new name…"
            autoComplete="off"
          />
          {albumQuery.trim().length >= 1 ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
              {albumsLoading ? (
                <p className="px-3 py-2 text-muted-foreground">Searching…</p>
              ) : (
                <>
                  {albumResults.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                      onClick={() => void onPickAlbum(a)}
                    >
                      {a.name}
                    </button>
                  ))}
                  {!exactAlbumMatch && albumQuery.trim() ? (
                    <button
                      type="button"
                      className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                      onClick={() => void onCreateAndAddAlbum()}
                    >
                      Create album “{albumQuery.trim()}”
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
