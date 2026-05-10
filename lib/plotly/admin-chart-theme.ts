import type { Config, Layout } from "plotly.js";

/** Shared dark layout for admin dashboard Plotly charts (transparent on card backgrounds). */
export const adminChartLayoutBase: Partial<Layout> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#c9d3c7", family: "Inter, system-ui, sans-serif", size: 11 },
  margin: { l: 44, r: 16, t: 8, b: 36 },
  xaxis: {
    gridcolor: "rgba(255,255,255,0.06)",
    zerolinecolor: "rgba(255,255,255,0.08)",
    tickfont: { color: "#9ca89a" },
  },
  yaxis: {
    gridcolor: "rgba(255,255,255,0.04)",
    tickfont: { color: "#9ca89a" },
  },
  showlegend: false,
};

export const adminPlotlyConfig: Partial<Config> = {
  displayModeBar: false,
  responsive: true,
};

export const DASHBOARD_CHART_HEIGHT = 260;

export const branchPieColors = [
  "#66a87a",
  "#4f8f68",
  "#d7b45f",
  "#b9685f",
  "#7d6aa8",
  "#555f58",
  "#4a6b52",
  "#8a7a5c",
];
