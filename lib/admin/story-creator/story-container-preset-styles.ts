import { cn } from "@/lib/utils";
import type { StoryContainerBlock, StoryContainerBlockProps, StoryContainerPreset, StoryContainerWidth } from "@/lib/admin/story-creator/story-types";
import { getStoryContainerPreset, resolveStoryContainerWidth } from "@/lib/admin/story-creator/story-types";

export type StoryContainerRenderMode = "editor" | "preview";

/** Resolved visual props (safe defaults when fields are omitted on disk). */
export type ResolvedContainerVisualProps = {
  preset: StoryContainerPreset;
  background: NonNullable<StoryContainerBlockProps["background"]>;
  padding: NonNullable<StoryContainerBlockProps["padding"]>;
  border: NonNullable<StoryContainerBlockProps["border"]>;
  width: StoryContainerWidth;
  align: NonNullable<StoryContainerBlockProps["align"]>;
};

export function resolveContainerVisualProps(block: Pick<StoryContainerBlock, "props">): ResolvedContainerVisualProps {
  const p = block.props;
  return {
    preset: getStoryContainerPreset(p),
    background: p.background ?? "none",
    padding: p.padding ?? "md",
    border: p.border ?? "none",
    width: resolveStoryContainerWidth(p.width),
    align: p.align ?? "center",
  };
}

export function getContainerPresetEmptyHint(preset: StoryContainerPreset): string {
  switch (preset) {
    case "card":
      return "Add content to this card…";
    case "callout":
      return "Add a note or callout…";
    case "hero":
      return "Build a hero section…";
    case "quote":
      return "Add quoted content…";
    default:
      return "Add content…";
  }
}

function paddingClass(padding: ResolvedContainerVisualProps["padding"], mode: StoryContainerRenderMode): string {
  switch (padding) {
    case "none":
      /** Editor: minimal padding so selection chrome does not clip; preview stays flush. */
      return mode === "editor" ? "px-px py-px sm:px-0.5 sm:py-0.5" : "p-0";
    case "sm":
      return "p-2 sm:p-2.5";
    case "lg":
      return "p-6 sm:p-8";
    case "md":
    default:
      return "p-4 sm:p-5";
  }
}

function alignClass(align: ResolvedContainerVisualProps["align"]): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function innerWidthClass(width: StoryContainerWidth): string {
  switch (width) {
    case "narrow":
      return "w-full max-w-md min-w-0 mx-auto";
    case "wide":
      return "w-full max-w-5xl min-w-0 mx-auto";
    case "full":
      return "w-full min-w-0 max-w-none";
    case "normal":
    default:
      return "w-full max-w-3xl min-w-0 mx-auto";
  }
}

/**
 * Callout/quote: user border is only top/right/bottom so it does not replace the left accent bar
 * (`border-l-*` on the same node). Card, hero, and default use a full box border when enabled.
 */
function userBorderShellClass(preset: StoryContainerPreset, border: ResolvedContainerVisualProps["border"]): string {
  const frameLeftFree = preset === "callout" || preset === "quote";

  if (border === "none") {
    if (preset === "default") return "border border-transparent";
    if (frameLeftFree) return "border-t border-r border-b border-transparent";
    return "border border-transparent";
  }
  if (border === "dashed") {
    if (frameLeftFree) {
      return "border-t border-r border-b border-dashed [border-color:var(--story-subtle-border,rgba(0,0,0,0.2))]";
    }
    return "border border-dashed [border-color:var(--story-subtle-border,rgba(0,0,0,0.2))]";
  }
  if (frameLeftFree) {
    return "border-t border-r border-b border-solid [border-color:var(--story-subtle-border,rgba(0,0,0,0.2))]";
  }
  return "border border-solid [border-color:var(--story-subtle-border,rgba(0,0,0,0.2))]";
}

