"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  horizontalBarChart,
  verticalBarChart,
  lineageDateSpansChart,
} from "@/lib/admin/analytics-plotly-charts";

const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatN(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatPct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function SummaryStat({
  label,
  value,
  sub,
  hint,
}: {
  label: string;
  value: unknown;
  sub?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold text-base-content">{formatN(value)}</p>
      {sub ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{sub}</p> : null}
      {hint && !sub ? <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatBlock({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-xl border border-base-content/10 bg-base-100/40 p-4 shadow-sm sm:p-5"
    >
      <h3 className="text-sm font-semibold tracking-tight text-base-content">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 min-w-0 overflow-x-auto">{children}</div>
    </section>
  );
}

type TopLineage = {
  name: string;
  size: number;
  earliestYear: number | null;
  latestYear: number | null;
};

type SizeBucket = { label: string; count: number };

export function AdminLineagesAnalyticsPanel({ data }: { data: unknown }) {
  if (!isRecord(data)) return null;

  const totalLineages = data.totalLineages as number | null;
  const totalMemberships = data.totalMemberships as number | null;
  const bridgeChildren = data.bridgeChildren as number | null;
  const earliestYear = data.earliestYear as number | null;
  const latestYear = data.latestYear as number | null;
  const topLineages = Array.isArray(data.topLineages)
    ? (data.topLineages as TopLineage[])
    : [];
  const sizeDistribution = Array.isArray(data.sizeDistribution)
    ? (data.sizeDistribution as SizeBucket[])
    : [];

  const dateSpan =
    earliestYear != null && latestYear != null
      ? `${earliestYear}–${latestYear}`
      : earliestYear != null
        ? `from ${earliestYear}`
        : latestYear != null
          ? `to ${latestYear}`
          : null;

  // Chart: top lineages by member count
  const sizeChartSpec: { data: Data[]; layout: Partial<Layout> } | null =
    topLineages.length > 0
      ? horizontalBarChart(
          topLineages.map((l) => l.name),
          topLineages.map((l) => l.size),
          "Members per lineage",
        )
      : null;

  // Chart: size distribution histogram
  const distChartSpec: { data: Data[]; layout: Partial<Layout> } | null =
    sizeDistribution.some((b) => b.count > 0)
      ? verticalBarChart(
          sizeDistribution.map((b) => b.label),
          sizeDistribution.map((b) => b.count),
          "Lineage size distribution",
          "Members",
          "Lineages",
          { height: 300 },
        )
      : null;

  // Chart: date spans per lineage (only those with both year bounds)
  const spannedLineages = topLineages
    .filter((l): l is TopLineage & { earliestYear: number; latestYear: number } =>
      l.earliestYear != null && l.latestYear != null && l.latestYear > l.earliestYear,
    )
    .slice(0, 15);
  const spanChartSpec: { data: Data[]; layout: Partial<Layout> } | null =
    spannedLineages.length > 0 ? lineageDateSpansChart(spannedLineages) : null;

  return (
    <div className="space-y-4">
      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <StatBlock id="lineages-summary" title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Lineages" value={totalLineages} />
          <SummaryStat
            label="Total memberships"
            value={totalMemberships}
            hint="Individuals × lineages they belong to"
          />
          <SummaryStat
            label="Bridge children"
            value={bridgeChildren}
            sub={
              bridgeChildren != null && totalMemberships
                ? formatPct(bridgeChildren, totalMemberships) + " of memberships"
                : undefined
            }
            hint="Individuals reachable from multiple surname lineages"
          />
          {dateSpan ? <SummaryStat label="Date span" value={dateSpan} /> : null}
        </div>
      </StatBlock>

      {/* ── Top lineages by size ──────────────────────────────────────────── */}
      {sizeChartSpec && (
        <StatBlock
          id="lineages-by-size"
          title="Top lineages by size"
          description="Member count for the largest lineages, sorted ascending."
        >
          <PlotlyChart
            data={sizeChartSpec.data}
            layout={sizeChartSpec.layout}
            config={PLOT_CONFIG}
          />
        </StatBlock>
      )}

      {/* ── Size distribution ─────────────────────────────────────────────── */}
      {distChartSpec && (
        <StatBlock
          id="lineages-size-dist"
          title="Lineage size distribution"
          description="How many lineages fall into each member-count range."
        >
          <PlotlyChart
            data={distChartSpec.data}
            layout={distChartSpec.layout}
            config={PLOT_CONFIG}
          />
        </StatBlock>
      )}

      {/* ── Date spans ────────────────────────────────────────────────────── */}
      {spanChartSpec && (
        <StatBlock
          id="lineages-date-spans"
          title="Date spans by lineage"
          description="The temporal range of each lineage from its earliest to latest recorded individual, oldest at the bottom."
        >
          <PlotlyChart
            data={spanChartSpec.data}
            layout={spanChartSpec.layout}
            config={PLOT_CONFIG}
          />
        </StatBlock>
      )}
    </div>
  );
}
