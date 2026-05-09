/** Plotly specs for admin GEDCOM media analytics (aligned with statistics-test / research API). */
import type { Data, Layout } from "plotly.js";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { ANALYTICS_MUTED_AXIS, horizontalBarChart } from "./analytics-plotly-charts";

const PIE_SLICE_OUTLINE = { color: "rgba(255,255,255,0.55)", width: 1 } as const;

const PIE_SLICE_PALETTE = [
  "#3d5a4a",
  "#6b8cae",
  "#8b5a6b",
  "#c4a574",
  "#4a6fa5",
  "#7c9885",
  "#9b6b9e",
  "#5c7570",
  "#b8956a",
  "#6e7c8f",
  "#8f6b5c",
  "#5b7d8f",
];

const PIE_COLOR_TREAT_AS_MISSING = new Set(
  ["", "#6B7280", "#64748B", "#9CA3AF", "#94A3B8", "#A1A1AA", "#78716C", "#737373"].map((c) => c.toUpperCase()),
);

function normalizeHexColor(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/i.test(t) && t.length === 4) {
    const r = t[1];
    const g = t[2];
    const b = t[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function pieColorsFromOptionalHex(preferred: (string | null | undefined)[]): string[] {
  const used = new Set<string>();
  return preferred.map((raw, i) => {
    const hex = normalizeHexColor(raw);
    if (hex && !PIE_COLOR_TREAT_AS_MISSING.has(hex) && !used.has(hex)) {
      used.add(hex);
      return hex;
    }
    let idx = i;
    let guard = 0;
    while (guard < PIE_SLICE_PALETTE.length + 5) {
      const c = PIE_SLICE_PALETTE[idx % PIE_SLICE_PALETTE.length];
      if (!used.has(c)) {
        used.add(c);
        return c;
      }
      idx += 1;
      guard += 1;
    }
    const fallback = PIE_SLICE_PALETTE[i % PIE_SLICE_PALETTE.length];
    used.add(fallback);
    return fallback;
  });
}

function truncateChartLabel(raw: string, maxLen = 52): string {
  const s = raw.trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function abbreviateDisplayNameForChart(name: string, maxLen = 22): string {
  const s = stripSlashesFromName(name).replace(/\s+/g, " ").trim();
  if (!s) return "—";
  if (s.length <= maxLen) return s;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return truncateChartLabel(parts[0]!, maxLen);
  if (parts.length === 2) return truncateChartLabel(`${parts[0]} ${parts[1]}`, maxLen);
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const letter = first.slice(0, 1).toUpperCase();
  const compact = `${letter}. ${last}`;
  return truncateChartLabel(compact, maxLen);
}

function formatFamilyOfPartnerLabelChart(label: string | undefined, fallbackId: string): string {
  const raw = (label ?? "").trim();
  if (!raw) return truncateChartLabel(`Fam ${fallbackId}`, 28);
  const prefix = "Family of ";
  if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) {
    return truncateChartLabel(raw, 34);
  }
  const body = raw.slice(prefix.length).trim();
  const joint = /\s+and\s+/i;
  if (joint.test(body)) {
    const idx = body.search(joint);
    const a = stripSlashesFromName(body.slice(0, idx).trim()) || body.slice(0, idx).trim();
    const b = stripSlashesFromName(body.slice(idx).replace(/^\s+and\s+/i, "").trim()) || "";
    const sa = abbreviateDisplayNameForChart(a, 15);
    const sb = abbreviateDisplayNameForChart(b, 15);
    return truncateChartLabel(`${sa} · ${sb}`, 34);
  }
  const one = abbreviateDisplayNameForChart(stripSlashesFromName(body) || body, 30);
  return truncateChartLabel(one, 34);
}

const GEDCOM_DATE_TYPE_LABELS: Record<string, string> = {
  EXACT: "Exact",
  ABOUT: "About",
  BEFORE: "Before",
  AFTER: "After",
  BETWEEN: "Between",
  CALCULATED: "Calculated",
  ESTIMATED: "Estimated",
  FROM_TO: "From / to",
  UNKNOWN: "Unknown",
};

function formatDateTypeLabel(raw: string | undefined): string {
  const k = (raw ?? "").trim().toUpperCase();
  return GEDCOM_DATE_TYPE_LABELS[k] ?? (raw ? raw.replace(/_/g, " ") : "—");
}

function pieLayoutMediaTags(): Partial<Layout> {
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

/** App tags on GEDCOM media (statistics-test parity). */
export function mediaTagPie(rows: Array<{ name?: unknown; color?: unknown; tag_count?: unknown }>): {
  data: Data[];
  layout: Partial<Layout>;
} {
  const list = rows ?? [];
  if (list.length === 0) {
    return {
      data: [
        {
          type: "pie",
          labels: ["No tags on media"],
          values: [1],
          marker: { colors: ["#e5e5e5"] },
          textinfo: "label",
        },
      ],
      layout: pieLayoutMediaTags(),
    };
  }

  const colors = pieColorsFromOptionalHex(list.map((r) => (r.color != null ? String(r.color) : undefined)));

  return {
    data: [
      {
        type: "pie",
        labels: list.map((r) => String(r.name ?? "—")),
        values: list.map((r) => (typeof r.tag_count === "number" ? r.tag_count : Number(r.tag_count) || 0)),
        marker: { colors, line: PIE_SLICE_OUTLINE },
        textinfo: "label+percent",
        hovertemplate: "%{label}<br>assignments: %{value}<br>%{percent}<extra></extra>",
      },
    ],
    layout: pieLayoutMediaTags(),
  };
}

export function mediaTopPlacesChart(
  rows: Array<{ place_id?: unknown; label?: unknown; country?: unknown; link_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const labels = rows.map((r) => {
    const base = truncateChartLabel(String(r.label ?? r.place_id ?? "—"), 26);
    const c = String(r.country ?? "").trim();
    return c ? truncateChartLabel(`${base} (${c})`, 36) : base;
  });
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      labels,
      rows.map((r) => (typeof r.link_count === "number" ? r.link_count : Number(r.link_count) || 0)),
      "Media ↔ place links",
    ),
  );
}

export function mediaTopDatesChart(
  rows: Array<{ date_id?: unknown; label?: unknown; date_type?: unknown; link_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  const labels = rows.map((r) => {
    const base = truncateChartLabel(String(r.label ?? r.date_id ?? "—"), 22);
    const q = formatDateTypeLabel(String(r.date_type ?? ""));
    return truncateChartLabel(`${base} (${q})`, 36);
  });
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      labels,
      rows.map((r) => (typeof r.link_count === "number" ? r.link_count : Number(r.link_count) || 0)),
      "Media ↔ date links",
    ),
  );
}

export function mediaTopIndividualsChart(
  rows: Array<{ individual_id?: unknown; full_name?: unknown; media_link_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => {
        const name = stripSlashesFromName(String(r.full_name ?? "")).trim();
        return abbreviateDisplayNameForChart(name || String(r.individual_id ?? "—"), 22);
      }),
      rows.map((r) =>
        typeof r.media_link_count === "number" ? r.media_link_count : Number(r.media_link_count) || 0,
      ),
      "Links per person",
    ),
  );
}

export function mediaTopFamiliesChart(
  rows: Array<{ family_id?: unknown; xref?: unknown; label?: unknown; media_link_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => formatFamilyOfPartnerLabelChart(String(r.label ?? ""), String(r.xref ?? r.family_id ?? "—"))),
      rows.map((r) =>
        typeof r.media_link_count === "number" ? r.media_link_count : Number(r.media_link_count) || 0,
      ),
      "Links per family",
    ),
  );
}

export function mediaTopEventsChart(
  rows: Array<{ event_id?: unknown; label?: unknown; media_link_count?: unknown }>,
): { data: Data[]; layout: Partial<Layout> } {
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      rows.map((r) => truncateChartLabel(String(r.label ?? r.event_id ?? "—"), 34)),
      rows.map((r) =>
        typeof r.media_link_count === "number" ? r.media_link_count : Number(r.media_link_count) || 0,
      ),
      "Links per event",
    ),
  );
}
