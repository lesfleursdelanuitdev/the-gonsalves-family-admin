/** Shared Plotly chart builders for admin analytics (dashboard + list views). */
import type { Data, Layout } from "plotly.js";

export const ANALYTICS_BAR = "#5b9274";
export const ANALYTICS_MUTED_AXIS = "rgba(232, 230, 227, 0.65)";

/** Distinct slice colors for small categorical pies (e.g. sex). */
const PIE_SLICE_COLORS = ["#5b9274", "#4a7c9e", "#a67c52", "#7a6b9e", "#5a8a8a", "#8b6b7a"];

export function pieChart(
  labels: string[],
  values: number[],
  title: string,
): { data: Data[]; layout: Partial<Layout> } {
  const colors = labels.map((_, i) => PIE_SLICE_COLORS[i % PIE_SLICE_COLORS.length]);
  return {
    data: [
      {
        type: "pie",
        labels,
        values,
        marker: { colors },
        textinfo: "label+percent",
        hovertemplate: "%{label}: %{value} (%{percent})<extra></extra>",
      },
    ],
    layout: {
      title: { text: title, font: { size: 14 } },
      margin: { l: 16, r: 16, t: 44, b: 24 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
      showlegend: true,
      legend: { orientation: "h", yanchor: "top", y: -0.08 },
      height: 360,
    },
  };
}

export function horizontalBarChart(
  labels: string[],
  values: number[],
  title: string,
): { data: Data[]; layout: Partial<Layout> } {
  const pairs = labels.map((l, i) => ({ l, v: values[i] ?? 0 }));
  pairs.sort((a, b) => a.v - b.v);
  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: pairs.map((p) => p.v),
        y: pairs.map((p) => p.l),
        marker: { color: ANALYTICS_BAR },
      },
    ],
    layout: {
      title: { text: title, font: { size: 14 } },
      margin: { l: 12, r: 16, t: 44, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
      xaxis: { title: { text: "Count" }, gridcolor: "rgba(255,255,255,0.06)" },
      yaxis: { automargin: true },
      height: Math.min(420, 120 + pairs.length * 22),
    },
  };
}

export function verticalBarChart(
  categories: string[],
  values: number[],
  title: string,
  xTitle: string,
  yTitle = "Count",
  opts?: { height?: number },
): { data: Data[]; layout: Partial<Layout> } {
  const height = opts?.height ?? 340;
  return {
    data: [
      {
        type: "bar",
        x: categories,
        y: values,
        marker: { color: ANALYTICS_BAR },
      },
    ],
    layout: {
      title: { text: title, font: { size: 14 } },
      margin: { l: 48, r: 16, t: 44, b: 72 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
      xaxis: {
        title: { text: xTitle },
        tickangle: -35,
        automargin: true,
        gridcolor: "rgba(255,255,255,0.06)",
      },
      yaxis: { title: { text: yTitle }, gridcolor: "rgba(255,255,255,0.06)" },
      height,
    },
  };
}

/**
 * Gantt-style chart showing the date span of each lineage as a horizontal bar.
 * Lineages without both year bounds are omitted.
 */
export function lineageDateSpansChart(
  lineages: { name: string; earliestYear: number; latestYear: number }[],
): { data: Data[]; layout: Partial<Layout> } {
  // Sort by earliest year so oldest lineages appear at the bottom
  const sorted = [...lineages].sort((a, b) => a.earliestYear - b.earliestYear);
  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: sorted.map((l) => l.latestYear - l.earliestYear + 1),
        y: sorted.map((l) => l.name),
        // base is valid Plotly but missing from TS types
        ...(({ base: sorted.map((l) => l.earliestYear) }) as object),
        marker: { color: ANALYTICS_BAR, opacity: 0.85 },
        hovertemplate: "%{y}: %{base}–%{customdata}<extra></extra>",
        customdata: sorted.map((l) => l.latestYear),
      } as Data,
    ],
    layout: {
      title: { text: "Date span by lineage", font: { size: 14 } },
      margin: { l: 12, r: 16, t: 44, b: 48 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
      xaxis: {
        title: { text: "Year" },
        gridcolor: "rgba(255,255,255,0.06)",
      },
      yaxis: { automargin: true },
      height: Math.min(480, 120 + sorted.length * 24),
    },
  };
}