function presetShellClassName(r: ResolvedContainerVisualProps, mode: StoryContainerRenderMode): string {
  const pad = paddingClass(r.padding, mode);
  const align = alignClass(r.align);
  const width = innerWidthClass(r.width);
  const userBorder = userBorderShellClass(r.preset, r.border);

  switch (r.preset) {
    case "card":
      return cn(
        "story-container-preset-shell story-container-preset-card min-w-0 rounded-xl transition-[box-shadow,ring-color] duration-200",
        "bg-[var(--story-surface)] shadow-sm",
        pad,
        align,
        width,
        userBorder,
      );
    case "callout":
      return cn(
        "story-container-preset-shell story-container-preset-callout min-w-0 rounded-lg transition-[box-shadow,ring-color] duration-200",
        "border-l-[4px] border-l-[var(--story-accent)] bg-[var(--story-surface-muted)] pl-3 pr-3 shadow-sm",
        pad,
        align,
        width,
        userBorder,
      );
    case "hero":
      return cn(
        "story-container-preset-shell story-container-preset-hero min-w-0 rounded-xl transition-[box-shadow,ring-color] duration-200",
        "story-container-hero-gradient shadow-md",
        pad,
        align,
        width,
        userBorder,
      );
    case "quote":
      return cn(
        "story-container-preset-shell story-container-preset-quote min-w-0 rounded-lg transition-[box-shadow,ring-color] duration-200",
        "border-l-[4px] border-l-[var(--story-quote-accent)] bg-[var(--story-surface-muted)] pl-4 pr-3 font-serif text-[var(--story-text)] shadow-sm",
        pad,
        align,
        width,
        userBorder,
      );
    default:
      return cn(
        "story-container-preset-shell story-container-preset-default min-w-0 rounded-lg transition-[box-shadow,ring-color] duration-200",
        pad,
        align,
        width,
        userBorder,
      );
  }
}

function backgroundOverlayClass(
  props: StoryContainerBlockProps,
  r: ResolvedContainerVisualProps,
  preset: StoryContainerPreset,
): string {
  if (r.background === "custom") {
    const has = Boolean(props.customBackground?.trim());
    if (!has) return "story-container-bg-fallback";
    return "";
  }
  if (r.background === "subtle") {
    if (preset === "default") return "story-container-bg-subtle";
    return "story-container-bg-subtle-on-preset";
  }
  return "";
}

/**
 * Combined class list for a `container` block (editor + preview). Single source of truth for
 * preset, background, padding, border, width, and alignment.
 */
export function getContainerClasses(
  block: StoryContainerBlock,
  mode: StoryContainerRenderMode,
  opts?: { selected?: boolean; emptyChildren?: boolean },
): string {
  const r = resolveContainerVisualProps(block);
  const shell = presetShellClassName(r, mode);
  const bg = backgroundOverlayClass(block.props, r, r.preset);
  const defaultPresetFill = r.background === "none" && r.preset === "default" ? "bg-transparent" : "";
  const editorRing =
    mode === "editor" && opts?.selected
      ? "ring-2 ring-primary/45 ring-offset-2 ring-offset-[var(--story-ring-offset,theme(colors.base.100))]"
      : "";
  const editorEmptyMin =
    mode === "editor" && opts?.emptyChildren ? "min-h-[3.5rem] flex flex-col justify-center" : "";

  return cn(
    "story-container-mode",
    mode === "editor" ? "story-container-mode-editor" : "story-container-mode-preview",
    shell,
    bg,
    defaultPresetFill,
    editorRing,
    editorEmptyMin,
  );
}

/** @deprecated Prefer {@link getContainerClasses} with the full block. */
export function getContainerPresetShellClassName(
  props: StoryContainerBlockProps,
  mode: StoryContainerRenderMode,
  opts?: { selected?: boolean; emptyChildren?: boolean },
): string {
  const stub: StoryContainerBlock = {
    id: "",
    type: "container",
    props,
    children: [],
  };
  return getContainerClasses(stub, mode, opts);
}

export function getContainerCustomBackgroundStyle(
  props: StoryContainerBlockProps,
): { background?: string } | undefined {
  if (props.background !== "custom") return undefined;
  const c = props.customBackground?.trim();
  if (!c) return undefined;
  return { background: c };
}
