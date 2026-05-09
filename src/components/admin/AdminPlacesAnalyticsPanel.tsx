"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  placesCountryDistributionChart,
  placesReferencePie,
  placesStateDistributionChart,
  placesTopReferencedChart,
} from "@/lib/admin/places-analytics-charts";
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

export function AdminPlacesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const refs = isRecord(data.reference_counts) ? data.reference_counts : {};

  const topPlaces = asRowArray(data.top_places);
  const countryDist = asRowArray(data.country_distribution);
  const stateDist = asRowArray(data.state_distribution);

  const refPieSpec = placesReferencePie(refs);
  const topSpec = placesTopReferencedChart(topPlaces);
  const countrySpec = placesCountryDistributionChart(countryDist);
  const stateSpec = placesStateDistributionChart(stateDist);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Canonical place rows and cross-entity references aligned with the public statistics-test{" "}
        <span className="font-medium text-base-content/90">Places</span> block (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/places</code>
        ).
      </p>

      <StatBlock
        id="admin-places-stat-summary"
        title="Place records"
        description="Coverage fields on gedcom_places_v2 for this admin tree."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat label="Place records" value={summary.total_places} />
          <SummaryStat label="With coordinates" value={summary.with_coordinates} hint="Latitude and longitude set" />
          <SummaryStat label="With country" value={summary.with_country} />
          <SummaryStat label="With state / region" value={summary.with_state} />
          <SummaryStat label="With county" value={summary.with_county} />
          <SummaryStat label="With parsed name" value={summary.with_parsed_name} hint="Structured name field populated" />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-places-stat-refs"
        title="Reference counts"
        description="How often place IDs are set on individuals, families, events, and media."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat label="Birth place links" value={refs.birth_place_links} hint="Individuals with birth_place_id" />
          <SummaryStat label="Death place links" value={refs.death_place_links} />
          <SummaryStat label="Marriage place links" value={refs.marriage_place_links} />
          <SummaryStat label="Divorce place links" value={refs.divorce_place_links} />
          <SummaryStat label="Event place links" value={refs.event_place_links} />
          <SummaryStat label="Media ↔ place links" value={refs.media_place_links} />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-places-stat-ref-pie"
          title="Place references by record type"
          description="Total attachment counts: one individual can contribute both birth and death."
          chartOverflow
        >
          <PlotlyBlock spec={refPieSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-places-stat-top"
          title="Most referenced places"
          description="Combined references across birth, death, marriage, divorce, events, and media."
        >
          <PlotlyBlock spec={topSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-places-stat-countries"
          title="Places by country"
          description="Distinct place rows with each country value (Unknown if unset)."
        >
          <PlotlyBlock spec={countrySpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-places-stat-states"
          title="Places by state / region"
          description="Distinct place rows with each state value (Unknown if unset)."
        >
          <PlotlyBlock spec={stateSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>
    </div>
  );
}
