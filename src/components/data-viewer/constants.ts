import { cn } from "@/lib/utils";

/** Shared page size for table and card views */
export const DATA_VIEWER_PAGE_SIZE = 10;

/** DaisyUI select styling shared across filter panels */
export const selectClassName = cn(
  "select select-bordered select-md w-full min-w-0 border border-solid bg-base-100 text-base-content transition-[box-shadow,border-color]",
  "border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] lemonade:border-[color-mix(in_oklch,var(--color-base-content)_26%,var(--color-base-300))]",
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25",
  "disabled:pointer-events-none disabled:opacity-50",
);
