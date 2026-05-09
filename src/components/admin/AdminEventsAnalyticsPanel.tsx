"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  eventsByTypeChart,
  eventsCountryChart,
  eventsOriginPie,
  eventsYearDecadeChart,
} from "@/lib/admin/events-analytics-charts";
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

function asEventTypeRows(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((row): row is Record<string, unknown> => isRecord(row));
}

function asDecadeRows(v: unknown): Array<{ decade?: unknown; count?: unknown }> {
  if (!Array.isArray(v)) return [];
  return v.filter((row): row is Record<string, unknown> => isRecord(row)) as Array<{
    decade?: unknown;
    count?: unknown;
  }>;
}

function asCountryRows(v: unknown): Array<{ country?: unknown; count?: unknown }> {
  if (!Array.isArray(v)) return [];
  return v.filter((row): row is Record<string, unknown> => isRecord(row)) as Array<{
    country?: unknown;
    count?: unknown;
  }>;
}

type Props = { data: Record<string, unknown> };

export function AdminEventsAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const junction = isRecord(data.junction_counts) ? data.junction_counts : {};
  const origin = isRecord(data.origin_breakdown) ? data.origin_breakdown : {};
  const typeCat = isRecord(data.type_catalog_breakdown) ? data.type_catalog_breakdown : {};

  const eventTypesSpec = eventsByTypeChart(asEventTypeRows(data.by_event_type));
  const decadeSpec = eventsYearDecadeChart(asDecadeRows(data.year_by_decade));
  const countriesSpec = eventsCountryChart(asCountryRows(data.place_country_distribution));
  const originPieSpec = eventsOriginPie(origin);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Event records, type catalog, junctions, and distributions aligned with the public statistics-test{" "}
        <span className="font-medium text-base-content/90">Events</span> block (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/events</code>).
      </p>

      <StatBlock
        id="admin-events-stat-overview"
        title="Overview"
        description="Row counts from gedcom_events_v2 for this admin tree."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Total events" value={summary.total} />
          <SummaryStat label="Events with a date" value={summary.with_date} />
          <SummaryStat label="Events with a place" value={summary.with_place} />
          <SummaryStat
            label="Events with a custom type"
            value={summary.with_custom_type}
            hint="Extra subtype text beyond the standard tag"
          />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-events-stat-links"
        title="Links & citations"
        description="Junction tables for individuals, families, notes, sources, and media."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat
            label="Linked to a person"
            value={junction.links_to_individuals}
            hint="Event attached to an individual"
          />
          <SummaryStat
            label="Linked to a family"
            value={junction.links_to_families}
            hint="Event attached to a couple or family"
          />
          <SummaryStat label="Events that have notes" value={junction.events_with_notes} />
          <SummaryStat label="Note links (total)" value={junction.note_links} />
          <SummaryStat label="Events that have sources" value={junction.events_with_sources} />
          <SummaryStat label="Source links (total)" value={junction.source_links} />
          <SummaryStat label="Media links (total)" value={junction.media_links} />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-events-stat-type-catalog"
        title="Type catalog"
        description="Standard vs custom event types and catalog linkage."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat
            label="Events · standard catalog types"
            value={origin.standard_catalog_events}
            hint="Linked to a non-custom row in the event type catalog"
          />
          <SummaryStat
            label="Events · custom catalog types"
            value={origin.custom_catalog_events}
            hint="Linked to a custom definition (e.g. EVEN with a subtype)"
          />
          <SummaryStat
            label="Distinct standard types in use"
            value={typeCat.distinct_standard_types}
            hint="How many different GEDCOM-level tags appear for this tree"
          />
          <SummaryStat
            label="Distinct custom types in use"
            value={typeCat.distinct_custom_types}
            hint="How many different custom event definitions appear"
          />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-3">
        <StatBlock
          id="admin-events-stat-types-chart"
          title="Most common event types"
          description="Plain-language names from the type catalog. Hover for counts."
        >
          <PlotlyBlock spec={eventTypesSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-events-stat-decade"
          title="Events by year"
          description="By decade, when a parsed year exists on the event date."
        >
          <PlotlyBlock spec={decadeSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-events-stat-countries"
          title="Events by place country"
          description="Country on the event place when set."
        >
          <PlotlyBlock spec={countriesSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>

      <div className="mx-auto max-w-xl">
        <StatBlock
          id="admin-events-stat-origin-pie"
          title="Standard vs custom events"
          description="Counts event records: standard GEDCOM catalog types, custom catalog types, and rows not linked to the catalog yet."
          chartOverflow
        >
          <PlotlyBlock spec={originPieSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
      </div>
    </div>
  );
}
