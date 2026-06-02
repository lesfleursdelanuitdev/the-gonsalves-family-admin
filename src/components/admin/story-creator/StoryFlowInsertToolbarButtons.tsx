"use client";

import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  CalendarDays,
  ChevronDown,
  ImageIcon,
  Images,
  MapPin,
  Network,
  UtensilsCrossed,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPortal,
  DialogPopup,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { MediaPickerModal } from "@/components/admin/media-picker/MediaPickerModal";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import { ToolbarButton } from "@/components/admin/story-creator/story-tiptap-editor-toolbar";
import { useStoryTipTapStoryDoc } from "@/components/admin/story-creator/story-tiptap-story-doc-context";
import { useToolbarDialogOpen } from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import {
  STORY_FLOW_EMBED_KINDS,
  defaultStoryFlowEmbedData,
  normalizeStoryFlowEmbedAttrs,
  normalizeStoryFlowMediaAttrs,
} from "@/lib/admin/story-creator/story-flow-nodes";
import type {
  StoryFlowAlign,
  StoryFlowDisplayMode,
  StoryFlowEmbedKind,
  StoryFlowMediaAttrs,
  StoryFlowSize,
} from "@/lib/admin/story-creator/story-types";
import { cn } from "@/lib/utils";

// ── Embed kind metadata ───────────────────────────────────────────────────────

type EmbedKindMeta = { label: string; Icon: LucideIcon };

