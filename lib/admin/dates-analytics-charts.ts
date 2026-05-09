/** Plotly specs for admin dates analytics (aligned with research API `/analytics/dates`). */
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

export function datesByDateTypeChart(
  rows: Array<{ date_type?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const cleaned = rows.map((r) => ({
    label: r.date_type != null ? String(r.date_type) : "—",
    count: typeof r.count === "number" ? r.count : Number(r.count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    verticalBarChart(
      cleaned.map((r) => r.label),
      cleaned.map((r) => r.count),
      "GEDCOM date type (qualifier) mix",
      "Date type",
      "Date records",
      { height: Math.min(440, 120 + cleaned.length * 28) },
    ),
  );
}

export function datesCalendarDistributionChart(
  rows: Array<{ calendar?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => (r.calendar != null ? String(r.calendar) : "—")),
      rows.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Calendar tag distribution",
    ),
  );
}

export function datesYearByDecadeChart(
  rows: Array<{ decade?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const parsed = rows
    .map((r) => {
      const d = typeof r.decade === "number" ? r.decade : Number(r.decade);
      const c = typeof r.count === "number" ? r.count : Number(r.count) || 0;
      return { decade: d, count: c };
    })
    .filter((x) => Number.isFinite(x.decade));
  parsed.sort((a, b) => a.decade - b.decade);
  if (parsed.length === 0) {
    return withoutPlotlyOuterTitle(
      verticalBarChart(
        [],
        [],
        "Parsed year by decade",
        "Decade",
        "Date records",
        { height: 280 },
      ),
    );
  }
  const labels = parsed.map((p) => `${Math.trunc(p.decade)}s`);
  const values = parsed.map((p) => p.count);
  return withoutPlotlyOuterTitle(
    verticalBarChart(
      labels,
      values,
      "Parsed year by decade",
      "Decade",
      "Date records with year",
      { height: Math.min(520, 120 + labels.length * 26) },
    ),
  );
}

/** Most-referenced canonical date rows (union of individual / family / event / media links). */
export function datesTopReferencedChart(
  rows: Array<{ label?: unknown; reference_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label:
      r.label != null && String(r.label).trim() !== ""
        ? String(r.label).trim()
        : "—",
    n: typeof r.reference_count === "number" ? r.reference_count : Number(r.reference_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Most-referenced dates",
    ),
  );
}
