"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import { horizontalBarChart } from "@/lib/admin/analytics-plotly-charts";

const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatN(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function SummaryStat({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold text-base-content">{formatN(value)}</p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatBlock({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-xl border border-base-content/10 bg-base-100/40 p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold tracking-tight text-base-content">{title}</h3>
      <div className="mt-3 min-w-0 overflow-x-auto">{children}</div>
    </section>
  );
}

type TopBranch = { name: string; size: number; isMain: boolean };

export function AdminBranchesAnalyticsPanel({ data }: { data: unknown }) {
  if (!isRecord(data)) return null;

  const totalBranches = data.totalBranches as number | null;
  const totalIndividuals = data.totalIndividualsInBranches as number | null;
  const mainBranch = isRecord(data.mainBranch)
    ? (data.mainBranch as { name: string; size: number })
    : null;
  const topBranches = Array.isArray(data.topBranches)
    ? (data.topBranches as TopBranch[])
    : [];

  const chartSpec: { data: Data[]; layout: Partial<Layout> } | null =
    topBranches.length > 0
      ? horizontalBarChart(
          topBranches.map((b) => b.name),
          topBranches.map((b) => b.size),
          "Individuals per branch",
        )
      : null;

  return (
    <div className="space-y-4">
      <StatBlock id="branches-summary" title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryStat label="Branches" value={totalBranches} />
          <SummaryStat label="Individuals in branches" value={totalIndividuals} />
          {mainBranch && (
            <SummaryStat
              label="Main branch size"
              value={mainBranch.size}
              hint={mainBranch.name}
            />
          )}
        </div>
      </StatBlock>

      {chartSpec && (
        <StatBlock id="branches-by-size" title="Top branches by size">
          <PlotlyChart data={chartSpec.data} layout={chartSpec.layout} config={PLOT_CONFIG} />
        </StatBlock>
      )}
    </div>
  );
}
