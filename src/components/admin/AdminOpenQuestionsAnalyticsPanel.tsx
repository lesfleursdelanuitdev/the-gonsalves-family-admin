"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  openQuestionsResolutionPie,
  openQuestionsTopEventsChart,
  openQuestionsTopFamiliesChart,
  openQuestionsTopIndividualsChart,
  openQuestionsTopMediaChart,
} from "@/lib/admin/open-questions-analytics-charts";
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

export function AdminOpenQuestionsAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};

  const topIndividuals = asRowArray(data.top_individuals);
  const topMedia = asRowArray(data.top_media);
  const topFamilies = asRowArray(data.top_families);
  const topEvents = asRowArray(data.top_events);

  const pieSpec = openQuestionsResolutionPie(summary);
  const indSpec = openQuestionsTopIndividualsChart(topIndividuals, 18);
  const mediaSpec = openQuestionsTopMediaChart(topMedia, 18);
  const famSpec = openQuestionsTopFamiliesChart(topFamilies, 18);
  const evSpec = openQuestionsTopEventsChart(topEvents, 18);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Open research questions for this tree (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/open-questions</code>
        ): resolution counts and entities ranked by how many question links they have.
      </p>

      <StatBlock
        id="admin-oq-stat-summary"
        title="Question records"
        description="Counts from the open_questions table for this GEDCOM file."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryStat label="Total questions" value={summary.total} />
          <SummaryStat label="Resolved" value={summary.resolved} />
          <SummaryStat label="Unresolved" value={summary.unresolved} />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-oq-stat-pie"
          title="Resolved vs unresolved"
          description="Share of questions marked resolved versus still open."
          chartOverflow
        >
          <PlotlyBlock spec={pieSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-oq-stat-top-individuals"
          title="Individuals — most question links"
          description="People linked to the most distinct open-question rows."
          chartOverflow
        >
          <PlotlyBlock spec={indSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-oq-stat-top-media"
          title="Media — most question links"
          description="GEDCOM media objects linked to the most questions."
          chartOverflow
        >
          <PlotlyBlock spec={mediaSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-oq-stat-top-families"
          title="Families — most question links"
          description="Family units ranked by open-question link count."
          chartOverflow
        >
          <PlotlyBlock spec={famSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <div className="lg:col-span-2">
          <StatBlock
            id="admin-oq-stat-top-events"
            title="Events — most question links"
            description="Events ranked by how many questions reference them."
            chartOverflow
          >
            <PlotlyBlock spec={evSpec} emptyMessage={emptyMsg} chartOverflow />
          </StatBlock>
        </div>
      </div>
    </div>
  );
}
