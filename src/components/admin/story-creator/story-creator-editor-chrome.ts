/**
 * Story Creator canvas chrome — uses the same DaisyUI / admin tokens as the rest of the panel
 * (`base-*`, `primary`, `error`) so the editor matches {@link AdminChrome} and story shell styling.
 */
export const storyEditorElevated = "bg-base-300/95";

export const storyEditorBorder = "border-base-content/12";

/** Active block: one surface, primary accent, soft depth (no custom hex stack). */
export const storyActiveBlockFrame =
  "rounded-xl border border-primary/45 bg-base-200/55 shadow-lg shadow-primary/10 ring-1 ring-primary/15 transition-[box-shadow,border-color,background-color,ring-color] duration-200 focus-within:border-primary/55 focus-within:shadow-xl focus-within:shadow-primary/15 focus-within:ring-primary/25";

export const storyIdleBlockFrame =
  "rounded-xl border border-transparent bg-transparent transition-[box-shadow,border-color,background-color] duration-200";

export const storyBlockFrameHover =
  "hover:border-base-content/15 hover:bg-base-200/40";

export const storyBlockFrameQuietHover = "hover:border-base-content/10 hover:bg-base-200/25";

/** Floating block toolbar: elevated pill aligned with admin surfaces. */
export const storyFloatingBlockToolbar =
  `${storyEditorElevated} rounded-full border ${storyEditorBorder} px-1 py-0.5 shadow-md shadow-base-content/10 backdrop-blur-md`;

/** Muted toolbar icon; hover uses theme primary. */
export const storyToolbarIcon =
  "text-base-content/50 hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0";

export const storyToolbarIconDanger =
  "text-error/85 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/35 focus-visible:ring-offset-0";

export const storyFloatingMenuContent =
  `${storyEditorElevated} min-w-[11rem] rounded-xl border ${storyEditorBorder} p-1.5 text-base-content shadow-lg`;
