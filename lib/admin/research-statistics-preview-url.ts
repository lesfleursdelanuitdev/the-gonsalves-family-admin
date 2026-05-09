/**
 * Deep links to the public site's research statistics preview (Plotly / Python analytics).
 * Set {@link RESEARCH_STATISTICS_ENV} in the admin app's environment.
 *
 * Production: `NEXT_PUBLIC_*` is inlined at **`next build`** time. Set the URL in
 * `.env.production` / `.env.local` (deploy.sh sources those before `npm run build`) or export
 * it in the shell before building, then rebuild if you change it.
 *
 * Development: if unset, defaults to `http://localhost:3000/statistics-test` (public site
 * `the-gonsalves-family` on port 3000 per repo conventions).
 */

export const RESEARCH_STATISTICS_ENV = "NEXT_PUBLIC_RESEARCH_STATISTICS_URL" as const;

const DEV_FALLBACK_STATISTICS_BASE = "http://localhost:3000/statistics-test";

function statisticsPreviewBase(): string | null {
  const explicit = process.env.NEXT_PUBLIC_RESEARCH_STATISTICS_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_FALLBACK_STATISTICS_BASE.replace(/\/$/, "");
  }
  return null;
}

/** Admin list entities that map to a section on the statistics preview page. */
export type ResearchStatisticsPreviewEntity =
  | "given-names"
  | "surnames"
  | "individuals"
  | "families"
  | "events"
  | "places"
  | "dates"
  | "media"
  | "notes"
  | "open-questions"
  | "sources";

const FRAGMENT_BY_ENTITY: Record<ResearchStatisticsPreviewEntity, string> = {
  "given-names": "stats-given-surnames",
  surnames: "stats-given-surnames",
  individuals: "stats-individuals",
  families: "stats-families",
  events: "stats-events",
  places: "stats-places",
  dates: "stats-dates",
  media: "stats-media",
  notes: "stats-notes",
  "open-questions": "stats-open-questions",
  /** No dedicated “sources” block; notes analytics includes source↔note rankings. */
  sources: "stats-notes",
};

/**
 * Returns an absolute URL (with hash) for opening in a new tab, or `null` if the base URL is not configured.
 */
export function researchStatisticsPreviewUrl(entity: ResearchStatisticsPreviewEntity): string | null {
  const base = statisticsPreviewBase();
  if (!base) return null;
  const fragment = FRAGMENT_BY_ENTITY[entity];
  return `${base}#${fragment}`;
}
