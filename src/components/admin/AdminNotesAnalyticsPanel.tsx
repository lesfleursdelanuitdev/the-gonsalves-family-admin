"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  notesJunctionRowsPie,
  notesTopEventsChart,
  notesTopFamiliesChart,
  notesTopIndividualsChart,
  notesTopLinkedChart,
  notesTopSourcesChart,
} from "@/lib/admin/notes-analytics-charts";
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

export function AdminNotesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const linkCounts = isRecord(data.link_counts) ? data.link_counts : {};

  const topNotes = asRowArray(data.top_notes);
  const topIndividuals = asRowArray(data.top_individuals);
  const topFamilies = asRowArray(data.top_families);
  const topEvents = asRowArray(data.top_events);
  const topSources = asRowArray(data.top_sources);

  const junctionPieSpec = notesJunctionRowsPie(linkCounts);
  const topNotesSpec = notesTopLinkedChart(topNotes, 18);
  const indSpec = notesTopIndividualsChart(topIndividuals, 18);
  const famSpec = notesTopFamiliesChart(topFamilies, 18);
  const evSpec = notesTopEventsChart(topEvents, 18);
  const srcSpec = notesTopSourcesChart(topSources, 18);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        GEDCOM note records and junction-table link rows (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/notes</code>
        ). One note can attach to multiple entities; junction rows count each attachment.
      </p>

      <StatBlock
        id="admin-notes-stat-summary"
        title="Note records"
        description="Coverage and quality fields on gedcom_notes_v2 for this tree."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryStat label="Total notes" value={summary.total_notes} />
          <SummaryStat label="Top-level notes" value={summary.top_level_notes} />
          <SummaryStat label="With xref" value={summary.with_xref} />
          <SummaryStat label="Avg. content length" value={summary.avg_content_length} hint="Characters, server-side average" />
          <SummaryStat label="Distinct notes linked" value={summary.distinct_notes_linked} hint="Notes appearing in at least one junction" />
          <SummaryStat label="Orphan notes" value={summary.orphan_notes} hint="No individual, family, event, or source link" />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-notes-stat-junctions"
        title="Junction rows by target"
        description="Counts from gedcom_*_notes_v2 tables (sum can exceed distinct notes when one note links to several records)."
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryStat label="Individual links" value={linkCounts.individual_note_links} />
            <SummaryStat label="Family links" value={linkCounts.family_note_links} />
            <SummaryStat label="Event links" value={linkCounts.event_note_links} />
            <SummaryStat label="Source links" value={linkCounts.source_note_links} />
          </div>
          <PlotlyBlock spec={junctionPieSpec} emptyMessage={emptyMsg} chartOverflow />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-notes-stat-top-notes"
          title="Most-linked note records"
          description="Note rows ranked by total attachment count across all junction tables (preview is truncated on the server)."
          chartOverflow
        >
          <PlotlyBlock spec={topNotesSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-notes-stat-top-individuals"
          title="Individuals — most note links"
          chartOverflow
        >
          <PlotlyBlock spec={indSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-notes-stat-top-families"
          title="Families — most note links"
          chartOverflow
        >
          <PlotlyBlock spec={famSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-notes-stat-top-events"
          title="Events — most note links"
          chartOverflow
        >
          <PlotlyBlock spec={evSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <div className="lg:col-span-2">
          <StatBlock
            id="admin-notes-stat-top-sources"
            title="Sources — most note links"
            chartOverflow
          >
            <PlotlyBlock spec={srcSpec} emptyMessage={emptyMsg} chartOverflow />
          </StatBlock>
        </div>
      </div>
    </div>
  );
}
