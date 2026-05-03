"use client";

/**
 * The Story Editor preview is a reference renderer. It provides a consistent default
 * interpretation of structured story data, but consuming websites may render the same data differently.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { generateHTML } from "@tiptap/core";
import type { Extensions, JSONContent } from "@tiptap/core";
import { cn } from "@/lib/utils";
import { createStoryTipTapExtensions } from "@/components/admin/story-creator/story-tiptap-extensions";
import { normalizeStoryDocContent } from "@/components/admin/story-creator/story-tiptap-doc";
import type {
  StoryBlock,
  StoryColumnNestedBlock,
  StoryContainerBlock,
  StoryDocument,
  StoryRichTextBlock,
  StorySection,
} from "@/lib/admin/story-creator/story-types";
import { getStoryDividerPreset, getStoryRichTextPreset } from "@/lib/admin/story-creator/story-types";
import { storyColumnStackStyle, storyColumnsGridStyle } from "@/lib/admin/story-creator/story-columns-layout";
import { EmbedBlockContentRenderer } from "@/components/admin/story-creator/story-block-embed-content";
import { MediaBlockContentRenderer } from "@/components/admin/story-creator/story-block-media-content";
import { StoryBlockRowDesignWrap } from "@/components/admin/story-creator/StoryBlockDesignWrap";
import { groupColumnNestedBlocksForLayout, groupStoryBlocksForLayout } from "@/lib/admin/story-creator/story-block-layout";
import { formatStoryAuthorLine } from "@/lib/admin/story-creator/story-author-display";
import { resolveStoryField } from "@/lib/admin/story-creator/story-field-resolve";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { mediaThumbSrc, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import type { StoryMediaDetail } from "@/hooks/useStoryMediaById";
import { useStoryMediaById } from "@/hooks/useStoryMediaById";
import { resolveStoryImages, storyCoverAndProfileAreSameRef } from "@/lib/admin/story-creator/story-images-resolve";
import {
  getContainerCustomBackgroundStyle,
  getContainerClasses,
} from "@/lib/admin/story-creator/story-container-preset-styles";
import "./story-reference-preview.css";
import "./story-preview-themes.css";

const PREVIEW_THEME_LS = "story-creator-preview-theme";
const PREVIEW_TOC_LS = "story-creator-preview-toc-open";

export type StoryPreviewReadingTheme = "light" | "dark";

function readStoredPreviewTheme(): StoryPreviewReadingTheme {
  if (typeof window === "undefined") return "light";
  const raw = localStorage.getItem(PREVIEW_THEME_LS);
  if (raw === "dark" || raw === "light") return raw;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readStoredTocOpen(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(PREVIEW_TOC_LS);
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
}

const StoryPreviewReadingThemeContext = createContext<StoryPreviewReadingTheme>("light");

export function useStoryPreviewReadingTheme(): StoryPreviewReadingTheme {
  return useContext(StoryPreviewReadingThemeContext);
}

function previewBlockProseClass(theme: StoryPreviewReadingTheme) {
  return cn(
    "story-preview-block-content story-tiptap prose prose-sm max-w-none",
    "prose-headings:font-heading prose-p:my-2 prose-headings:my-3",
    theme === "dark"
      ? "prose-invert"
      : "prose-neutral text-neutral-800 prose-headings:text-neutral-900 prose-strong:text-neutral-900",
  );
}

function storyPreviewThumbFromDetail(data: StoryMediaDetail | undefined, width: number): string | null {
  const fileRef = data?.fileRef?.trim() ? data.fileRef : "";
  if (fileRef === "") return null;
  return mediaThumbSrc(fileRef, data?.form ?? null, width) ?? resolveMediaImageSrc(fileRef);
}

const StoryPreviewRichHtmlContext = createContext<(json: unknown) => string>(() => "");

const StoryPreviewMobileContext = createContext(false);

function StoryPreviewRichHtmlProvider({ value, children }: { value: (json: unknown) => string; children: ReactNode }) {
  return <StoryPreviewRichHtmlContext.Provider value={value}>{children}</StoryPreviewRichHtmlContext.Provider>;
}

function StoryPreviewMobileProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <StoryPreviewMobileContext.Provider value={value}>{children}</StoryPreviewMobileContext.Provider>;
}

function useStoryPreviewRichHtml() {
  return useContext(StoryPreviewRichHtmlContext);
}

function useStoryPreviewMobile() {
  return useContext(StoryPreviewMobileContext);
}

function storyRichTextPresetPreviewClass(block: StoryRichTextBlock): string {
  const preset = getStoryRichTextPreset(block);
  return cn(
    preset === "verse" && "whitespace-pre-wrap font-serif text-[0.95rem] leading-[1.75]",
    preset === "heading" && "text-2xl font-bold tracking-tight",
    preset === "quote" &&
      ((block.quoteStyle ?? "simple") === "card"
        ? "rounded-lg border border-base-content/10 bg-base-content/[0.04] p-4"
        : "border-l-4 border-base-content/30 pl-4 italic"),
    preset === "list" && "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
  );
}

function StoryPreviewCoverBanner({ doc }: { doc: StoryDocument }) {
  const { cover, profile } = resolveStoryImages(doc);
  const sameRef = storyCoverAndProfileAreSameRef(doc);
  const coverId = cover?.mediaId;
  const profileLoadId = profile && !sameRef ? profile.mediaId : undefined;

  const { data: coverData, isLoading: coverLoading } = useStoryMediaById(coverId);
  const { data: profileData, isLoading: profileLoading } = useStoryMediaById(profileLoadId);

  const coverThumb = storyPreviewThumbFromDetail(coverData, 960);
  const profileThumb = storyPreviewThumbFromDetail(profileData, 320);

  const hasCoverVisual = Boolean(coverId && coverThumb);
  const showCoverSkeleton = Boolean(coverId && !coverThumb && coverLoading);
  const showAvatar = Boolean(profileLoadId && !sameRef);
  const avatarReady = Boolean(profileThumb);
  const avatarPending = Boolean(showAvatar && profileLoading && !profileThumb);
  const headerBodyOverlap = Boolean(showAvatar && (avatarReady || avatarPending));

  const authorLine = formatStoryAuthorLine(doc);
  const excerpt = (doc.excerpt ?? "").trim();

  return (
    <header className="story-preview-header">
      {hasCoverVisual ? (
        <div className="story-preview-cover">
          <div className="story-preview-cover-inner">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin library preview */}
            <img src={coverThumb!} alt="" className="story-preview-cover-img" decoding="async" />
            <div className="story-preview-cover-overlay" aria-hidden />
            {showAvatar ? (
              <div className="story-preview-profile">
                {avatarReady ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin library preview
                  <img src={profileThumb!} alt="" className="story-preview-profile-img" decoding="async" />
                ) : avatarPending ? (
                  <div className="story-preview-profile-skeleton" aria-hidden />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : showCoverSkeleton ? (
        <div className="story-preview-cover story-preview-cover--loading preview-toolbar-tools flex items-center justify-center text-sm">
          Loading cover…
        </div>
      ) : null}
      <div className={cn("story-preview-header-body", headerBodyOverlap && "story-preview-header-body--with-profile")}>
        <h1 className="story-preview-title">{doc.title || "Untitled story"}</h1>
        {excerpt ? <p className="story-preview-subtitle">{excerpt}</p> : null}
        {authorLine ? <p className="story-preview-author whitespace-pre-line">{authorLine}</p> : null}
      </div>
    </header>
  );
}

