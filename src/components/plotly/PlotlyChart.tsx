"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";
import type { CSSProperties, ComponentType } from "react";
import type * as PlotlyJS from "plotly.js";

const PlotDynamic = dynamic(async () => (await import("react-plotly.js")).default, {
  ssr: false,
}) as ComponentType<PlotParams>;

export type PlotlyChartProps = {
  data: PlotlyJS.Data[];
  layout?: Partial<PlotlyJS.Layout>;
  config?: Partial<PlotlyJS.Config>;
  /** Applied to the outer wrapper ``div``. */
  className?: string;
  style?: CSSProperties;
};

/**
 * Next.js–safe Plotly wrapper (loads on the client only).
 */
export function PlotlyChart({ data, layout, config, className, style }: PlotlyChartProps) {
  return (
    <div className={className} style={{ minHeight: 360, width: "100%", ...style }}>
      <PlotDynamic
        data={data}
        layout={layout ?? {}}
        config={config}
        useResizeHandler
        style={{ width: "100%", height: "100%", minHeight: 360 }}
      />
    </div>
  );
}
