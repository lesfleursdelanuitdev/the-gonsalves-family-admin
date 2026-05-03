"use client";

/**
 * The Story Editor preview is a reference renderer. It provides a consistent default
 * interpretation of structured story data, but consuming websites may render the same data differently.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { generateHTML } from "@tiptap/core";
import type { Extensions, JSONContent } from "@tiptap/core";
import { cn } from "@/lib/utils";
import { createStoryTipTapExtensions } from "@/components/admin/story-creator/story-tiptap-extensions";
import { normalizeStoryDocContent } from "@/components/admin/story-creator/story-tiptap-doc";
import type { StoryBlock, StoryColumnNestedBlock, StoryContainerBlock, StoryDocument, StorySection } from "@/lib/admin/story-creator/story-types";
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
import "./story-reference-preview.css";

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

function containerPreviewClass(block: StoryContainerBlock): string {
  const p = block.props;
  const pad =
    p.padding === "none"
      ? "p-0"
      : p.padding === "sm"
        ? "p-2"
        : p.padding === "lg"
          ? "p-6"
          : "p-4";
  const border =
    p.border === "none"
      ? "border-transparent"
      : p.border === "dashed"
        ? "border border-dashed border-base-content/20"
        : "border border-base-content/12";
  const align = p.align === "center" ? "text-center" : p.align === "right" ? "text-right" : "text-left";
  const bg = p.background === "subtle" ? "bg-base-content/[0.04]" : "";
  return cn("rounded-xl", pad, border, align, bg);
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
        <div className="story-preview-cover story-preview-cover--loading flex items-center justify-center text-sm text-base-content/45">
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
  if (block.type === "richText") {
    return (
      <div
        className={cn(
          "story-preview-block-content story-tiptap prose prose-sm prose-invert max-w-none",
          "prose-headings:font-heading prose-p:my-2 prose-headings:my-3",
          "[&_.story-field--empty]:text-muted-foreground/45",
        )}
        dangerouslySetInnerHTML={{ __html: richHtml(block.doc) }}
      />
    );
  }
  if (block.type === "container") {
    const customBg =
      block.props.background === "custom" && block.props.customBackground
        ? { background: block.props.customBackground }
        : undefined;
    return (
      <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
        <div className={containerPreviewClass(block)} style={customBg}>
          {block.props.label ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{block.props.label}</p>
          ) : null}
          <div className="space-y-3">
            {block.children.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">Empty container</p>
            ) : (
              groupStoryBlocksForLayout(block.children).map((group) => {
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
              })
            )}
          </div>
        </div>
      </StoryBlockRowDesignWrap>
    );
  }
  if (block.type === "columns") {
    const cellClass =
      nestedDepth >= 2
        ? "flex min-h-[3rem] min-w-0 flex-col rounded-md border border-base-content/7 bg-base-200/15 p-2"
        : "flex min-h-[4rem] min-w-0 flex-col rounded-lg border border-base-content/10 bg-base-200/20 p-3";
    const layout = previewMobile ? ("stacked" as const) : ("two-column" as const);
    return (
      <div className="story-preview-columns grid min-w-0" style={storyColumnsGridStyle(block, layout)}>
        {block.columns.map((slot) => (
          <div key={slot.id} className={cellClass}>
            <div className="flex min-h-0 flex-1 flex-col" style={storyColumnStackStyle(slot)}>
              {slot.blocks.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Empty column</p>
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
    return (
      <StoryBlockRowDesignWrap block={block} floated={false} referencePreviewMobile={previewMobile}>
        <hr className="story-preview-divider" />
      </StoryBlockRowDesignWrap>
    );
  }
  if (block.type === "columns") {
    return <ColumnNestedBlockPreview block={block} nestedDepth={0} />;
  }
  if (block.type === "media") {
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
  const previewMobile = viewport === "mobile";

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
        <div
          className={cn(
            "story-preview flex min-h-0 flex-1 flex-col overflow-hidden",
            previewMobile ? "story-preview-mobile" : "story-preview-desktop",
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-base-content/10 bg-base-200/30 px-3 py-4 lg:block">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contents</p>
              <nav className="mt-3 space-y-0.5">
                <SectionTocList sections={doc.sections} depth={0} activeSectionId={activeSectionId} onPickSection={onPickSection} />
              </nav>
            </aside>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="story-preview-article-shell px-3 py-4 md:px-6 md:py-6">
                <div className="story-preview-toolbar">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Viewport</span>
                  <div className="inline-flex rounded-lg border border-base-content/12 bg-base-200/40 p-0.5">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        viewport === "desktop"
                          ? "bg-base-100 text-base-content shadow-sm"
                          : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
                      )}
                      onClick={() => setViewport("desktop")}
                    >
                      Desktop
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        viewport === "mobile"
                          ? "bg-base-100 text-base-content shadow-sm"
                          : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
                      )}
                      onClick={() => setViewport("mobile")}
                    >
                      Mobile
                    </button>
                  </div>
                </div>
                <article className="story-preview-article w-full min-w-0 pb-12">
                  <StoryPreviewCoverBanner doc={doc} />
                  <p className="mb-8 text-xs text-muted-foreground">
                    {doc.status === "published" ? "Published preview" : "Draft preview"}
                  </p>
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
              className={cn(
                "block w-full truncate rounded px-1.5 py-1 text-left text-xs transition-colors",
                active ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-base-content/[0.06] hover:text-foreground",
              )}
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
