"use client";

import { useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ImageIcon, Network } from "lucide-react";
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
import {
  STORY_FLOW_ALIGNS,
  STORY_FLOW_DISPLAY_MODES,
  STORY_FLOW_EMBED_KINDS,
  STORY_FLOW_SIZES,
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

function inferMediaType(item: AdminMediaListItem): StoryFlowMediaAttrs["mediaType"] {
  const form = (item.form ?? "").toLowerCase();
  const ref = (item.fileRef ?? "").toLowerCase();
  if (form.includes("video") || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(ref)) return "video";
  if (form.includes("audio") || /\.(mp3|m4a|wav|ogg|flac)(\?|#|$)/i.test(ref)) return "audio";
  if (form.includes("pdf") || form.includes("document") || /\.(pdf|docx?|txt)(\?|#|$)/i.test(ref)) return "document";
  return "image";
}

function optionButton(active: boolean) {
  return cn(
    "rounded-lg border px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
    active
      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
      : "border-base-content/10 bg-base-100/70 text-base-content/60 hover:border-base-content/20",
  );
}

function allowedAligns(mode: StoryFlowDisplayMode): StoryFlowAlign[] {
  return mode === "wrapped" ? ["left", "right"] : STORY_FLOW_ALIGNS;
}

function allowedSizes(mode: StoryFlowDisplayMode): StoryFlowSize[] {
  return mode === "wrapped" ? ["small", "medium", "large"] : STORY_FLOW_SIZES;
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
  const aligns = allowedAligns(displayMode);
  const sizes = allowedSizes(displayMode);
  return (
    <div className="grid gap-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">Display</p>
        <div className="flex flex-wrap gap-2">
          {STORY_FLOW_DISPLAY_MODES.map((mode) => (
            <button key={mode} type="button" className={optionButton(displayMode === mode)} onClick={() => onChange({ displayMode: mode })}>
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">Align</p>
        <div className="flex flex-wrap gap-2">
          {aligns.map((value) => (
            <button key={value} type="button" className={optionButton(align === value)} onClick={() => onChange({ align: value })}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">Size</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((value) => (
            <button key={value} type="button" className={optionButton(size === value)} onClick={() => onChange({ size: value })}>
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

export function StoryFlowInsertToolbarButtons({ editor, touch }: { editor: Editor; touch?: boolean }) {
  const supportsFlowNodes = Boolean(editor.schema.nodes.storyFlowMedia && editor.schema.nodes.storyFlowEmbed);
  const doc = useStoryTipTapStoryDoc();
  const storyId = doc?.id ?? "story";
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pickedMedia, setPickedMedia] = useState<AdminMediaListItem | null>(null);
  const [mediaDraft, setMediaDraft] = useState(() => normalizeStoryFlowMediaAttrs({ mediaId: "" }));
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedDraft, setEmbedDraft] = useState(() => normalizeStoryFlowEmbedAttrs({ embedKind: "timeline" }));

  const mediaLayout = useMemo(() => normalizeStoryFlowMediaAttrs(mediaDraft), [mediaDraft]);
  const embedLayout = useMemo(() => normalizeStoryFlowEmbedAttrs(embedDraft), [embedDraft]);

  const setMediaLayout = (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => {
    setMediaDraft((cur) => normalizeStoryFlowMediaAttrs({ ...cur, ...patch }));
  };

  const setEmbedLayout = (patch: { displayMode?: StoryFlowDisplayMode; align?: StoryFlowAlign; size?: StoryFlowSize }) => {
    setEmbedDraft((cur) => normalizeStoryFlowEmbedAttrs({ ...cur, ...patch }));
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
              <FlowLayoutControls displayMode={mediaLayout.displayMode} align={mediaLayout.align} size={mediaLayout.size} onChange={setMediaLayout} />
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

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        {embedOpen ? (
          <FlowDialogFrame title="Insert Embed" description="Add a semantic object into the prose flow." onClose={() => setEmbedOpen(false)}>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">Kind</p>
                <select
                  className="select select-bordered select-sm w-full rounded-lg border-base-content/12 bg-base-100"
                  value={embedDraft.embedKind}
                  onChange={(e) => {
                    const embedKind = e.target.value as StoryFlowEmbedKind;
                    setEmbedDraft((cur) => normalizeStoryFlowEmbedAttrs({ ...cur, embedKind, data: defaultStoryFlowEmbedData(embedKind) }));
                  }}
                >
                  {STORY_FLOW_EMBED_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                placeholder="Title"
                value={embedDraft.title ?? ""}
                onChange={(e) => setEmbedDraft((cur) => ({ ...cur, title: e.target.value }))}
              />
              <textarea
                className="textarea textarea-bordered min-h-20 w-full rounded-lg border-base-content/12 bg-base-100 text-sm"
                placeholder="Caption"
                value={embedDraft.caption ?? ""}
                onChange={(e) => setEmbedDraft((cur) => ({ ...cur, caption: e.target.value }))}
              />
              <FlowLayoutControls displayMode={embedLayout.displayMode} align={embedLayout.align} size={embedLayout.size} onChange={setEmbedLayout} />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="select select-bordered select-sm rounded-lg border-base-content/12 bg-base-100"
                  value={embedDraft.presentation?.chrome ?? "minimal"}
                  onChange={(e) =>
                    setEmbedDraft((cur) => ({
                      ...cur,
                      presentation: { ...(cur.presentation ?? {}), chrome: e.target.value as "none" | "minimal" | "full" },
                    }))
                  }
                >
                  <option value="none">No chrome</option>
                  <option value="minimal">Minimal chrome</option>
                  <option value="full">Full chrome</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-100/60 px-3 text-sm">
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
                  Controls
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEmbedOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    editor.chain().focus().insertStoryFlowEmbed(embedDraft).run();
                    setEmbedOpen(false);
                  }}
                >
                  Insert embed
                </Button>
              </div>
            </div>
          </FlowDialogFrame>
        ) : null}
      </Dialog>
    </>
  );
}
