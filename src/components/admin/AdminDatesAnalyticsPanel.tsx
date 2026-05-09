"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  datesByDateTypeChart,
  datesCalendarDistributionChart,
  datesTopReferencedChart,
  datesYearByDecadeChart,
} from "@/lib/admin/dates-analytics-charts";
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

export function AdminDatesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const referenceCounts = isRecord(data.reference_counts) ? data.reference_counts : {};

  const byDateType = asRowArray(data.by_date_type);
  const calendarDist = asRowArray(data.calendar_distribution);
  const yearByDecade = asRowArray(data.year_by_decade);
  const topDates = asRowArray(data.top_dates);

  const typeSpec = datesByDateTypeChart(byDateType);
  const calendarSpec = datesCalendarDistributionChart(calendarDist);
  const decadeSpec = datesYearByDecadeChart(yearByDecade);
  const topSpec = datesTopReferencedChart(topDates, 18);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Aggregates from <span className="font-medium text-base-content/90">gedcom_dates_v2</span> and link counts from individuals, families, events, and
        media (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/dates</code>
        ).
      </p>

      <StatBlock
        id="admin-dat-stat-summary-canonical"
        title="Canonical date records"
        description="Coverage of parsed components and range-style rows in this tree."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryStat label="Total dates" value={summary.total_dates} />
          <SummaryStat label="With year" value={summary.with_year} />
          <SummaryStat label="With month" value={summary.with_month} />
          <SummaryStat label="With day" value={summary.with_day} />
          <SummaryStat label="With original text" value={summary.with_original_text} />
          <SummaryStat label="With end components" value={summary.with_end_components} hint="BETWEEN / FROM…TO span" />
          <SummaryStat label="Range-style (BETWEEN / FROM_TO)" value={summary.range_style_records} />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-dat-stat-summary-links"
        title="Entity date links"
        description="How often a canonical date row is referenced (not the same as row count — one date can link to many entities)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryStat label="Birth links" value={referenceCounts.birth_date_links} />
          <SummaryStat label="Death links" value={referenceCounts.death_date_links} />
          <SummaryStat label="Marriage links" value={referenceCounts.marriage_date_links} />
          <SummaryStat label="Divorce links" value={referenceCounts.divorce_date_links} />
          <SummaryStat label="Event links" value={referenceCounts.event_date_links} />
          <SummaryStat label="Media date links" value={referenceCounts.media_date_links} />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-dat-stat-decade"
        title="Parsed year by decade"
        description="Histogram of date records that have a parsed year (FLOOR(year/10)×10)."
      >
        <PlotlyBlock spec={decadeSpec} emptyMessage={emptyMsg} />
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-dat-stat-type"
          title="GEDCOM date type mix"
          description="Qualifier / structure distribution (EXACT, APPROX, etc.)."
        >
          <PlotlyBlock spec={typeSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-dat-stat-calendar"
          title="Calendar tags"
          description="Top calendar values on date rows (UNKNOWN when unset)."
        >
          <PlotlyBlock spec={calendarSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
      </div>

      <StatBlock
        id="admin-dat-stat-top"
        title="Most-referenced dates"
        description="Canonical dates ranked by total references across individuals, families, events, and media-date rows."
      >
        <PlotlyBlock spec={topSpec} emptyMessage={emptyMsg} chartOverflow />
      </StatBlock>
    </div>
  );
}
