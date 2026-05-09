/** Plotly specs for admin individuals analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { ANALYTICS_MUTED_AXIS } from "./analytics-plotly-charts";

const PIE_SLICE_OUTLINE = { color: "rgba(255,255,255,0.55)", width: 1 } as const;

const SEX_LIVING_SEGMENTS: {
  key: "living_male" | "dead_male" | "living_female" | "dead_female" | "living_unknown" | "dead_unknown";
  label: string;
  color: string;
}[] = [
  { key: "living_male", label: "Living · male", color: "#6b9e88" },
  { key: "dead_male", label: "Dead · male", color: "#3d5a4a" },
  { key: "living_female", label: "Living · female", color: "#d4a5bc" },
  { key: "dead_female", label: "Dead · female", color: "#8b5a6b" },
  { key: "living_unknown", label: "Living · unknown", color: "#c5cbc2" },
  { key: "dead_unknown", label: "Dead · unknown", color: "#7c8478" },
];

function pieLayoutSex(): Partial<Layout> {
  return {
    margin: { l: 28, r: 28, t: 72, b: 88 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: ANALYTICS_MUTED_AXIS, size: 11 },
    showlegend: true,
    legend: { orientation: "h", y: -0.14, yanchor: "top" },
    height: 420,
  };
}

function sexLivingPie(data: Record<string, unknown> | null | undefined): { data: Data[]; layout: Partial<Layout> } {
  const pairs = SEX_LIVING_SEGMENTS.map((s) => ({
    label: s.label,
    value: Number(data?.[s.key]) || 0,
    color: s.color,
  })).filter((p) => p.value > 0);

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
    layout: {
      title: { text: "Sex · living / deceased", font: { size: 14 } },
      ...pieLayoutSex(),
    },
  };
}

function sexPieFallback(
  rows: Array<{ sex?: unknown; count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const labels = rows.map((r) => (String(r.sex ?? "") === "U" ? "Unknown" : String(r.sex ?? "—")));
  const values = rows.map((r) => (typeof r.count === "number" ? r.count : Number(r.count) || 0));
  const colors = labels.map((l) => (l === "M" ? "#3d5a4a" : l === "F" ? "#8b5a6b" : "#7c8478"));
  return {
    data: [
      {
        type: "pie",
        labels: labels.length ? labels : ["No data"],
        values: values.length ? values : [1],
        marker: { colors: labels.length ? colors : ["#ccc"], line: PIE_SLICE_OUTLINE },
        textinfo: "label+percent",
        hovertemplate: "%{label}<br>count: %{value}<br>%{percent}<extra></extra>",
      },
    ],
    layout: {
      title: { text: "Sex (by code)", font: { size: 14 } },
      ...pieLayoutSex(),
    },
  };
}

/** Prefer `sex_by_living` (six-way); else fall back to legacy `by_sex` rows (statistics-test parity). */
export function individualsSexDistributionPie(payload: {
  sex_by_living?: Record<string, unknown> | null;
  by_sex?: unknown;
}): { data: Data[]; layout: Partial<Layout> } {
  const sl = payload.sex_by_living;
  if (sl != null && typeof sl === "object") {
    const total = SEX_LIVING_SEGMENTS.reduce((acc, s) => acc + (Number((sl as Record<string, unknown>)[s.key]) || 0), 0);
    if (total > 0) return sexLivingPie(sl as Record<string, unknown>);
  }
  const rows = Array.isArray(payload.by_sex)
    ? (payload.by_sex as Array<{ sex?: unknown; count?: unknown }>)
    : [];
  return sexPieFallback(rows);
}

/** True when every numeric value in bar/pie traces is zero (or empty). */
export function isPlotlySpecEmpty(spec: { data: Data[]; layout: Partial<Layout> }): boolean {
  const traces = spec.data ?? [];
  if (traces.length === 0) return true;
  for (const t of traces) {
    const tr = t as {
      type?: string;
      labels?: string[];
      values?: unknown[];
      x?: unknown[];
      y?: unknown[];
      orientation?: string;
    };
    if (tr.type === "pie") {
      const values = (tr.values ?? []).map((v) => Number(v) || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum <= 0) continue;
      const labels = tr.labels ?? [];
      const lab = labels.length === 1 ? String(labels[0]).trim() : "";
      const placeholderSingleSlice =
        values.length === 1 &&
        Math.abs(values[0]! - 1) < 1e-9 &&
        labels.length === 1 &&
        (/^no\b/i.test(lab) || /^nothing\b/i.test(lab));
      if (placeholderSingleSlice) continue;
      return false;
    }
    if (tr.type === "bar") {
      const nums =
        tr.orientation === "h"
          ? (tr.x ?? []).map((v) => Number(v) || 0)
          : (tr.y ?? []).map((v) => Number(v) || 0);
      if (nums.some((n) => n > 0)) return false;
    }
  }
  return true;
}
