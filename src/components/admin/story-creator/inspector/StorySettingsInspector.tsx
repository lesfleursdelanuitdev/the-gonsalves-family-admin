"use client";

import { useCallback, useMemo, useState } from "react";
import type { StoryDocument, StoryDocumentMetaPatch, StoryDocumentKind } from "@/lib/admin/story-creator/story-types";
import { getStoryAuthorCredits } from "@/lib/admin/story-creator/story-author-display";
import { normalizeStorySlugInput, normalizeStorySlugInputLive, slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { fetchJson } from "@/lib/infra/api";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { cn } from "@/lib/utils";
import {
  FieldLabel,
  InspectorStoryAuthorsSection,
  InspectorStoryImagesSection,
  InspectorStoryLinkedRecords,
  StoryLinkedAlbumsField,
  STORY_KIND_OPTIONS,
  parseCommaTags,
  tagsToCommaInput,
} from "@/components/admin/story-creator/StoryCreatorInspector";

export function StorySettingsInspector({
  doc,
  storyId,
  onTitleChange,
  onExcerptChange,
  onStoryMetaChange,
  touchComfort,
}: {
  doc: StoryDocument;
  storyId: string;
  onTitleChange: (title: string) => void;
  onExcerptChange: (excerpt: string) => void;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  touchComfort?: boolean;
}) {
  const controlH = touchComfort ? "h-11 min-h-[44px]" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const kind = doc.kind ?? "story";
  const status = doc.status ?? "draft";
  const [slugError, setSlugError] = useState<string | null>(null);
  const publicOrigin =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PUBLIC_STORY_SITE_ORIGIN?.trim()) ||
    "https://gonsalves.family";

  const checkSlugAvailability = useCallback(
    async (slugOverride?: string) => {
      const slug = normalizeStorySlugInput(slugOverride ?? doc.slug ?? "");
      if (!slug) {
        setSlugError(null);
        return;
      }
      try {
        const res = await fetchJson<{ available: boolean }>(
          `/api/admin/stories/check-slug?slug=${encodeURIComponent(slug)}&excludeId=${encodeURIComponent(storyId)}`,
        );
        setSlugError(res.available ? null : "This URL slug is already taken. Try another.");
      } catch {
        setSlugError(null);
      }
    },
    [doc.slug, storyId],
  );

  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  const authorCredits = useMemo(() => getStoryAuthorCredits(doc), [doc]);
  const authorsSectionDefaultOpen = authorCredits.length > 0;
  const summaryDefaultOpen = Boolean((doc.excerpt ?? "").trim());
  const slugPreview = normalizeStorySlugInput(doc.slug ?? "");

  return (
    <div className="space-y-4">
      <CollapsibleFormSection title="Basic details" defaultOpen>
        <div>
          <FieldLabel>Title</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">Shown in the editor header, story list, and (when synced) the public page title.</p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
              controlH,
            )}
            value={doc.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Slug</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Lowercase letters, numbers, and hyphens. Spaces become hyphens; other characters are removed. Used on the public site at{" "}
            <span className="font-medium text-base-content/70">/stories/your-slug</span>.
          </p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
              controlH,
              slugError ? "border-error/60" : "",
            )}
            placeholder="e.g. the-gonsalves-of-berbice"
            value={doc.slug ?? ""}
            onChange={(e) => {
              const live = normalizeStorySlugInputLive(e.target.value);
              if (!live.length) {
                const auto = !doc.title.trim()
                  ? ""
                  : normalizeStorySlugInput(slugifyStoryTitle(doc.title));
                onStoryMetaChange({
                  slug: auto.length ? auto : undefined,
                  slugManuallyEdited: false,
                });
              } else {
                onStoryMetaChange({ slug: live, slugManuallyEdited: true });
              }
              if (slugError) setSlugError(null);
            }}
            onBlur={() => {
              const raw = doc.slug ?? "";
              const committed = normalizeStorySlugInput(raw);
              if (committed !== raw) {
                onStoryMetaChange({ slug: committed.length ? committed : undefined });
              }
              void checkSlugAvailability(committed);
            }}
            spellCheck={false}
            aria-invalid={Boolean(slugError)}
          />
          {slugError ? <p className="mt-1.5 text-xs font-medium text-error">{slugError}</p> : null}
        </div>
        <div className="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">Public URL preview</p>
          <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-base-content/70">
            {publicOrigin.replace(/\/$/, "")}/stories/{slugPreview.length > 0 ? slugPreview : "…"}
          </p>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Authors" defaultOpen={authorsSectionDefaultOpen}>
        <InspectorStoryAuthorsSection
          doc={doc}
          controlH={controlH}
          authorPrefixOptionClass={(active) =>
            cn(
              "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
              touchComfort ? "min-h-[52px]" : "min-h-0",
              active
                ? "border-primary/45 bg-primary/15 shadow-sm ring-1 ring-primary/15"
                : "border-base-content/12 bg-base-100/70 hover:border-base-content/20",
            )
          }
          onStoryMetaChange={onStoryMetaChange}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Summary" defaultOpen={summaryDefaultOpen}>
        <div>
          <FieldLabel>Subtitle / short description</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Optional teaser for cards, search, and social previews. Keep it one or two sentences.
          </p>
          <textarea
            className="textarea textarea-bordered textarea-sm min-h-[88px] w-full resize-y rounded-lg border-base-content/12 bg-base-100 text-sm leading-relaxed text-base-content placeholder:text-base-content/45"
            placeholder="e.g. How the family came to California…"
            value={doc.excerpt ?? ""}
            onChange={(e) => onExcerptChange(e.target.value)}
          />
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Publishing state" defaultOpen={false}>
        <div>
          <FieldLabel>Status</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Draft vs published is stored on the document. Use <span className="font-medium text-base-content/75">Save draft</span> or{" "}
            <span className="font-medium text-base-content/75">Publish</span> in the toolbar to write changes to local storage.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chipBtn(status === "draft")} onClick={() => onStoryMetaChange({ status: "draft" })}>
              Draft
            </button>
            <button
              type="button"
              className={chipBtn(status === "published")}
              onClick={() => onStoryMetaChange({ status: "published" })}
            >
              Published
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Visibility</p>
          <p className="mt-1 text-xs leading-relaxed text-base-content/60">
            Stories live in this admin app and your browser storage until a public API exists. Both draft and published
            remain private to your account here.
          </p>
        </div>
        <div>
          <FieldLabel>Content type</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Drives how the piece is labeled for listings and URLs when synced (
            <code className="rounded bg-base-200/80 px-1 py-0.5 text-[10px]">StoryKind</code>).
          </p>
          <div className="flex flex-wrap gap-2">
            {STORY_KIND_OPTIONS.map((opt) => {
              const active = kind === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.hint}
                  onClick={() => onStoryMetaChange({ kind: opt.value as StoryDocumentKind })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    touchComfort ? "min-h-[44px] min-w-[5.5rem]" : "min-h-9",
                    active
                      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                      : "border-base-content/12 bg-base-100/70 text-base-content/75 hover:border-base-content/20",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleFormSection>

      <InspectorStoryImagesSection doc={doc} storyId={storyId} onStoryMetaChange={onStoryMetaChange} touchComfort={touchComfort} />

      <CollapsibleFormSection title="Story context" defaultOpen>
        <InspectorStoryLinkedRecords
          doc={doc}
          storyId={storyId}
          onStoryMetaChange={onStoryMetaChange}
          touchComfort={touchComfort}
          embedded
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Organization" defaultOpen={false}>
        <div>
          <FieldLabel>Tags</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">Comma-separated keywords for your own organization and future search.</p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
              controlH,
            )}
            placeholder="e.g. immigration, civil-war"
            value={tagsToCommaInput(doc.tags)}
            onChange={(e) => onStoryMetaChange({ tags: parseCommaTags(e.target.value) })}
          />
          <p className="mt-1.5 text-xs text-base-content/50">
            Persists on this draft; maps to <code className="rounded bg-base-200/70 px-1 text-[10px]">stories.tags</code> /{" "}
            <code className="rounded bg-base-200/70 px-1 text-[10px]">story_tags</code> when the API is wired.
          </p>
        </div>
        <StoryLinkedAlbumsField
          linkedAlbums={doc.linkedAlbums ?? []}
          onStoryMetaChange={onStoryMetaChange}
          panelId={`story-albums-${storyId}`}
          touchComfort={touchComfort}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <div>
          <FieldLabel>Story ID</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Stable identifier in local storage and future sync.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={doc.id}
          />
        </div>
        <div>
          <FieldLabel>Document format</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Schema version for migrations when the editor format changes.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={`version ${doc.version}`}
          />
        </div>
        <div>
          <FieldLabel>Last updated (on document)</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Refreshed when you save draft or publish to local storage.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={doc.updatedAt}
          />
        </div>
        <p className="text-xs leading-relaxed text-base-content/50">
          Import and server-side migration notes will appear here when available. Until then, use the{" "}
          <span className="font-medium text-base-content/65">Debug</span> tab to inspect raw JSON.
        </p>
      </CollapsibleFormSection>
    </div>
  );
}

