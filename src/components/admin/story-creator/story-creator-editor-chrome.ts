/**
 * Story Creator block chrome — tuned for the **white document page** in the editor
 * (neutral surfaces + primary accents), not the dark admin shell.
 */
export const storyEditorElevated = "bg-white/95";

export const storyEditorBorder = "border-black/20";

/** Selected block: light wash + primary border (reads on white paper). */
export const storyActiveBlockFrame =
  "rounded-xl border border-primary/40 bg-primary/[0.07] shadow-sm shadow-neutral-900/5 ring-1 ring-primary/15 transition-[box-shadow,border-color,background-color,ring-color] duration-200 focus-within:border-primary/55 focus-within:bg-primary/[0.09] focus-within:shadow-md focus-within:ring-primary/25";

export const storyIdleBlockFrame =
  "rounded-xl border border-transparent bg-transparent transition-[box-shadow,border-color,background-color] duration-200";

export const storyBlockFrameHover = "hover:border-black/20 hover:bg-neutral-50/90";

export const storyBlockFrameQuietHover = "hover:border-black/20 hover:bg-neutral-50/60";

/** Floating block toolbar: light pill on the document. */
export const storyFloatingBlockToolbar =
  `${storyEditorElevated} rounded-full border ${storyEditorBorder} px-1 py-0.5 shadow-md shadow-neutral-900/10 backdrop-blur-sm`;

/** Muted toolbar icon on paper. */
export const storyToolbarIcon =
  "text-neutral-500 hover:bg-primary/12 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0 focus-visible:ring-offset-white";

export const storyToolbarIconDanger =
  "text-error/85 hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/35 focus-visible:ring-offset-0 focus-visible:ring-offset-white";

export const storyFloatingMenuContent =
  `${storyEditorElevated} min-w-[11rem] rounded-xl border ${storyEditorBorder} p-1.5 text-neutral-800 shadow-lg shadow-neutral-900/12`;
