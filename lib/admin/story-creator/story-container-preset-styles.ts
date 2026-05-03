import { cn } from "@/lib/utils";
import type { StoryContainerBlockProps, StoryContainerPreset } from "@/lib/admin/story-creator/story-types";

export function getStoryContainerPreset(props: StoryContainerBlockProps): StoryContainerPreset {
  return props.containerPreset ?? "default";
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

function paddingClass(padding: StoryContainerBlockProps["padding"] | undefined): string {
  switch (padding) {
    case "none":
      return "p-0";
    case "sm":
      return "p-2 sm:p-2.5";
    case "lg":
      return "p-6 sm:p-7";
    case "md":
    default:
      return "p-4 sm:p-5";
  }
}

function alignClass(align: StoryContainerBlockProps["align"] | undefined): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function widthClass(width: StoryContainerBlockProps["width"] | undefined): string {
  return width === "constrained" ? "mx-auto w-full max-w-3xl" : "w-full";
}

/** Extra border treatment for default; dashed accent for structured presets. */
function userBorderModifier(preset: StoryContainerPreset, border: StoryContainerBlockProps["border"] | undefined): string {
  if (preset === "default" && border === "none") return "border-transparent";
  if (preset === "default" && border === "dashed") return "border border-dashed border-neutral-300/90";
  if (preset === "default") return "border border-neutral-200/90";
  if (border === "dashed") return "border-dashed";
  return "";
}

function subtleBackgroundClass(preset: StoryContainerPreset): string {
  if (preset === "callout") return "!bg-primary/[0.11]";
  if (preset === "quote") return "!bg-neutral-100/95";
  if (preset === "hero") return "!bg-gradient-to-b !from-neutral-200/90 !via-neutral-50/95 !to-white/90";
  if (preset === "card") return "!bg-neutral-100/95";
  return "bg-neutral-50/90";
}

function backgroundLayer(props: StoryContainerBlockProps, preset: StoryContainerPreset): string {
  if (props.background === "custom") return "";
  if (props.background === "subtle") return subtleBackgroundClass(preset);
  return "";
}

/**
 * Shared surface for container blocks — editor and preview use the same classes;
 * editor adds a selection ring when `selected` is true. Custom fill is applied via
 * {@link getContainerCustomBackgroundStyle} on the same node (inline wins over classes).
 */
export function getContainerPresetShellClassName(
  props: StoryContainerBlockProps,
  mode: "editor" | "preview",
  opts?: { selected?: boolean },
): string {
  const preset = getStoryContainerPreset(props);
  const pad = paddingClass(props.padding);
  const align = alignClass(props.align);
  const width = widthClass(props.width);
  const borderMod = userBorderModifier(preset, props.border);
  const bg = backgroundLayer(props, preset);

  const defaultShell = cn(
    "min-w-0 rounded-lg transition-[box-shadow,ring-color] duration-200",
    pad,
    align,
    width,
    borderMod,
    props.background === "none" || !props.background ? "bg-transparent" : "",
    props.background === "subtle" && preset === "default" && bg,
  );

  const cardShell = cn(
    "min-w-0 rounded-xl border border-neutral-200/90 bg-white/95 shadow-sm shadow-neutral-900/[0.06]",
    pad,
    align,
    width,
    borderMod,
    props.background === "none" || !props.background ? "bg-white/95" : "",
    props.background === "subtle" && bg,
  );

  const calloutShell = cn(
    "min-w-0 rounded-lg border border-primary/25 border-l-[4px] border-l-primary/60 bg-primary/[0.07] pl-3 pr-3 shadow-sm shadow-primary/5",
    pad,
    align,
    width,
    borderMod,
    props.background === "none" || !props.background ? "bg-primary/[0.05]" : "",
    props.background === "subtle" && bg,
  );

  const heroShell = cn(
    "min-w-0 rounded-xl border border-neutral-200/80 bg-gradient-to-b from-neutral-100/95 via-white/92 to-neutral-50/85 shadow-md shadow-neutral-900/10",
    pad,
    align,
    width,
    borderMod,
    props.background === "none" || !props.background ? "" : "",
    props.background === "subtle" && bg,
  );

  const quoteShell = cn(
    "min-w-0 rounded-lg border border-neutral-200/85 border-l-[4px] border-l-neutral-500/75 bg-neutral-50/70 pl-4 pr-3 shadow-sm shadow-neutral-900/[0.04]",
    "font-serif text-neutral-800/95",
    pad,
    align,
    width,
    borderMod,
    props.background === "none" || !props.background ? "bg-neutral-50/55" : "",
    props.background === "subtle" && bg,
  );

  let shell = defaultShell;
  if (preset === "card") shell = cardShell;
  else if (preset === "callout") shell = calloutShell;
  else if (preset === "hero") shell = heroShell;
  else if (preset === "quote") shell = quoteShell;

  const editorRing =
    mode === "editor" && opts?.selected
      ? "ring-2 ring-primary/45 ring-offset-2 ring-offset-white"
      : "";

  return cn("story-container-preset-shell", shell, editorRing);
}

export function getContainerCustomBackgroundStyle(props: StoryContainerBlockProps): { background?: string } | undefined {
  if (props.background !== "custom" || !props.customBackground?.trim()) return undefined;
  return { background: props.customBackground.trim() };
}
