"use client";

import { lazy, Suspense, type ComponentType, type CSSProperties } from "react";
import type { PlotParams } from "react-plotly.js";
import type * as PlotlyJS from "plotly.js";

const PlotLazy = lazy(async () => {
  const mod = await import("react-plotly.js");
  const C = mod.default;
  if (C == null) {
    throw new Error("react-plotly.js: default export is missing");
  }
  return { default: C as ComponentType<PlotParams> };
});

export type PlotlyChartProps = {
  data: PlotlyJS.Data[];
  layout?: Partial<PlotlyJS.Layout>;
  config?: Partial<PlotlyJS.Config>;
  /** Applied to the outer wrapper ``div``. Also used as default ``layout.height`` when omitted. */
  minHeight?: number;
  /** Applied to the outer wrapper ``div``. */
  className?: string;
  style?: CSSProperties;
};

function PlotlyFallback() {
  return <div className="skeleton h-[min(360px,70vh)] w-full rounded-lg bg-base-content/[0.06]" aria-hidden />;
}

/**
 * Next.js–safe Plotly wrapper (loads on the client only).
 *
 * Uses `React.lazy` instead of `next/dynamic` so Webpack does not run Plotly through
 * Next’s loadable wrapper (which has triggered `undefined.split` errors in some setups).
 */
export function PlotlyChart({ data, layout, config, minHeight = 360, className, style }: PlotlyChartProps) {
  const height = typeof layout?.height === "number" ? layout.height : minHeight;
  const mergedLayout = { ...layout, height } as Partial<PlotlyJS.Layout>;
  return (
    <div className={className} style={{ minHeight: height, width: "100%", ...style }}>
      <Suspense fallback={<PlotlyFallback />}>
        <PlotLazy
          data={data}
          layout={mergedLayout}
          config={config}
          useResizeHandler
          style={{ width: "100%", height: "100%", minHeight: height }}
        />
      </Suspense>
    </div>
  );
}
