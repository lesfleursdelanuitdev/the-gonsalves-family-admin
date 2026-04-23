/** Journey strip dimensions - must match JourneyStrip and JourneyCard */
export const JOURNEY_CARD_WIDTH = 280;
export const JOURNEY_ARROW_WIDTH = 32; // w-8
export const JOURNEY_GAP = 16; // gap-x-4
export const JOURNEY_CARD_COUNT = 4;

/** Total width of the journey strip: cards + arrows + gaps between them */
export const JOURNEY_STRIP_WIDTH =
  JOURNEY_CARD_COUNT * JOURNEY_CARD_WIDTH +
  (JOURNEY_CARD_COUNT - 1) * JOURNEY_ARROW_WIDTH +
  (JOURNEY_CARD_COUNT * 2 - 2) * JOURNEY_GAP; // 7 flex items → 6 gaps

/** Horizontal padding per side in narrow sections (matches PageContainer px-6) */
export const SECTION_PADDING_X = 24;

/** Narrow section max-width: strip width + inner padding (left + right) */
export const NARROW_SECTION_MAX_WIDTH =
  JOURNEY_STRIP_WIDTH + SECTION_PADDING_X * 2;
