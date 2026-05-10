"use client";

import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  adminChartLayoutBase,
  adminPlotlyConfig,
  branchPieColors,
  DASHBOARD_CHART_HEIGHT,
} from "@/lib/plotly/admin-chart-theme";

const H = DASHBOARD_CHART_HEIGHT;

export function InsightsSurnameBarPlot({ names, counts }: { names: string[]; counts: number[] }) {
  if (names.length === 0) {
    return <p className="py-10 text-center text-xs text-muted-foreground">No surname data yet.</p>;
  }

  const data: Data[] = [
    {
      type: "bar",
      orientation: "h",
      x: counts,
      y: names,
      marker: {
        color: "#66a87a",
        line: { color: "rgba(255,255,255,0.12)", width: 1 },
      },
      hovertemplate: "%{y}<br>%{x} people<extra></extra>",
    },
  ];

  const layout: Partial<Layout> = {
    ...adminChartLayoutBase,
    height: H,
    margin: { ...adminChartLayoutBase.margin, l: Math.max(72, ...names.map((n) => n.length * 5 + 28)) },
    yaxis: { ...adminChartLayoutBase.yaxis, autorange: "reversed" },
  };

  return <PlotlyChart data={data} layout={layout} config={adminPlotlyConfig} minHeight={H} />;
}

export function InsightsBranchDonutPlot({
  labels,
  values,
  centerTotal,
}: {
  labels: string[];
  values: number[];
  centerTotal: string;
}) {
  if (labels.length === 0 || values.length === 0) {
    return <p className="py-10 text-center text-xs text-muted-foreground">Not enough surname data yet.</p>;
  }

  const colors = labels.map((_, i) => branchPieColors[i % branchPieColors.length]!);

  const data: Data[] = [
    {
      type: "pie",
      hole: 0.62,
      labels,
      values,
      marker: { colors },
      textinfo: "none",
      hovertemplate: "%{label}<br>%{value} individuals<br>%{percent}<extra></extra>",
    },
  ];

  const layout: Partial<Layout> = {
    ...adminChartLayoutBase,
    height: H,
    margin: { l: 10, r: 10, t: 8, b: 10 },
    annotations: [
      {
        x: 0.5,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        text: `${centerTotal}<br><span style="font-size:11px;color:#9ca89a">Individuals</span>`,
        showarrow: false,
        font: { color: "#e7ece3", size: 18 },
      },
    ],
  };

  return <PlotlyChart data={data} layout={layout} config={adminPlotlyConfig} minHeight={H} />;
}
