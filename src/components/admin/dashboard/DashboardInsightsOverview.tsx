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
  const max = Math.max(1, ...list.map((p) => p.count));
  const w = 280;
  const h = 120;
  const pad = 8;
  const xs = list.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, list.length - 1));
  const ys = list.map((p) => h - pad - ((h - pad * 2) * p.count) / max);
  const line = list
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs[i]!.toFixed(1)} ${ys[i]!.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${xs[xs.length - 1]!.toFixed(1)} ${h - pad} L ${xs[0]!.toFixed(1)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-h-32 text-primary" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
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