const EMBED_KIND_META: Record<StoryFlowEmbedKind, EmbedKindMeta> = {
  timeline:        { label: "Timeline",    Icon: Activity },
  tree:            { label: "Family Tree", Icon: Network },
  gallery:         { label: "Gallery",     Icon: Images },
  map:             { label: "Map",         Icon: MapPin },
  personSpotlight: { label: "Person",      Icon: User },
  familyGroup:     { label: "Family",      Icon: Users },
  event:           { label: "Event",       Icon: CalendarDays },
  recipe:          { label: "Recipe",      Icon: UtensilsCrossed },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferMediaType(item: AdminMediaListItem): StoryFlowMediaAttrs["mediaType"] {
  const form = (item.form ?? "").toLowerCase();
  const ref = (item.fileRef ?? "").toLowerCase();
  if (form.includes("video") || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(ref)) return "video";
  if (form.includes("audio") || /\.(mp3|m4a|wav|ogg|flac)(\?|#|$)/i.test(ref)) return "audio";
  if (form.includes("pdf") || form.includes("document") || /\.(pdf|docx?|txt)(\?|#|$)/i.test(ref)) return "document";
  return "image";
}

function chipCls(active: boolean, disabled?: boolean) {
  return cn(
    "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
    disabled
      ? "cursor-not-allowed border-base-content/6 text-base-content/25"
      : active
        ? "border-primary/40 bg-primary/15 text-primary"
        : "border-base-content/10 bg-base-100/70 text-base-content/55 hover:border-base-content/20 hover:text-base-content",
  );
}

function iconBtnCls(active: boolean, disabled?: boolean) {
  return cn(
    "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
    disabled
      ? "cursor-not-allowed border-base-content/6 text-base-content/25"
      : active
        ? "border-primary/40 bg-primary/15 text-primary"
        : "border-base-content/10 bg-base-100/70 text-base-content/55 hover:border-base-content/20 hover:text-base-content",
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EmbedKindCard({
  meta,
  selected,
  onClick,
}: {
  meta: EmbedKindMeta;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-150",
        selected
          ? "border-primary/40 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
          : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/20 hover:bg-base-200/30 hover:text-base-content",
      )}
    >
      <meta.Icon className="size-[18px] shrink-0" />
      <span className="text-[11px] font-semibold leading-tight">{meta.label}</span>
    </button>
  );
}

function FlowLayoutControls({
  displayMode,
  align,
  size,
  onChange,
}: {
  displayMode: StoryFlowDisplayMode;
  align: StoryFlowAlign;
  size: StoryFlowSize;
  onChange: (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => void;
}) {
  const isFloat = displayMode === "wrapped";
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">Layout</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Display mode */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 text-[11px] text-base-content/45">Display</span>
          <div className="flex gap-1">
            <button type="button" title="Block — stacks in the page flow" className={chipCls(!isFloat)} onClick={() => onChange({ displayMode: "block" })}>
              Block
            </button>
            <button type="button" title="Float — text wraps around it" className={chipCls(isFloat)} onClick={() => onChange({ displayMode: "wrapped" })}>
              Float
            </button>
          </div>
        </div>
        {/* Alignment */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 text-[11px] text-base-content/45">Align</span>
          <div className="flex gap-1">
            <button type="button" title="Left" className={iconBtnCls(align === "left")} onClick={() => onChange({ align: "left" })}>
              <AlignLeft className="size-3.5" />
            </button>
            <button type="button" title={isFloat ? "Center — not available with Float" : "Center"} disabled={isFloat} className={iconBtnCls(align === "center" && !isFloat, isFloat)} onClick={() => !isFloat && onChange({ align: "center" })}>
              <AlignCenter className="size-3.5" />
            </button>
            <button type="button" title="Right" className={iconBtnCls(align === "right")} onClick={() => onChange({ align: "right" })}>
              <AlignRight className="size-3.5" />
            </button>
          </div>
        </div>
        {/* Size */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 text-[11px] text-base-content/45">Size</span>
          <div className="flex gap-1">
            {(["small", "medium", "large", "full"] as const).map((s) => {
              const disabled = isFloat && s === "full";
              return (
                <button
                  key={s}
                  type="button"
                  title={s === "full" && isFloat ? "Full — not available with Float" : s.charAt(0).toUpperCase() + s.slice(1)}
                  disabled={disabled}
                  className={chipCls(size === s && !disabled, disabled)}
                  onClick={() => !disabled && onChange({ size: s })}
                >
                  {s === "small" ? "S" : s === "medium" ? "M" : s === "large" ? "L" : "Full"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Media insert dialog (unchanged) ──────────────────────────────────────────

function FlowDialogFrame({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogViewport>
        <DialogPopup data-story-flow-insert-dialog className="max-w-xl border-base-content/12 bg-base-100">
          <div className="space-y-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          <div className="mt-5">{children}</div>
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogPopup>
      </DialogViewport>
    </DialogPortal>
  );
}

// ── Embed insert dialog ───────────────────────────────────────────────────────

function EmbedInsertDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}) {
  const [kindChosen, setKindChosen] = useState(false);
  const [embedDraft, setEmbedDraft] = useState(() => normalizeStoryFlowEmbedAttrs({ embedKind: "timeline" }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setKindChosen(false);
      setEmbedDraft(normalizeStoryFlowEmbedAttrs({ embedKind: "timeline" }));
      setShowAdvanced(false);
    }
  }, [open]);

  const embedLayout = useMemo(() => normalizeStoryFlowEmbedAttrs(embedDraft), [embedDraft]);

  const selectKind = (kind: StoryFlowEmbedKind) => {
    setKindChosen(true);
    setEmbedDraft((cur) =>
      normalizeStoryFlowEmbedAttrs({ ...cur, embedKind: kind, data: defaultStoryFlowEmbedData(kind) }),
    );
  };

  const setLayout = (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => {
    setEmbedDraft((cur) => normalizeStoryFlowEmbedAttrs({ ...cur, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup
            data-story-flow-insert-dialog
            className="max-w-2xl overflow-hidden border-base-content/12 bg-base-100 p-0"
          >
            {/* Header */}
            <div className="border-b border-base-content/10 bg-base-200/35 px-5 py-4">
              <DialogTitle className="text-base font-semibold text-base-content">Insert Embed</DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-base-content/55">
                Choose a type, then configure how it appears in the text.
              </DialogDescription>
            </div>

            {/* Kind picker */}
            <div className="px-5 pt-4 pb-3">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                Choose a type
              </p>
              <div className="grid grid-cols-4 gap-2">
                {STORY_FLOW_EMBED_KINDS.map((kind) => (
                  <EmbedKindCard
                    key={kind}
                    meta={EMBED_KIND_META[kind]}
                    selected={kindChosen && embedDraft.embedKind === kind}
                    onClick={() => selectKind(kind)}
                  />
                ))}
              </div>
            </div>

            {/* Details + layout */}
            <div className="border-t border-base-content/8 px-5 py-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                    Title <span className="normal-case font-normal tracking-normal text-base-content/30">(optional)</span>
                  </label>
                  <input
                    className="input input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                    placeholder="e.g. The Gonsalves Family Tree"
                    value={embedDraft.title ?? ""}
                    onChange={(e) =>
                      setEmbedDraft((cur) => ({ ...cur, title: e.target.value || undefined }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                    Caption <span className="normal-case font-normal tracking-normal text-base-content/30">(optional)</span>
                  </label>
                  <input
                    className="input input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                    placeholder="Short caption below the embed"
                    value={embedDraft.caption ?? ""}
                    onChange={(e) =>
                      setEmbedDraft((cur) => ({ ...cur, caption: e.target.value || undefined }))
                    }
                  />
                </div>
              </div>

              <FlowLayoutControls
                displayMode={embedLayout.displayMode}
                align={embedLayout.align}
                size={embedLayout.size}
                onChange={setLayout}
              />
            </div>

            {/* Advanced (collapsible) */}
            <div className="border-t border-base-content/8 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-base-content/40 hover:text-base-content/60 transition-colors"
              >
                Advanced
                <ChevronDown
                  className={cn("size-3.5 transition-transform duration-200", showAdvanced && "rotate-180")}
                />
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-base-content/55">Chrome</label>
                    <select
                      className="select select-bordered select-sm w-full rounded-lg border-base-content/12 bg-base-100"
                      value={embedDraft.presentation?.chrome ?? "minimal"}
                      onChange={(e) =>
                        setEmbedDraft((cur) => ({
                          ...cur,
                          presentation: {
                            ...(cur.presentation ?? {}),
                            chrome: e.target.value as "none" | "minimal" | "full",
                          },
                        }))
                      }
                    >
                      <option value="none">No chrome</option>
                      <option value="minimal">Minimal</option>
                      <option value="full">Full chrome</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-base-content/55">Controls</label>
                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-base-content/10 bg-base-100/60 px-3 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={embedDraft.presentation?.controls ?? false}
                        onChange={(e) =>
                          setEmbedDraft((cur) => ({
                            ...cur,
                            presentation: { ...(cur.presentation ?? {}), controls: e.target.checked },
                          }))
                        }
                      />
                      Show controls
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-base-content/10 bg-base-200/20 px-5 py-3">
              <p className="text-xs text-base-content/40">
                {kindChosen ? null : "Select a type to continue."}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg"
                  disabled={!kindChosen}
                  onClick={() => {
                    editor.chain().focus().insertStoryFlowEmbed(embedDraft).run();
                    onClose();
                  }}
                >
                  Insert embed
                </Button>
              </div>
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function StoryFlowInsertToolbarButtons({ editor, touch }: { editor: Editor; touch?: boolean }) {
  const supportsFlowNodes = Boolean(editor.schema.nodes.storyFlowMedia && editor.schema.nodes.storyFlowEmbed);
  const doc = useStoryTipTapStoryDoc();
  const storyId = doc?.id ?? "story";
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pickedMedia, setPickedMedia] = useState<AdminMediaListItem | null>(null);
  const [mediaDraft, setMediaDraft] = useState(() => normalizeStoryFlowMediaAttrs({ mediaId: "" }));
  const [embedOpen, setEmbedOpen] = useState(false);

  useToolbarDialogOpen(mediaPickerOpen);
  useToolbarDialogOpen(pickedMedia != null);
  useToolbarDialogOpen(embedOpen);

  const mediaLayout = useMemo(() => normalizeStoryFlowMediaAttrs(mediaDraft), [mediaDraft]);

  const setMediaLayout = (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => {
    setMediaDraft((cur) => normalizeStoryFlowMediaAttrs({ ...cur, ...patch }));
  };

  if (!supportsFlowNodes) return null;

  return (
    <>
      <ToolbarButton touch={touch} label="Insert media" onClick={() => setMediaPickerOpen(true)}>
        <ImageIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton touch={touch} label="Insert embed" onClick={() => setEmbedOpen(true)}>
        <Network className="size-4" />
      </ToolbarButton>

      <MediaPickerModal
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        targetType="story"
        targetId={storyId}
        mode="single"
        purpose="storyIllustration"
        onAttach={(items) => {
          const item = items[0];
          if (!item) return;
          setPickedMedia(item);
          setMediaDraft(
            normalizeStoryFlowMediaAttrs({
              mediaId: item.id,
              mediaType: inferMediaType(item),
              title: item.title ?? undefined,
              caption: item.description ?? undefined,
              displayMode: "block",
              align: "center",
              size: "medium",
            }),
          );
          setMediaPickerOpen(false);
        }}
      />

      <Dialog open={pickedMedia != null} onOpenChange={(open) => !open && setPickedMedia(null)}>
        {pickedMedia ? (
          <FlowDialogFrame
            title="Insert Media"
            description="Choose the editorial layout for this media item."
            onClose={() => setPickedMedia(null)}
          >
            <div className="space-y-4">
              <div className="grid gap-3">
                <input
                  className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                  placeholder="Title"
                  value={mediaDraft.title ?? ""}
                  onChange={(e) => setMediaDraft((cur) => ({ ...cur, title: e.target.value }))}
                />
                <textarea
                  className="textarea textarea-bordered min-h-20 w-full rounded-lg border-base-content/12 bg-base-100 text-sm"
                  placeholder="Caption"
                  value={mediaDraft.caption ?? ""}
                  onChange={(e) => setMediaDraft((cur) => ({ ...cur, caption: e.target.value }))}
                />
                <input
                  className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                  placeholder="Alt text"
                  value={mediaDraft.alt ?? ""}
                  onChange={(e) => setMediaDraft((cur) => ({ ...cur, alt: e.target.value }))}
                />
              </div>
              <FlowLayoutControls
                displayMode={mediaLayout.displayMode}
                align={mediaLayout.align}
                size={mediaLayout.size}
                onChange={setMediaLayout}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPickedMedia(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    editor.chain().focus().insertStoryFlowMedia(mediaDraft).run();
                    setPickedMedia(null);
                  }}
                >
                  Insert media
                </Button>
              </div>
            </div>
          </FlowDialogFrame>
        ) : null}
      </Dialog>

      <EmbedInsertDialog editor={editor} open={embedOpen} onClose={() => setEmbedOpen(false)} />
    </>
  );
}
