"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import {
  familiesMarriageCountriesChart,
  familiesMarriageDecadeChart,
  familiesPartnerPie,
} from "@/lib/admin/families-analytics-charts";
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

export function AdminFamiliesAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const junction = isRecord(data.junction_counts) ? data.junction_counts : {};
  const extremes = isRecord(data.children_record_extremes) ? data.children_record_extremes : {};

  const partnerSpec = familiesPartnerPie(summary);
  const marriageDec = asDecadeRows(data.marriage_by_decade);
  const marriageDecadeSpec = familiesMarriageDecadeChart(marriageDec);
  const marriageCountriesSpec = familiesMarriageCountriesChart(asCountryRows(data.marriage_country_distribution));

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Summary counts and charts aligned with the public statistics-test <span className="font-medium text-base-content/90">Families</span> block
        (same <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/families</code> payload).
      </p>

      <StatBlock
        id="admin-fam-stat-children-marriage"
        title="Children and marriage"
        description="Extremes from children_count, non-biological parent links, and families with a MARR event."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat
            label="Most children in one family"
            value={extremes.max_children}
            hint="Largest recorded child count on a single family"
          />
          <SummaryStat
            label="Fewest children in one family"
            value={extremes.min_children}
            hint="Smallest child count on a single family (often zero)"
          />
          <SummaryStat
            label="Families with a non-biological child"
            value={data.families_with_nonbiological_children}
            hint="At least one parent–child link not marked as biological"
          />
          <SummaryStat
            label="Families with a marriage event"
            value={data.families_with_marriage_event}
            hint="Has a marriage event linked to the family"
          />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-fam-stat-overview"
        title="Overview"
        description="Partner fields, marriage metadata, children denorm, and junction counts on gedcom_families_v2 and related tables."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat label="Total families" value={summary.total} />
          <SummaryStat label="Both partners listed" value={summary.both_partners} />
          <SummaryStat label="Father linked only" value={summary.husband_only} />
          <SummaryStat label="Mother linked only" value={summary.wife_only} />
          <SummaryStat label="No spouse linked" value={summary.no_partner_record} />
          <SummaryStat label="Marriage year known" value={summary.with_marriage_year} />
          <SummaryStat label="Marked divorced" value={summary.divorced} />
          <SummaryStat
            label="Families with children"
            value={summary.with_children_denorm}
            hint="At least one child recorded on the family"
          />
          <SummaryStat label="Marriage place known" value={summary.with_marriage_place} />
          <SummaryStat label="Families with notes" value={junction.families_with_notes} />
          <SummaryStat label="Families with sources" value={junction.families_with_sources} />
          <SummaryStat label="Families with any event" value={junction.families_with_events} />
          <SummaryStat label="Note links (total)" value={junction.note_links} />
          <SummaryStat label="Source links (total)" value={junction.source_links} />
          <SummaryStat label="Event links (total)" value={junction.event_links} />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-fam-stat-partner-pie"
          title="Parents linked on the family"
          description="Whether both spouses, one parent, or neither are attached. Small slices may be hidden."
          chartOverflow
        >
          <PlotlyBlock spec={partnerSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-fam-stat-marriage-decade"
          title="When couples married"
          description="By decade, when a marriage year is stored on the family."
        >
          <PlotlyBlock spec={marriageDecadeSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <div className="min-w-0 lg:col-span-2">
          <StatBlock
            id="admin-fam-stat-marriage-countries"
            title="Where couples married"
            description="Country from the marriage place, when available."
          >
            <PlotlyBlock spec={marriageCountriesSpec} emptyMessage={emptyMsg} />
          </StatBlock>
        </div>
      </div>
    </div>
  );
}
