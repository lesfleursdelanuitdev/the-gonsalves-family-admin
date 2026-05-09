"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  surnamesFrequencyBucketsChart,
  surnamesPopularityByBirthCountryChart,
  surnamesPopularityByDecadeChart,
  surnamesSoundexGroupsChart,
  surnamesTopChart,
} from "@/lib/admin/surnames-analytics-charts";
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

export function AdminSurnamesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};

  const topSurnames = asRowArray(data.top_surnames);
  const freqRows = asRowArray(data.frequency_distribution);
  const soundexRows = asRowArray(data.soundex_groups);
  const byDecade = asRowArray(data.popularity_by_decade);
  const byPlace = asRowArray(data.popularity_by_place);

  const topSpec = surnamesTopChart(topSurnames, 18);
  const freqSpec = surnamesFrequencyBucketsChart(freqRows);
  const soundexSpec = surnamesSoundexGroupsChart(soundexRows);
  const decadeSpec = surnamesPopularityByDecadeChart(byDecade);
  const countrySpec = surnamesPopularityByBirthCountryChart(byPlace);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Aggregates from <span className="font-medium text-base-content/90">gedcom_surnames_v2</span>, aligned with statistics-test surname charts plus
        phonetic, decade, and country cohorts from the research API (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/surnames</code>
        ).
      </p>

      <StatBlock
        id="admin-sur-stat-summary"
        title="Summary"
        description="Tree-wide surname normalization and occurrence totals."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryStat label="Unique surnames" value={summary.total_unique_surnames} />
          <SummaryStat label="Surname occurrences" value={summary.total_occurrences} hint="Sum of frequency column" />
          <SummaryStat label="Surnames appearing once" value={summary.surnames_appearing_once} />
          <SummaryStat label="Surnames · 2–9 occurrences" value={summary.surnames_2_to_9} />
          <SummaryStat label="Surnames · 10+ occurrences" value={summary.surnames_10_plus} />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-sur-stat-top"
          title="Top surnames"
          description="Most frequent normalized surnames (same depth as statistics-test)."
        >
          <PlotlyBlock spec={topSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-sur-stat-freq"
          title="Surnames — frequency buckets"
          description="How many distinct surnames fall in each total-occurrence bucket."
        >
          <PlotlyBlock spec={freqSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-sur-stat-soundex"
          title="Phonetic clusters (Soundex)"
          description="Groups sharing a Soundex code with more than one distinct surname (API top 30 by total frequency)."
        >
          <PlotlyBlock spec={soundexSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-sur-stat-decade"
          title="Birth decade (top surnames cohort)"
          description="Individuals with birth year, summed by decade for frequency-ranked surnames (API popularity_by_decade)."
        >
          <PlotlyBlock spec={decadeSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>

      <StatBlock
        id="admin-sur-stat-country"
        title="Birth country (top surnames cohort)"
        description="Individual link counts summed by birth country for top surnames × top countries (API popularity_by_place)."
      >
        <PlotlyBlock spec={countrySpec} emptyMessage={emptyMsg} />
      </StatBlock>
    </div>
  );
}
