"use client";

import { type ReactNode } from "react";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { StoryCaptionRichTextEditor } from "@/components/admin/story-creator/StoryCaptionRichText";
import { EventsListPicker } from "@/components/admin/story-creator/EventsListPicker";
import { useTimelineEventResolution } from "@/hooks/useTimelineEventResolution";
import type { StoryEmbedBlock, StoryTimelineEmbedData } from "@/lib/admin/story-creator/story-types";
import { cn } from "@/lib/utils";

type Props = {
  block: StoryEmbedBlock;
  onEmbedChange: (patch: Partial<StoryEmbedBlock>) => void;
  onBlockChange: (patch: Partial<StoryEmbedBlock>) => void;
};

const CHROME_LABELS: Record<NonNullable<StoryEmbedBlock["presentation"]>["chrome"] & string, string> = {
  none: "No frame",
  minimal: "Minimal",
  full: "Full",
};

function segBtn(on: boolean): string {
  return cn(
    "cursor-pointer rounded-md border-0 px-2.5 py-1 text-[11px] font-medium transition-all",
    on ? "bg-base-100 text-base-content shadow-sm shadow-base-content/10" : "bg-transparent text-muted-foreground hover:text-foreground",
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">{children}</p>;
}

function HelperCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-100/70 p-4 shadow-sm ring-1 ring-base-content/[0.04]">
      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{title}</p>
      <div className="mt-2.5 text-sm leading-relaxed text-base-content/70">{children}</div>
    </div>
  );
}

export function StoryTimelineEmbedInspector({ block, onEmbedChange, onBlockChange }: Props) {
  const data = (block.data ?? {}) as StoryTimelineEmbedData;
  const presentation = block.presentation ?? {};
  const resolution = useTimelineEventResolution(data.rules ?? [], data.globalFilters);

  const patchData = (patch: Partial<StoryTimelineEmbedData>) => {
    onEmbedChange({ data: { ...data, ...patch } } as Partial<StoryEmbedBlock>);
  };

  return (
    <div className="space-y-4">
      <HelperCard title="Semantic timeline embed">
        Define a set of event rules and filters. The public site owns final timeline styling and event resolution.
      </HelperCard>

      <CollapsibleFormSection title="Editorial metadata" defaultOpen>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            className="input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100"
            value={block.title ?? block.label}
            onChange={(e) => onBlockChange({ title: e.target.value, label: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Editorial note</FieldLabel>
          <input
            className="input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100"
            placeholder="Optional short line for the preview"
            value={block.sublabel ?? ""}
            onChange={(e) => onBlockChange({ sublabel: e.target.value || undefined })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Caption</FieldLabel>
          <StoryCaptionRichTextEditor
            caption={block.caption}
            placeholder="Optional caption…"
            onChange={(caption) => onBlockChange({ caption })}
          />
        </div>
        <div className="mt-4 space-y-3 rounded-lg border border-base-content/10 bg-base-100/50 p-3">
          <p className="text-xs font-semibold text-base-content/70">Story display</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideTitle}
              onChange={(e) => onBlockChange({ hideTitle: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display title in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the title editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideCaption}
              onChange={(e) => onBlockChange({ hideCaption: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display caption in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the caption editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Timeline source" defaultOpen>
        <EventsListPicker
          rules={data.rules ?? []}
          globalFilters={data.globalFilters}
          onRulesChange={(rules) => patchData({ rules })}
          onGlobalFiltersChange={(globalFilters) => patchData({ globalFilters })}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Preview summary" defaultOpen={false}>
        {resolution.status === "idle" && (
          <p className="text-sm text-base-content/60">Add rules above to define the event sources for this timeline.</p>
        )}
        {resolution.status === "loading" && (
          <p className="text-sm text-base-content/60">Resolving events…</p>
        )}
        {resolution.status === "error" && (
          <p className="text-sm text-error">{resolution.errorMessage}</p>
        )}
        {resolution.status === "ready" && (
          <div className="space-y-1.5">
            <p className="text-sm text-base-content/70">
              <span className="font-semibold text-base-content">{resolution.events.length}</span> unique event{resolution.events.length === 1 ? "" : "s"} resolved from {resolution.ruleCount} rule{resolution.ruleCount === 1 ? "" : "s"}.
            </p>
            {resolution.unsupportedRuleCount > 0 && (
              <p className="text-xs text-base-content/50">
                {resolution.unsupportedRuleCount} rule{resolution.unsupportedRuleCount === 1 ? "" : "s"} (relative events) cannot be previewed here and will be resolved by the renderer.
              </p>
            )}
          </div>
        )}
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Preview behavior" defaultOpen={false}>
        <FieldLabel>Frame style</FieldLabel>
        <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
          {(["none", "minimal", "full"] as const).map((chrome) => (
            <button
              key={chrome}
              type="button"
              className={segBtn((presentation.chrome ?? "minimal") === chrome)}
              onClick={() => onBlockChange({ presentation: { ...presentation, chrome } })}
            >
              {CHROME_LABELS[chrome]}
            </button>
          ))}
        </div>
      </CollapsibleFormSection>
    </div>
  );
}
