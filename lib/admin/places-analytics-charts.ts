/** Plotly specs for admin places analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { ANALYTICS_MUTED_AXIS, horizontalBarChart } from "./analytics-plotly-charts";

const PIE_SLICE_OUTLINE = { color: "rgba(255,255,255,0.55)", width: 1 } as const;

function truncateChartLabel(raw: string, maxLen = 52): string {
  const s = raw.trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

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

function pieLayoutReference(): Partial<Layout> {
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

/** Attachment counts by record type (statistics-test parity). */
export function placesReferencePie(
  rc: Record<string, unknown> | undefined,
): { data: Data[]; layout: Partial<Layout> } {
  const segments: { label: string; value: number; color: string }[] = [
    { label: "Birth", value: Number(rc?.birth_place_links) || 0, color: "#3d5a4a" },
    { label: "Death", value: Number(rc?.death_place_links) || 0, color: "#5c7a6a" },
    { label: "Marriage", value: Number(rc?.marriage_place_links) || 0, color: "#6b8cae" },
    { label: "Divorce", value: Number(rc?.divorce_place_links) || 0, color: "#9ca3af" },
    { label: "Events", value: Number(rc?.event_place_links) || 0, color: "#8b5a6b" },
    { label: "Media links", value: Number(rc?.media_place_links) || 0, color: "#c4a574" },
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
      layout: pieLayoutReference(),
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
    layout: pieLayoutReference(),
  };
}

export function placesTopReferencedChart(
  rows: Array<{ place_id?: unknown; label?: unknown; country?: unknown; reference_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 22);
  const labels = sliced.map((r) => {
    const base = truncateChartLabel(String(r.label ?? r.place_id ?? "—"), 26);
    const c = String(r.country ?? "").trim();
    return c ? truncateChartLabel(`${base} (${c})`, 36) : base;
  });
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      labels,
      sliced.map((r) =>
        typeof r.reference_count === "number" ? r.reference_count : Number(r.reference_count) || 0,
      ),
      "References",
    ),
  );
}

export function placesCountryDistributionChart(
  rows: Array<{ country?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 24);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.country ?? "—")),
      sliced.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Places by country",
    ),
  );
}

export function placesStateDistributionChart(
  rows: Array<{ state?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 24);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.state ?? "—")),
      sliced.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Places by state / region",
    ),
  );
}
