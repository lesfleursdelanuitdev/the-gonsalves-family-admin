"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Data, Layout } from "plotly.js";
import { BarChart3 } from "lucide-react";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminStatisticsAnalytics } from "@/hooks/useAdminStatisticsAnalytics";
import { cn } from "@/lib/utils";

const BAR = "#5b9274";
const MUTED_AXIS = "rgba(232, 230, 227, 0.65)";

function horizontalBarChart(
  labels: string[],
  values: number[],
  title: string,
): { data: Data[]; layout: Partial<Layout> } {
  const pairs = labels.map((l, i) => ({ l, v: values[i] ?? 0 }));
  pairs.sort((a, b) => a.v - b.v);
  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: pairs.map((p) => p.v),
        y: pairs.map((p) => p.l),
        marker: { color: BAR },
      },
    ],
    layout: {
      title: { text: title, font: { size: 14 } },
      margin: { l: 12, r: 16, t: 44, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: MUTED_AXIS, size: 11 },
      xaxis: { title: { text: "Count" }, gridcolor: "rgba(255,255,255,0.06)" },
      yaxis: { automargin: true },
      height: Math.min(420, 120 + pairs.length * 22),
    },
  };
}

function verticalBarChart(
  categories: string[],
  values: number[],
  title: string,
  xTitle: string,
): { data: Data[]; layout: Partial<Layout> } {
  return {
    data: [
      {
        type: "bar",
        x: categories,
        y: values,
        marker: { color: BAR },
      },
    ],
    layout: {
      title: { text: title, font: { size: 14 } },
      margin: { l: 48, r: 16, t: 44, b: 72 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: MUTED_AXIS, size: 11 },
      xaxis: {
        title: { text: xTitle },
        tickangle: -35,
        automargin: true,
        gridcolor: "rgba(255,255,255,0.06)",
      },
      yaxis: { title: { text: "Distinct names" }, gridcolor: "rgba(255,255,255,0.06)" },
      height: 340,
    },
  };
}

type Props = {
  /** Only fetch analytics when the admin tree is configured (same gate as dashboard totals). */
  dashboardConfigured: boolean;
};

export function DashboardStatisticsSection({ dashboardConfigured }: Props) {
  const { data, isLoading, isError, error } = useAdminStatisticsAnalytics(dashboardConfigured);

  if (!dashboardConfigured) {
    return null;
  }

  if (isLoading) {
    return (
      <section aria-label="Statistics analytics" className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary/80" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Statistics layer
          </h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-base-content/10 bg-base-200/15 p-4">
              <div className="skeleton mb-4 h-5 w-48 rounded" />
              <div className="skeleton h-[320px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    const msg =
      error instanceof Error ? error.message : "Could not load statistics.";
    return (
      <section aria-label="Statistics analytics" className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary/80" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Statistics layer
          </h2>
        </div>
        <div
          role="status"
          className="rounded-xl border border-base-content/12 bg-base-200/25 px-4 py-3 text-sm text-base-content/80"
        >
          <span className="font-medium text-base-content">Charts unavailable.</span>{" "}
          <span className="text-base-content/70">{msg}</span>
          {" "}
          Ensure{" "}
          <code className="rounded bg-base-content/10 px-1 py-0.5 text-xs">PYTHON_API_URL</code> points at
          Ligneous Python API and that it can reach the same database as this admin app.
        </div>
      </section>
    );
  }

  const gn = data.givenNames;
  const sn = data.surnames;

  const topGiven = (gn.top_names ?? []).slice(0, 18);
  const givenBar = horizontalBarChart(
    topGiven.map((r) => String(r.name ?? "—")),
    topGiven.map((r) => Number(r.frequency) || 0),
    "Top given names",
  );

  const gnBuckets = gn.frequency_distribution ?? [];
  const givenFreq = verticalBarChart(
    gnBuckets.map((b) => String(b.bucket)),
    gnBuckets.map((b) => Number(b.count) || 0),
    "Given names — frequency buckets",
    "Occurrences per name",
  );

  const topSur = (sn.top_surnames ?? []).slice(0, 18);
  const surBar = horizontalBarChart(
    topSur.map((r) => String(r.name ?? "—")),
    topSur.map((r) => Number(r.frequency) || 0),
    "Top surnames",
  );

  const snBuckets = sn.frequency_distribution ?? [];
  const surFreq = verticalBarChart(
    snBuckets.map((b) => String(b.bucket)),
    snBuckets.map((b) => Number(b.count) || 0),
    "Surnames — frequency buckets",
    "Occurrences per surname",
  );

  const gnSummary = gn.summary ?? {};
  const snSummary = sn.summary ?? {};

  return (
    <section aria-label="Statistics analytics" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary/80" aria-hidden />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Statistics layer
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-base-content/75">
            Name analytics from the research API (
            <code className="rounded bg-base-content/10 px-1 py-0.5 text-xs">/analytics/given-names</code>,{" "}
            <code className="rounded bg-base-content/10 px-1 py-0.5 text-xs">/analytics/surnames</code>
            ). Same aggregates power list views and NL search.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Link href="/admin/given-names" className="link link-primary font-medium">
            Given names
          </Link>
          <Link href="/admin/surnames" className="link link-primary font-medium">
            Surnames
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryPill
          label="Unique given names"
          value={gnSummary.total_unique_names}
        />
        <SummaryPill
          label="Individuals w/ names"
          value={gnSummary.total_individuals_with_names}
        />
        <SummaryPill label="Unique surnames" value={snSummary.total_unique_surnames} />
        <SummaryPill label="Surname occurrences" value={snSummary.total_occurrences} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Top given names" description="Most frequent normalized given names.">
          <PlotlyChart
            data={givenBar.data}
            layout={givenBar.layout}
            config={{ displayModeBar: false, responsive: true }}
            className={cn("min-h-[280px]")}
          />
        </ChartCard>
        <ChartCard
          title="Given name frequency distribution"
          description="How many distinct names fall in each occurrence bucket."
        >
          <PlotlyChart
            data={givenFreq.data}
            layout={givenFreq.layout}
            config={{ displayModeBar: false, responsive: true }}
          />
        </ChartCard>
        <ChartCard title="Top surnames" description="Most frequent primary surnames.">
          <PlotlyChart
            data={surBar.data}
            layout={surBar.layout}
            config={{ displayModeBar: false, responsive: true }}
          />
        </ChartCard>
        <ChartCard
          title="Surname frequency distribution"
          description="Distinct surnames by occurrence bucket."
        >
          <PlotlyChart
            data={surFreq.data}
            layout={surFreq.layout}
            config={{ displayModeBar: false, responsive: true }}
          />
        </ChartCard>
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: unknown }) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : null;
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-base-content">{n != null ? n.toLocaleString() : "—"}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-base-content/10 bg-base-200/15 shadow-none">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
