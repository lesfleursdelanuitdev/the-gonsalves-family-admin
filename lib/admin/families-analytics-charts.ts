/** Plotly specs for admin families analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { ANALYTICS_MUTED_AXIS, horizontalBarChart, verticalBarChart } from "./analytics-plotly-charts";

const PIE_SLICE_OUTLINE = { color: "rgba(255,255,255,0.55)", width: 1 } as const;

/** Card already has an `<h3>`; inner Plotly title duplicates it and wastes vertical space. */
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

const PARTNER_MIX_SEGMENTS: {
  key: "both_partners" | "husband_only" | "wife_only" | "no_partner_record";
  label: string;
  color: string;
}[] = [
  { key: "both_partners", label: "Both partners", color: "#3d5a4a" },
  { key: "husband_only", label: "Father only", color: "#6b9e88" },
  { key: "wife_only", label: "Mother only", color: "#8b5a6b" },
  { key: "no_partner_record", label: "No spouse linked", color: "#a8a29e" },
];

/** No Plotly title: parent card heading is the caption (duplicating title overlaps slice labels). */
function pieLayoutPartners(): Partial<Layout> {
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

/** Partner attachment mix on gedcom_families_v2 (statistics-test parity). */
export function familiesPartnerPie(summary: Record<string, unknown> | undefined): {
  data: Data[];
  layout: Partial<Layout>;
} {
  const pairs = PARTNER_MIX_SEGMENTS.map((s) => ({
    label: s.label,
    value: Number(summary?.[s.key]) || 0,
    color: s.color,
  })).filter((p) => p.value > 0);

  if (pairs.length === 0) {
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
      layout: pieLayoutPartners(),
    };
  }

  return {
    data: [
      {
        type: "pie",
        labels: pairs.map((p) => p.label),
        values: pairs.map((p) => p.value),
        marker: { colors: pairs.map((p) => p.color), line: PIE_SLICE_OUTLINE },
        textinfo: "label+percent",
        hovertemplate: "%{label}<br>count: %{value}<br>%{percent}<extra></extra>",
      },
    ],
    layout: pieLayoutPartners(),
  };
}

function decadeChartLabel(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n) && raw.trim() !== "") return `${Math.trunc(n)}s`;
  return raw;
}

export function familiesMarriageDecadeChart(
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
      "Marriages by decade",
      "Decade",
      "Families",
      { height: Math.min(520, 120 + Math.max(cleaned.length, 1) * 28) },
    ),
  );
}

export function familiesMarriageCountriesChart(
  rows: Array<{ country?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, 24);
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => String(r.country ?? "—")),
      sliced.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0)),
      "Marriages by country",
    ),
  );
}
