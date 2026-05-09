/** Plotly specs for admin surnames analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { horizontalBarChart, verticalBarChart } from "./analytics-plotly-charts";

function withoutPlotlyOuterTitle(spec: {
  data: Data[];
  layout: Partial<Layout>;
}): { data: Data[]; layout: Partial<Layout> } {
  const m = spec.layout.margin ?? {};
  return {
    data: spec.data,
    layout: {
      ...spec.layout,
      title: undefined,
      margin: { ...m, t: typeof m.t === "number" ? Math.min(m.t, 24) : 24 },
    },
  };
}

export function surnamesTopChart(
  rows: Array<{ name?: unknown; frequency?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.name ?? "—")),
      sliced.map((r) => (typeof r.frequency === "number" ? r.frequency : Number(r.frequency) || 0)),
      "Top surnames",
    ),
  );
}

export function surnamesFrequencyBucketsChart(
  rows: Array<{ bucket?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const cleaned = rows.map((r) => ({
    bucket: r.bucket != null ? String(r.bucket) : "—",
    count: typeof r.count === "number" ? r.count : Number(r.count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    verticalBarChart(
      cleaned.map((r) => r.bucket),
      cleaned.map((r) => r.count),
      "Surnames — frequency buckets",
      "Occurrences per surname",
      "Distinct surnames",
      { height: 340 },
    ),
  );
}

/** Aggregates `count` by decade from popularity_by_decade (top ~20 surnames cohort). */
export function surnamesPopularityByDecadeChart(
  rows: Array<{ decade?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const byDecade = new Map<number, number>();
  for (const r of rows) {
    const raw = r.decade;
    const di = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(di)) continue;
    const c = typeof r.count === "number" ? r.count : Number(r.count) || 0;
    byDecade.set(di, (byDecade.get(di) ?? 0) + c);
  }
  const decades = [...byDecade.keys()].sort((a, b) => a - b);
  if (decades.length === 0) {
    return withoutPlotlyOuterTitle(
      verticalBarChart([], [], "Birth decade (top surnames cohort)", "Decade", "Individuals", { height: 280 }),
    );
  }
  const labels = decades.map((d) => `${Math.trunc(d)}s`);
  const values = decades.map((d) => byDecade.get(d) ?? 0);
  return withoutPlotlyOuterTitle(
    verticalBarChart(
      labels,
      values,
      "Birth decade (top surnames cohort)",
      "Decade",
      "Individuals",
      { height: Math.min(480, 120 + decades.length * 28) },
    ),
  );
}

/** Non-trivial Soundex clusters: total_frequency drives bar length. */
export function surnamesSoundexGroupsChart(
  rows: Array<{ soundex?: unknown; name_count?: unknown; total_frequency?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => {
        const code = String(r.soundex ?? "—").trim();
        const nc = r.name_count != null ? Number(r.name_count) : 0;
        return nc > 1 ? `${code} (${nc} names)` : code;
      }),
      rows.map((r) =>
        typeof r.total_frequency === "number" ? r.total_frequency : Number(r.total_frequency) || 0,
      ),
      "Phonetic clusters (Soundex)",
    ),
  );
}

/** Sums lineage counts by birth country (API: top surnames × top countries). */
export function surnamesPopularityByBirthCountryChart(
  rows: Array<{ place_country?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const byCountry = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.place_country ?? "Unknown").trim() || "Unknown";
    const n = typeof r.count === "number" ? r.count : Number(r.count) || 0;
    byCountry.set(c, (byCountry.get(c) ?? 0) + n);
  }
  const pairs = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
  const sliced = pairs.slice(0, 24);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map(([k]) => k),
      sliced.map(([, v]) => v),
      "Birth country (top surnames cohort)",
    ),
  );
}
