"use client";

import { useId } from "react";
import { DashboardActivityHeatmap } from "@/components/admin/dashboard/DashboardActivityHeatmap";
import { InsightsBranchDonutPlot, InsightsSurnameBarPlot } from "@/components/admin/dashboard/DashboardInsightsCharts";
import type { DashboardHeatmapDay, DashboardInsightsPayload } from "@/lib/admin/admin-dashboard-snapshot";
import { cn } from "@/lib/utils";

type Props = {
  insights: DashboardInsightsPayload | null;
  individualsTotal: number;
  isLoading: boolean;
  heatmapDays: DashboardHeatmapDay[];
};

function BirthsSparkline({ points }: { points: { decade: number; count: number }[] | null | undefined }) {
  const gradId = useId().replace(/:/g, "");
  const list = (Array.isArray(points) ? points : []).filter(
    (p): p is { decade: number; count: number } =>
      p != null && typeof p === "object" && Number.isFinite(p.decade) && Number.isFinite(p.count),
  );
  if (list.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">No birth years yet.</p>;
  }

  const W = 320;
  const H = 160;
  const lPad = 32; // room for Y labels
  const rPad = 8;
  const tPad = 10;
  const bPad = 22; // room for X labels
  const plotW = W - lPad - rPad;
  const plotH = H - tPad - bPad;

  const rawMax = Math.max(1, ...list.map((p) => p.count));
  // Round up to a "nice" ceiling for the Y axis
  const niceMax = (() => {
    if (rawMax <= 10) return 10;
    if (rawMax <= 20) return 20;
    if (rawMax <= 50) return 50;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / mag) * mag;
  })();
  const yTicks = [0, Math.round(niceMax / 2), niceMax];

  const minDecade = list[0]!.decade;
  const maxDecade = list[list.length - 1]!.decade;
  const decadeSpan = Math.max(10, maxDecade - minDecade);

  const toX = (d: number) => lPad + ((d - minDecade) / decadeSpan) * plotW;
  const toY = (c: number) => tPad + plotH - (c / niceMax) * plotH;

  const xs = list.map((p) => toX(p.decade));
  const ys = list.map((p) => toY(p.count));
  const line = list.map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(" ");
  const area = `${line} L ${xs[xs.length - 1]!.toFixed(1)} ${tPad + plotH} L ${xs[0]!.toFixed(1)} ${tPad + plotH} Z`;

  // X labels every 50 years that fall within the data range
  const xTicks = list
    .filter((p) => p.decade % 50 === 0)
    .map((p) => ({ decade: p.decade, x: toX(p.decade) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-primary" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y gridlines + labels */}
      {yTicks.map((tick) => {
        const y = toY(tick);
        return (
          <g key={tick}>
            <line x1={lPad} y1={y} x2={W - rPad} y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
            <text x={lPad - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="currentColor" opacity="0.45">
              {tick}
            </text>
          </g>
        );
      })}

      {/* X baseline */}
      <line x1={lPad} y1={tPad + plotH} x2={W - rPad} y2={tPad + plotH} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

      {/* X tick labels */}
      {xTicks.map(({ decade, x }) => (
        <g key={decade}>
          <line x1={x} y1={tPad + plotH} x2={x} y2={tPad + plotH + 3} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <text x={x} y={tPad + plotH + 5} textAnchor="middle" dominantBaseline="hanging" fontSize="9" fill="currentColor" opacity="0.45">
            {decade}
          </text>
        </g>
      ))}

      {/* Area + line */}
      <path d={area} fill={`url(#${gradId})`} className="text-primary" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-primary drop-shadow-[0_0_8px_rgba(47,125,64,0.25)]"
      />
    </svg>
  );
}

export function DashboardInsightsOverview({
  insights,
  individualsTotal,
  isLoading,
  heatmapDays,
}: Props) {
  if (isLoading) {
    return (
      <section aria-label="Insights overview" className="space-y-4">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton min-h-52 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={`b-${i}`} className="skeleton min-h-52 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!insights) {
    return null;
  }

  const surnames = (Array.isArray(insights.topSurnames) ? insights.topSurnames : [])
    .filter((s) => s != null && typeof s.name === "string" && Number.isFinite(s.count))
    .slice(0, 8);
  const branchSlices = (Array.isArray(insights.branchSlices) ? insights.branchSlices : []).filter(
    (s) => s != null && typeof s.label === "string" && Number.isFinite(s.count),
  );
  const branchLabels = branchSlices.map((s) => s.label);
  const branchValues = branchSlices.map((s) => s.count);

  return (
    <section aria-labelledby="insights-heading" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/85">Insights</p>
        <h2 id="insights-heading" className="mt-1 font-heading text-xl font-semibold tracking-tight text-base-content">
          Archive overview
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-base-content/65">
          Gentle patterns in your tree — meant for curiosity and curation, not performance metrics.
        </p>
      </div>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="flex min-h-0 flex-col rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
          <h3 className="text-sm font-semibold text-base-content">Surname distribution</h3>
          <p className="mt-1 text-xs text-base-content/55">Most common primary surnames in this file.</p>
          <div className="mt-2 min-h-[260px] flex-1">
            <InsightsSurnameBarPlot names={surnames.map((s) => s.name)} counts={surnames.map((s) => s.count)} />
          </div>
        </article>

        <article className="flex min-h-0 flex-col rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
          <h3 className="text-sm font-semibold text-base-content">Births over time</h3>
          <p className="mt-1 text-xs text-base-content/55">Recorded birth years grouped by decade.</p>
          <div className="mt-4 flex flex-1 flex-col justify-center">
            <BirthsSparkline points={insights.birthsByDecade} />
          </div>
        </article>

        <article className="flex min-h-0 flex-col rounded-2xl border border-base-content/[0.08] bg-base-200/20 p-5">
          <h3 className="text-sm font-semibold text-base-content">Family branches</h3>
          <p className="mt-1 text-xs text-base-content/55">Share of individuals among leading surnames.</p>
          <div className="mt-2 min-h-[260px] flex-1">
            <InsightsBranchDonutPlot
              labels={branchLabels}
              values={branchValues}
              centerTotal={individualsTotal.toLocaleString()}
            />
          </div>
        </article>
      </div>

      <div className="min-h-0 min-w-0">
        <DashboardActivityHeatmap days={heatmapDays} isLoading={isLoading} />
      </div>
    </section>
  );
}
