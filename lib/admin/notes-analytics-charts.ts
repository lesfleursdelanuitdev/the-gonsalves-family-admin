/** Plotly specs for admin GEDCOM notes analytics (`/analytics/notes`). */
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

export function notesJunctionRowsPie(linkCounts: Record<string, unknown> | undefined): {
  data: Data[];
  layout: Partial<Layout>;
} {
  const ind = typeof linkCounts?.individual_note_links === "number"
    ? linkCounts.individual_note_links
    : Number(linkCounts?.individual_note_links) || 0;
  const fam = typeof linkCounts?.family_note_links === "number"
    ? linkCounts.family_note_links
    : Number(linkCounts?.family_note_links) || 0;
  const ev = typeof linkCounts?.event_note_links === "number"
    ? linkCounts.event_note_links
    : Number(linkCounts?.event_note_links) || 0;
  const src = typeof linkCounts?.source_note_links === "number"
    ? linkCounts.source_note_links
    : Number(linkCounts?.source_note_links) || 0;
  return withoutPlotlyOuterTitle(
    pieChart(["Individual links", "Family links", "Event links", "Source links"], [ind, fam, ev, src], "Junction rows by target"),
  );
}

function noteRowLabel(r: { xref?: unknown; preview?: unknown }): string {
  const x = String(r.xref ?? "").trim();
  const p = String(r.preview ?? "—").trim() || "—";
  const base = x ? `@${x} · ${p}` : p;
  return truncateLabel(base, 80);
}

export function notesTopLinkedChart(
  rows: Array<{ xref?: unknown; preview?: unknown; link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: noteRowLabel(r),
    n: typeof r.link_count === "number" ? r.link_count : Number(r.link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Note records — total link count",
    ),
  );
}

export function notesTopIndividualsChart(
  rows: Array<{ full_name?: unknown; note_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.full_name ?? "—")),
    n: typeof r.note_link_count === "number" ? r.note_link_count : Number(r.note_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Individuals — note link count",
    ),
  );
}

export function notesTopFamiliesChart(
  rows: Array<{ label?: unknown; note_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.note_link_count === "number" ? r.note_link_count : Number(r.note_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Families — note link count",
    ),
  );
}

export function notesTopEventsChart(
  rows: Array<{ label?: unknown; note_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.note_link_count === "number" ? r.note_link_count : Number(r.note_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Events — note link count",
    ),
  );
}

export function notesTopSourcesChart(
  rows: Array<{ label?: unknown; note_link_count?: unknown }>,
  slice = 18,
): { data: Data[]; layout: Partial<Layout> } {
  const sliced = rows.slice(0, slice).map((r) => ({
    label: truncateLabel(String(r.label ?? "—")),
    n: typeof r.note_link_count === "number" ? r.note_link_count : Number(r.note_link_count) || 0,
  }));
  return withoutPlotlyOuterTitle(
    horizontalBarChart(
      sliced.map((r) => r.label),
      sliced.map((r) => r.n),
      "Sources — note link count",
    ),
  );
}
