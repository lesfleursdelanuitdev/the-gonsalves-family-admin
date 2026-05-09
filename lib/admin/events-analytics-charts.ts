/** Plotly specs for admin events analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { ANALYTICS_MUTED_AXIS, horizontalBarChart, verticalBarChart } from "./analytics-plotly-charts";

const PIE_SLICE_OUTLINE = { color: "rgba(255,255,255,0.55)", width: 1 } as const;

function truncateChartLabel(raw: string, maxLen = 52): string {
  const s = raw.trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/** Card already has an `<h3>`; strip Plotly `layout.title` from shared bar builders. */
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

function pieLayoutOrigin(): Partial<Layout> {
  return {
    margin: { l: 28, r: 28, t: 16, b: 88 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
    showlegend: true,
    legend: { orientation: "h", y: -0.14, yanchor: "top" },
    height: 420,
  };
}

/** Standard vs custom vs unlinked catalog (statistics-test parity). */
export function eventsOriginPie(
  ob: Record<string, unknown> | undefined,
): { data: Data[]; layout: Partial<Layout> } {
  const standard = Number(ob?.standard_catalog_events) || 0;
  const custom = Number(ob?.custom_catalog_events) || 0;
  const unlinked = Number(ob?.unlinked_to_catalog) || 0;
  const segments: { label: string; value: number; color: string }[] = [
    { label: "Standard GEDCOM types", value: standard, color: "#3d5a4a" },
    { label: "Custom types", value: custom, color: "#8b5a6b" },
    { label: "Not linked to type catalog", value: unlinked, color: "#94a3b8" },
  ].filter((s) => s.value > 0);

  if (segments.length === 0) {
    return {
      data: [
        {
          type: "pie",
          labels: ["No data"],
          values: [1],
          marker: { colors: ["#e5e5e5"] },
          textinfo: "label",
        },
      ],
      layout: pieLayoutOrigin(),
    };
  }

  return {
    data: [
      {
        type: "pie",
        labels: segments.map((s) => s.label),
        values: segments.map((s) => s.value),
        marker: { colors: segments.map((s) => s.color), line: PIE_SLICE_OUTLINE },
        textinfo: "label+percent",
        hovertemplate: "%{label}<br>count: %{value}<br>%{percent}<extra></extra>",
      },
    ],
    layout: pieLayoutOrigin(),
  };
}

function decadeChartLabel(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n) && raw.trim() !== "") return `${Math.trunc(n)}s`;
  return raw;
}

export function eventsByTypeChart(rows: Array<Record<string, unknown>>): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 22);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) =>
        truncateChartLabel(String(r.label ?? r.tag ?? "—"), 36),
      ),
      sliced.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Event types",
    ),
  );
}

export function eventsYearDecadeChart(
  rows: Array<{ decade?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const cleaned = rows
    .map((r) => {
      const decade = r.decade;
      const count = r.count;
      return {
        label: decade != null ? String(decade) : "—",
        count: typeof count === "number" ? count : Number(count) || 0,
      };
    })
    .filter((r) => r.label !== "—" || r.count > 0);

  return withoutPlotlyOuterTitle(
    verticalBarChart(
      cleaned.map((r) => decadeChartLabel(r.label)),
      cleaned.map((r) => r.count),
      "Events by decade",
      "Decade",
      "Events",
      { height: Math.min(520, 120 + Math.max(cleaned.length, 1) * 28) },
    ),
  );
}

export function eventsCountryChart(
  rows: Array<{ country?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 24);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.country ?? "—")),
      sliced.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Events by country",
    ),
  );
}
