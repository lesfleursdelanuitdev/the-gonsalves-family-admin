"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  givenNamesFrequencyBucketsChart,
  givenNamesPopularityByDecadeChart,
  givenNamesTopChart,
  givenNamesTopFemaleChart,
  givenNamesTopMaleChart,
} from "@/lib/admin/given-names-analytics-charts";
import { isPlotlySpecEmpty } from "@/lib/admin/individuals-analytics-charts";
import { cn } from "@/lib/utils";

const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatSummaryNumber(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString();
  return n.toFixed(1);
}

function SummaryStat({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold text-base-content">{formatSummaryNumber(value)}</p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatBlock({
  id,
  title,
  description,
  children,
  chartOverflow,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  chartOverflow?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-xl border border-base-content/10 bg-base-100/40 p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold tracking-tight text-base-content">{title}</h3>
      {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      <div className={cn("mt-3 min-w-0", chartOverflow ? "overflow-visible pt-1" : "overflow-x-auto")}>{children}</div>
    </section>
  );
}

function PlotlyBlock({
  spec,
  emptyMessage,
  chartOverflow,
}: {
  spec: { data: Data[]; layout: Partial<Layout> };
  emptyMessage: string;
  chartOverflow?: boolean;
}) {
  if (isPlotlySpecEmpty(spec)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <PlotlyChart
      data={spec.data as Data[]}
      layout={spec.layout as Partial<Layout>}
      config={PLOT_CONFIG}
      className={chartOverflow ? "min-h-[300px] overflow-visible" : "min-h-[300px]"}
    />
  );
}

function asRowArray(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((row): row is Record<string, unknown> => isRecord(row));
}

type Props = { data: Record<string, unknown> };

export function AdminGivenNamesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};

  const topNames = asRowArray(data.top_names);
  const freqRows = asRowArray(data.frequency_distribution);
  const topMale = asRowArray(data.top_10_male);
  const topFemale = asRowArray(data.top_10_female);
  const byDecade = asRowArray(data.popularity_by_decade);

  const topSpec = givenNamesTopChart(topNames, 18);
  const freqSpec = givenNamesFrequencyBucketsChart(freqRows);
  const maleSpec = givenNamesTopMaleChart(topMale);
  const femaleSpec = givenNamesTopFemaleChart(topFemale);
  const decadeSpec = givenNamesPopularityByDecadeChart(byDecade);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Aggregates from <span className="font-medium text-base-content/90">gedcom_given_names_v2</span>, aligned with the public statistics-test given-name
        charts and the research API (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/given-names</code>
        ).
      </p>

      <StatBlock
        id="admin-gn-stat-summary"
        title="Summary"
        description="Tree-wide counts from normalized given-name rows."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryStat label="Unique given names" value={summary.total_unique_names} />
          <SummaryStat label="Individuals w/ names" value={summary.total_individuals_with_names} />
          <SummaryStat label="Names appearing once" value={summary.names_appearing_once} />
          <SummaryStat label="Names · 2–9 occurrences" value={summary.names_2_to_9} />
          <SummaryStat label="Names · 10+ occurrences" value={summary.names_10_plus} />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-gn-stat-top"
          title="Top given names"
          description="Most frequent normalized given names (same chart depth as statistics-test)."
        >
          <PlotlyBlock spec={topSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-gn-stat-freq"
          title="Given names — frequency buckets"
          description="How many distinct names fall in each total-occurrence bucket."
        >
          <PlotlyBlock spec={freqSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-gn-stat-male"
          title="Top male-linked given names"
          description="Ranked by male individual name-form links (API top 10)."
        >
          <PlotlyBlock spec={maleSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-gn-stat-female"
          title="Top female-linked given names"
          description="Ranked by female individual name-form links (API top 10)."
        >
          <PlotlyBlock spec={femaleSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>

      <StatBlock
        id="admin-gn-stat-decade"
        title="Birth decade (top names cohort)"
        description="Individuals with birth year, summed by decade for the frequency-ranked name set (API popularity_by_decade)."
      >
        <PlotlyBlock spec={decadeSpec} emptyMessage={emptyMsg} />
      </StatBlock>
    </div>
  );
}