function StoryMetadataFooter({ doc }: { doc: StoryDocument }) {
  const links = doc.linkedRecords ?? [];
  const places = doc.placeLinks ?? [];
  const people = links.filter((l): l is SelectedNoteLink => l.kind === "individual");
  const events = links.filter((l): l is SelectedNoteLink => l.kind === "event");
  const families = links.filter((l): l is SelectedNoteLink => l.kind === "family");
  if (people.length === 0 && events.length === 0 && families.length === 0 && places.length === 0) return null;

  return (
    <footer className="story-metadata-footer" aria-label="Linked records">
      {people.length > 0 ? (
        <section className="story-metadata-group">
          <h3>People featured</h3>
          <ul>
            {people.map((p) => (
              <li key={`${p.kind}-${p.id}`}>{p.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {events.length > 0 ? (
        <section className="story-metadata-group">
          <h3>Events</h3>
          <ul>
            {events.map((p) => (
              <li key={`${p.kind}-${p.id}`}>{p.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {families.length > 0 ? (
        <section className="story-metadata-group">
          <h3>Families</h3>
          <ul>
            {families.map((p) => (
              <li key={`${p.kind}-${p.id}`}>{p.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {places.length > 0 ? (
        <section className="story-metadata-group">
          <h3>Places</h3>
          <ul>
            {places.map((pl) => (
              <li key={`place-${pl.id}`}>
                {pl.label}
                {pl.original && pl.original !== pl.label ? (
                  <span className="block text-[11px] text-base-content/50">{pl.original}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </footer>
  );
}

function ColumnNestedBlockPreview({ block, nestedDepth }: { block: StoryColumnNestedBlock; nestedDepth: number }) {
  const richHtml = useStoryPreviewRichHtml();
  const previewMobile = useStoryPreviewMobile();
  const readingTheme = useStoryPreviewReadingTheme();
  const proseClass = previewBlockProseClass(readingTheme);
  if (block.type === "richText") {
    const preset = getStoryRichTextPreset(block);
    return (
      <div className={cn("min-w-0", storyRichTextPresetPreviewClass(block))}>
        <div className={cn(proseClass)} dangerouslySetInnerHTML={{ __html: richHtml(block.doc) }} />
        {preset === "quote" && block.quoteAttribution?.trim() ? (
          <p className="story-preview-statusline mt-2 text-right text-xs font-medium">— {block.quoteAttribution.trim()}</p>
        ) : null}
      </div>
    );
  }
  if (block.type === "container") {
    const shellStyle = getContainerCustomBackgroundStyle(block.props);
    return (
      <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
        <div className={getContainerClasses(block, "preview")} style={shellStyle ?? undefined}>
          {block.children.length === 0 ? null : (
            <div className="space-y-3">
              {groupStoryBlocksForLayout(block.children).map((group) => {
                if (group.kind === "float-wrap") {
                  return (
                    <div key={`${group.float.id}-${group.text.id}`} className="flow-root min-w-0">
                      <StoryBlockRowDesignWrap block={group.float} floated referencePreviewMobile={previewMobile}>
                        <BlockPreview block={group.float} />
                      </StoryBlockRowDesignWrap>
                      <StoryBlockRowDesignWrap block={group.text} floated={false} wrapperClassName="min-w-0" referencePreviewMobile={previewMobile}>
                        <BlockPreview block={group.text} />
                      </StoryBlockRowDesignWrap>
                    </div>
                  );
                }
                return (
                  <StoryBlockRowDesignWrap key={group.block.id} block={group.block} floated={false} referencePreviewMobile={previewMobile}>
                    <BlockPreview block={group.block} />
                  </StoryBlockRowDesignWrap>
                );
              })}
            </div>
          )}
        </div>
      </StoryBlockRowDesignWrap>
    );
  }
  if (block.type === "columns") {
    const cellClass =
      nestedDepth >= 2
        ? "flex min-h-[3rem] min-w-0 flex-col rounded-md border border-solid border-[color:var(--story-subtle-border)] bg-base-200/15 p-2"
        : "flex min-h-[4rem] min-w-0 flex-col rounded-lg border border-solid border-[color:var(--story-subtle-border)] bg-base-200/20 p-3";
    const layout = previewMobile ? ("stacked" as const) : ("two-column" as const);
    return (
      <div className="story-preview-columns grid min-w-0" style={storyColumnsGridStyle(block, layout)}>
        {block.columns.map((slot) => (
          <div key={slot.id} className={cellClass}>
            <div className="flex min-h-0 flex-1 flex-col" style={storyColumnStackStyle(slot)}>
              {slot.blocks.length === 0 ? (
                <p className="preview-empty-hint rounded-md px-2 py-3 text-center text-xs">Empty column</p>
              ) : (
                groupColumnNestedBlocksForLayout(slot.blocks).map((grp) => {
                  if (grp.kind === "float-wrap") {
                    return (
                      <div key={`${grp.float.id}-${grp.text.id}`} className="flow-root min-w-0">
                        <StoryBlockRowDesignWrap block={grp.float as StoryBlock} floated referencePreviewMobile={previewMobile}>
                          <ColumnNestedBlockPreview block={grp.float} nestedDepth={nestedDepth + 1} />
                        </StoryBlockRowDesignWrap>
                        <StoryBlockRowDesignWrap
                          block={grp.text as StoryBlock}
                          floated={false}
                          wrapperClassName="min-w-0"
                          referencePreviewMobile={previewMobile}
                        >
                          <ColumnNestedBlockPreview block={grp.text} nestedDepth={nestedDepth + 1} />
                        </StoryBlockRowDesignWrap>
                      </div>
                    );
                  }
                  return (
                    <StoryBlockRowDesignWrap
                      key={grp.block.id}
                      block={grp.block as StoryBlock}
                      floated={false}
                      wrapperClassName="min-w-0"
                      referencePreviewMobile={previewMobile}
                    >
                      <ColumnNestedBlockPreview block={grp.block} nestedDepth={nestedDepth + 1} />
                    </StoryBlockRowDesignWrap>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "table") {
    const rows = block.cells ?? [];
    const hasHeader = block.hasHeaderRow ?? false;
    return (
      <div className="story-preview-table-outer overflow-x-auto rounded-lg border border-solid border-[color:var(--story-subtle-border)] p-3 text-sm">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={cn(hasHeader && ri === 0 && "bg-base-300/40 font-medium")}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-base-content/10 px-2 py-1">
                    {cell?.trim() ? cell : "\u00a0"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "splitContent") {
    const textPreset = getStoryRichTextPreset(block.text);
    const textCol = (
      <div className={cn("min-w-0 flex-1", storyRichTextPresetPreviewClass(block.text))}>
        <div className={cn(proseClass)} dangerouslySetInnerHTML={{ __html: richHtml(block.text.doc) }} />
        {textPreset === "quote" && block.text.quoteAttribution?.trim() ? (
          <p className="story-preview-statusline mt-2 text-right text-xs font-medium">— {block.text.quoteAttribution.trim()}</p>
        ) : null}
      </div>
    );
    const rail = (
      <div className="preview-split-rail mt-4 w-full shrink-0 space-y-3 rounded-lg border border-solid border-[color:var(--story-subtle-border)] p-3 md:mt-0 md:w-[min(38%,320px)]">
        {block.supporting.blocks.length === 0 ? (
          <p className="preview-empty-hint rounded-md px-2 py-3 text-center text-xs">Supporting area</p>
        ) : (
          block.supporting.blocks.map((sb) => <ColumnNestedBlockPreview key={sb.id} block={sb} nestedDepth={nestedDepth + 1} />)
        )}
      </div>
    );
    if (block.supportingSide === "left") {
      return (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {rail}
          {textCol}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {textCol}
        {rail}
      </div>
    );
  }
  if (block.type === "media") {
    return <MediaBlockContentRenderer block={block} variant="preview" />;
  }
  if (block.type !== "embed") return null;
  return <EmbedBlockContentRenderer block={block} variant="preview" />;
}

function SectionBlocksPreview({ blocks }: { blocks: StoryBlock[] }) {
  const previewMobile = useStoryPreviewMobile();
  return (
    <div className="story-preview-section-body space-y-6">
      {groupStoryBlocksForLayout(blocks).map((group) => {
        if (group.kind === "float-wrap") {
          return (
            <div key={`${group.float.id}-${group.text.id}`} className="flow-root min-w-0">
              <StoryBlockRowDesignWrap block={group.float} floated referencePreviewMobile={previewMobile}>
                <BlockPreview block={group.float} />
              </StoryBlockRowDesignWrap>
              <StoryBlockRowDesignWrap block={group.text} floated={false} wrapperClassName="min-w-0" referencePreviewMobile={previewMobile}>
                <BlockPreview block={group.text} />
              </StoryBlockRowDesignWrap>
            </div>
          );
        }
        return (
          <StoryBlockRowDesignWrap key={group.block.id} block={group.block} floated={false} referencePreviewMobile={previewMobile}>
            <BlockPreview block={group.block} />
          </StoryBlockRowDesignWrap>
        );
      })}
    </div>
  );
}

function SectionTreePreview({ section, depth }: { section: StorySection; depth: number }) {
  const hasBlocks = section.blocks.length > 0;
  const hasKids = (section.children?.length ?? 0) > 0;
  const titleEl =
    depth === 0 ? (
      <h2 className="story-preview-section-title">{section.title}</h2>
    ) : (
      <h3 className="story-preview-subsection-title">{section.title}</h3>
    );
  return (
    <div id={`story-sec-${section.id}`} className={cn("story-preview-section", depth > 0 && "mt-10")}>
      {titleEl}
      {hasBlocks ? <SectionBlocksPreview blocks={section.blocks} /> : null}
      {hasKids ? (
        <div className={cn(hasBlocks && "mt-8", "space-y-8")}>
          {section.children!.map((ch) => (
            <SectionTreePreview key={ch.id} section={ch} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BlockPreview({ block }: { block: StoryBlock }) {
  const previewMobile = useStoryPreviewMobile();
  if (block.type === "richText") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type === "container") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type === "divider") {
    const pr = getStoryDividerPreset(block);
    const thickness = Math.min(6, Math.max(1, block.dividerThicknessPx ?? 1));
    if (pr === "spacer") {
      return (
        <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
          <div style={{ minHeight: `${block.spacerRem ?? 2}rem` }} aria-hidden />
        </StoryBlockRowDesignWrap>
      );
    }
    if (pr === "ornamental") {
      return (
        <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
          <div className="flex items-center justify-center gap-3 py-4" aria-hidden>
            <div className="h-px min-w-[2rem] flex-1 max-w-[5rem] bg-gradient-to-r from-transparent to-muted-foreground/35" style={{ height: thickness }} />
            <span className="text-muted-foreground/40">◇</span>
            <div className="h-px min-w-[2rem] flex-1 max-w-[5rem] bg-gradient-to-l from-transparent to-muted-foreground/35" style={{ height: thickness }} />
          </div>
        </StoryBlockRowDesignWrap>
      );
    }
    if (pr === "sectionBreak") {
      return (
        <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
          <div className="space-y-3 py-8" aria-hidden>
            <div className="h-px w-full bg-muted-foreground/25" style={{ height: thickness }} />
            <div className="h-px w-full bg-muted-foreground/15" />
          </div>
        </StoryBlockRowDesignWrap>
      );
    }
    return (
      <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
        <hr className="story-preview-divider" style={{ borderTopWidth: thickness }} />
      </StoryBlockRowDesignWrap>
    );
  }
  if (block.type === "columns") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type === "media") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type === "table" || block.type === "splitContent") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type !== "embed") return null;
  return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
}

export type StoryPreviewViewport = "desktop" | "mobile";

export function StoryCreatorPreview({
  doc,
  activeSectionId,
  onPickSection,
}: {
  doc: StoryDocument;
  activeSectionId: string | null;
  onPickSection: (sectionId: string) => void;
}) {
  const [viewport, setViewport] = useState<StoryPreviewViewport>("desktop");
  const [previewTheme, setPreviewTheme] = useState<StoryPreviewReadingTheme>("light");
  const [tocOpen, setTocOpen] = useState(true);
  const previewMobile = viewport === "mobile";

  useEffect(() => {
    setPreviewTheme(readStoredPreviewTheme());
    setTocOpen(readStoredTocOpen());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_THEME_LS, previewTheme);
    } catch {
      /* ignore quota */
    }
  }, [previewTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_TOC_LS, tocOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [tocOpen]);

  const previewTipTapExtensions = useMemo(
    () =>
      createStoryTipTapExtensions(null, {
        storyFieldHtml: (field) => resolveStoryField(field, doc),
      }) as Extensions,
    [doc],
  );

  const previewRichHtml = useCallback(
    (tiptapDoc: unknown) => {
      try {
        return generateHTML(normalizeStoryDocContent(tiptapDoc) as JSONContent, previewTipTapExtensions);
      } catch {
        return "";
      }
    },
    [previewTipTapExtensions],
  );

  return (
    <StoryPreviewRichHtmlProvider value={previewRichHtml}>
      <StoryPreviewMobileProvider value={previewMobile}>
        <StoryPreviewReadingThemeContext.Provider value={previewTheme}>
          <div
            className={cn(
              "preview-root story-preview flex min-h-0 flex-1 flex-col overflow-hidden",
              previewTheme === "light" ? "theme-light" : "theme-dark",
              previewMobile ? "story-preview-mobile" : "story-preview-desktop",
            )}
          >
            <div className="preview-background flex min-h-0 flex-1 flex-col">
              <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <div
                  className={cn(
                    "preview-sidebar-rail shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
                    tocOpen ? "w-56" : "w-0",
                  )}
                  aria-hidden={!tocOpen}
                >
                  <div className="preview-sidebar-surface flex h-full min-h-0 w-56 flex-col border-r">
                    <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-4">
                      <p className="preview-sidebar-label">Contents</p>
                      <button
                        type="button"
                        className="preview-toc-collapse-btn size-8 shrink-0 rounded-lg"
                        title="Hide contents"
                        aria-label="Hide contents panel"
                        onClick={() => setTocOpen(false)}
                      >
                        <ChevronLeft className="mx-auto size-4" strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                    <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
                      <SectionTocList sections={doc.sections} depth={0} activeSectionId={activeSectionId} onPickSection={onPickSection} />
                    </nav>
                  </div>
                </div>

                {!tocOpen ? (
                  <button
                    type="button"
                    className="preview-toc-reopen-tab"
                    title="Show contents"
                    aria-label="Open contents panel"
                    onClick={() => setTocOpen(true)}
                  >
                    <ChevronRight className="mx-auto size-4" strokeWidth={2.25} aria-hidden />
                  </button>
                ) : null}

                <div className="preview-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
                  <div className="story-preview-article-shell px-3 py-4 md:px-6 md:py-6">
                    <div className="story-preview-toolbar">
                      <div className="preview-toolbar-cluster">
                        <span className="preview-segment-label">Viewport</span>
                        <div className="preview-segment-track" role="group" aria-label="Preview viewport">
                          <button
                            type="button"
                            className={cn("preview-segment-btn", viewport === "desktop" && "preview-segment-btn--active")}
                            aria-pressed={viewport === "desktop"}
                            onClick={() => setViewport("desktop")}
                          >
                            Desktop
                          </button>
                          <button
                            type="button"
                            className={cn("preview-segment-btn", viewport === "mobile" && "preview-segment-btn--active")}
                            aria-pressed={viewport === "mobile"}
                            onClick={() => setViewport("mobile")}
                          >
                            Mobile
                          </button>
                        </div>
                      </div>
                      <div className="preview-toolbar-cluster">
                        <span className="preview-segment-label">Theme</span>
                        <div className="preview-segment-track" role="group" aria-label="Preview theme">
                          <button
                            type="button"
                            className={cn(
                              "preview-segment-btn inline-flex items-center gap-1.5",
                              previewTheme === "light" && "preview-segment-btn--active",
                            )}
                            aria-pressed={previewTheme === "light"}
                            onClick={() => setPreviewTheme("light")}
                          >
                            <Sun className="size-3.5 shrink-0 opacity-90" aria-hidden />
                            Light
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "preview-segment-btn inline-flex items-center gap-1.5",
                              previewTheme === "dark" && "preview-segment-btn--active",
                            )}
                            aria-pressed={previewTheme === "dark"}
                            onClick={() => setPreviewTheme("dark")}
                          >
                            <Moon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                            Dark
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="story-canvas">
                      <article className="story-preview-article w-full min-w-0 pb-12">
                        <StoryPreviewCoverBanner doc={doc} />
                        <div className="space-y-12">
                          {doc.sections.map((sec) => (
                            <section key={sec.id} className="scroll-mt-20">
                              <SectionTreePreview section={sec} depth={0} />
                            </section>
                          ))}
                        </div>
                        <StoryMetadataFooter doc={doc} />
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StoryPreviewReadingThemeContext.Provider>
      </StoryPreviewMobileProvider>
    </StoryPreviewRichHtmlProvider>
  );
}

function SectionTocList({
  sections,
  depth,
  activeSectionId,
  onPickSection,
}: {
  sections: StorySection[];
  depth: number;
  activeSectionId: string | null;
  onPickSection: (id: string) => void;
}) {
  return (
    <ul className={cn("space-y-0.5", depth > 0 && "mt-0.5 border-l border-base-content/10 pl-2")}>
      {sections.map((sec) => {
        const active = activeSectionId === sec.id;
        return (
          <li key={sec.id}>
            <button
              type="button"
              onClick={() => {
                onPickSection(sec.id);
                const el = document.getElementById(`story-sec-${sec.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn("preview-sidebar-item truncate", active && "preview-sidebar-item--active font-medium")}
            >
              {sec.title}
            </button>
            {(sec.children?.length ?? 0) > 0 ? (
              <SectionTocList sections={sec.children!} depth={depth + 1} activeSectionId={activeSectionId} onPickSection={onPickSection} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
