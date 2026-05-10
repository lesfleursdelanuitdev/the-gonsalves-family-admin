"use client";

import { useMemo, useState } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import type { DashboardHeatmapDay } from "@/lib/admin/admin-dashboard-snapshot";
import {
  adminChartLayoutBase,
  adminPlotlyConfig,
  DASHBOARD_CHART_HEIGHT,
} from "@/lib/plotly/admin-chart-theme";

const RANGES: ReadonlyArray<{ id: string; label: string; days: number }> = [
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "42", label: "Last 6 weeks", days: 42 },
  { id: "14", label: "Last 2 weeks", days: 14 },
];

const H = DASHBOARD_CHART_HEIGHT;

function buildWeekMatrix(days: DashboardHeatmapDay[]) {
  const cols: DashboardHeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    cols.push(days.slice(i, i + 7));
  }
  const nx = cols.length;
  const z: (number | null)[][] = [];
  const customdata: (string | null)[][] = [];
  for (let row = 0; row < 7; row += 1) {
    const zr: (number | null)[] = [];
    const cr: (string | null)[] = [];
    for (let col = 0; col < nx; col += 1) {
      const cell = cols[col]?.[row];
      zr.push(cell != null ? cell.count : null);
      cr.push(cell != null ? cell.date : null);
    }
    z.push(zr);
    customdata.push(cr);
  }
  const x = cols.map((_, i) => `W${i + 1}`);
  return { x, z, customdata, numWeeks: nx };
}

type Props = {
  days: DashboardHeatmapDay[];
  isLoading: boolean;
};

export function DashboardActivityHeatmap({ days, isLoading }: Props) {
  const [rangeId, setRangeId] = useState("90");
  const rangeDays = RANGES.find((r) => r.id === rangeId)?.days ?? 90;

  const slice = useMemo(() => (Array.isArray(days) ? days : []).slice(-rangeDays), [days, rangeDays]);

  const { x, z, customdata, numWeeks } = useMemo(() => buildWeekMatrix(slice), [slice]);

  const plotMinWidth = useMemo(() => Math.max(320, numWeeks * 18 + 80), [numWeeks]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
        <div className="skeleton mb-4 h-5 w-40 rounded" />
        <div className="skeleton h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (slice.length === 0 || numWeeks === 0) {
    return (
      <section aria-labelledby="heatmap-heading" className="rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
        <div>
          <h2 id="heatmap-heading" className="text-sm font-semibold text-base-content">
            Activity heatmap
          </h2>
          <p className="mt-0.5 text-xs text-base-content/55">Changelog intensity by day (UTC).</p>
        </div>
        <p className="mt-6 py-6 text-center text-xs text-muted-foreground">No activity data for this range yet.</p>
      </section>
    );
  }

  const data: Data[] = [
    {
      type: "heatmap",
      x,
      y: ["1", "2", "3", "4", "5", "6", "7"],
      z,
      customdata,
      colorscale: [
        [0, "rgba(255,255,255,0.05)"],
        [0.25, "#294d34"],
        [0.5, "#3f7c50"],
        [0.75, "#66a87a"],
        [1, "#9bd49b"],
      ],
      showscale: false,
      hovertemplate: "%{customdata}<br>%{z} edits<extra></extra>",
      xgap: 1,
      ygap: 1,
    },
  ];

  const layout: Partial<Layout> = {
    ...adminChartLayoutBase,
    height: H,
    margin: { l: 28, r: 10, t: 8, b: 28 },
    yaxis: {
      ...adminChartLayoutBase.yaxis,
      title: { text: "Day in week", font: { size: 10, color: "#6b7569" } },
      showticklabels: true,
    },
    xaxis: {
      ...adminChartLayoutBase.xaxis,
      title: { text: "Week column (oldest → newest)", font: { size: 10, color: "#6b7569" } },
    },
  };

  return (
    <section aria-labelledby="heatmap-heading" className="rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="heatmap-heading" className="text-sm font-semibold text-base-content">
            Activity heatmap
          </h2>
          <p className="mt-0.5 text-xs text-base-content/55">Changelog intensity by day (UTC), grouped in 7-day columns.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-base-content/70">
          <span className="sr-only">Date range</span>
          <select
            className="select select-bordered select-xs max-w-[11rem] border-base-content/15 bg-base-100/40"
            value={rangeId}
            onChange={(e) => setRangeId(e.target.value)}
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 min-h-[260px] w-full overflow-x-auto pb-1">
        <div style={{ minWidth: plotMinWidth }}>
          <PlotlyChart data={data} layout={layout} config={adminPlotlyConfig} minHeight={H} />
        </div>
      </div>

      <div className="mt-2 text-[10px] text-base-content/45">
        <span>Rows are consecutive days within each week column; hover shows the calendar date.</span>
      </div>
    </section>
  );
}
