/** Plotly specs for admin open-questions analytics (`/analytics/open-questions`). */
import type { Data, Layout } from "plotly.js";
import { horizontalBarChart, pieChart } from "./analytics-plotly-charts";

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

function truncateLabel(raw: string, max = 72): string {
  const s = raw.trim() || "—";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function openQuestionsResolutionPie(summary: {
  resolved?: unknown;
  unresolved?: unknown;
}): { data: Data[]; layout: Partial<Layout> } {
  const resolved = typeof summary.resolved === "number" ? summary.resolved : Number(summary.resolved) || 0;
  const unresolved = typeof summary.unresolved === "number" ? summary.unresolved : Number(summary.unresolved) || 0;
  return withoutPlotlyOuterTitle(pieChart(["Resolved", "Unresolved"], [resolved, unresolved], "Resolution status"));
}

export function openQuestionsTopIndividualsChart(
  rows: Array<{ full_name?: unknown; question_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.full_name ?? "—")),
    n: typeof r.question_link_count === "number" ? r.question_link_count : Number(r.question_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Individuals — question link count",
    ),
  );
}

export function openQuestionsTopMediaChart(
  rows: Array<{ label?: unknown; question_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.question_link_count === "number" ? r.question_link_count : Number(r.question_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Media — question link count",
    ),
  );
}

export function openQuestionsTopFamiliesChart(
  rows: Array<{ label?: unknown; question_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.question_link_count === "number" ? r.question_link_count : Number(r.question_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Families — question link count",
    ),
  );
}

export function openQuestionsTopEventsChart(
  rows: Array<{ label?: unknown; question_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.question_link_count === "number" ? r.question_link_count : Number(r.question_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Events — question link count",
    ),
  );
}
