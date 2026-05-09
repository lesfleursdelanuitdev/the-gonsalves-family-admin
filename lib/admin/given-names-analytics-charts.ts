/** Plotly specs for admin given-names analytics (aligned with statistics-test / research API). */
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

/** Horizontal bar — top given names (statistics-test uses 18). */
export function givenNamesTopChart(
  rows: Array<{ name?: unknown; frequency?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.name ?? "—")),
      sliced.map((r) => (typeof r.frequency === "number" ? r.frequency : Number(r.frequency) || 0)),
      "Top given names",
    ),
  );
}

/** Vertical bar — distinct names per frequency bucket. */
export function givenNamesFrequencyBucketsChart(
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
      "Given names — frequency buckets",
      "Occurrences per name",
      "Distinct names",
      { height: 340 },
    ),
  );
}

export function givenNamesTopMaleChart(
  rows: Array<{ name?: unknown; males_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => String(r.name ?? "—")),
      rows.map((r) => (typeof r.males_count === "number" ? r.males_count : Number(r.males_count) || 0)),
      "Top male-linked given names",
    ),
  );
}

export function givenNamesTopFemaleChart(
  rows: Array<{ name?: unknown; females_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => String(r.name ?? "—")),
      rows.map((r) => (typeof r.females_count === "number" ? r.females_count : Number(r.females_count) || 0)),
      "Top female-linked given names",
    ),
  );
}

/**
 * Sums `count` by `decade` from popularity_by_decade (API: top ~20 names × birth decade).
 * Answers how many individual links fall in each decade for that cohort.
 */
export function givenNamesPopularityByDecadeChart(
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
      verticalBarChart([], [], "Birth decade (top names cohort)", "Decade", "Individuals", { height: 280 }),
    );
  }
  const labels = decades.map((d) => `${Math.trunc(d)}s`);
  const values = decades.map((d) => byDecade.get(d) ?? 0);
  return withoutPlotlyOuterTitle(
    verticalBarChart(
      labels,
      values,
      "Birth decade (top names cohort)",
      "Decade",
      "Individuals",
      { height: Math.min(480, 120 + decades.length * 28) },
    ),
  );
}
