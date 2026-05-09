"use client";

import type { ReactNode } from "react";
import type { Data, Layout } from "plotly.js";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import {
  mediaTagPie,
  mediaTopDatesChart,
  mediaTopEventsChart,
  mediaTopFamiliesChart,
  mediaTopIndividualsChart,
  mediaTopPlacesChart,
} from "@/lib/admin/media-analytics-charts";
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

export function AdminMediaAnalyticsPanel({ data }: Props) {
  const summary = isRecord(data.summary) ? data.summary : {};
  const links = isRecord(data.link_counts) ? data.link_counts : {};
  const albums = isRecord(data.albums) ? data.albums : {};

  const topPlaces = asRowArray(data.top_places_for_media);
  const topDates = asRowArray(data.top_dates_for_media);
  const topIndividuals = asRowArray(data.top_individuals_by_media);
  const topFamilies = asRowArray(data.top_families_by_media);
  const topEvents = asRowArray(data.top_events_by_media);
  const topTags = asRowArray(data.top_media_tags);

  const firstPlace = topPlaces[0];
  const firstDate = topDates[0];
  const firstPerson = topIndividuals[0];

  const tagPieSpec = mediaTagPie(topTags);
  const placesSpec = mediaTopPlacesChart(topPlaces);
  const datesSpec = mediaTopDatesChart(topDates);
  const individualsSpec = mediaTopIndividualsChart(topIndividuals);
  const familiesSpec = mediaTopFamiliesChart(topFamilies);
  const eventsSpec = mediaTopEventsChart(topEvents);

  const emptyMsg = "Nothing to chart — every value is zero or there are no rows for this view.";

  return (
    <div className="min-w-0 space-y-8">
      <p className="text-xs leading-relaxed text-muted-foreground">
        GEDCOM media (OBJE), junction links, albums, and tag rankings aligned with the public statistics-test{" "}
        <span className="font-medium text-base-content/90">GEDCOM media</span> block (
        <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">/analytics/media</code>
        ).
      </p>

      <StatBlock
        id="admin-media-stat-obje"
        title="Media objects & metadata"
        description="Rows in gedcom_media_v2, tag usage, and albums for this admin tree."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat label="Media objects (OBJE)" value={summary.total_gedcom_media} />
          <SummaryStat label="With title" value={summary.with_title} />
          <SummaryStat label="With FORM" value={summary.with_form} hint="GEDCOM FORM when stored" />
          <SummaryStat
            label="Tag assignments on media"
            value={summary.media_tag_assignment_rows}
            hint="Rows in gedcom_media_app_tags for this file"
          />
          <SummaryStat label="Distinct tags used" value={summary.distinct_tags_on_media} />
          <SummaryStat label="Albums (this tree)" value={albums.album_count_for_tree} hint="albums.tree_id matches research tree" />
          <SummaryStat
            label="Album ↔ GEDCOM media"
            value={albums.album_gedcom_media_links}
            hint="album_gedcom_media rows for albums on this tree"
          />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-media-stat-links"
        title="Entity links"
        description="Junction tables from media to individuals, families, events, sources, places, and dates."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryStat label="Individual ↔ media links" value={links.individual_media_links} />
          <SummaryStat label="Family ↔ media links" value={links.family_media_links} />
          <SummaryStat label="Event ↔ media links" value={links.event_media_links} />
          <SummaryStat label="Source ↔ media links" value={links.source_media_links} />
          <SummaryStat label="Media ↔ place links" value={links.media_place_links} hint="gedcom_media_places_v2 rows" />
          <SummaryStat label="Media ↔ date links" value={links.media_date_links} hint="gedcom_media_dates_v2 rows" />
        </div>
      </StatBlock>

      <StatBlock
        id="admin-media-stat-tops"
        title="Leaders (from ranked lists)"
        description="Quick view of the top row in each ranking API response."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryStat
            label="Most-linked place (media)"
            value={firstPlace != null ? firstPlace.link_count : undefined}
            hint={
              firstPlace != null
                ? String(firstPlace.label ?? firstPlace.place_id ?? "—")
                : "No place links"
            }
          />
          <SummaryStat
            label="Most-linked date (media)"
            value={firstDate != null ? firstDate.link_count : undefined}
            hint={firstDate != null ? String(firstDate.label ?? firstDate.date_id ?? "—") : "No date links"}
          />
          <SummaryStat
            label="Person with most media"
            value={firstPerson != null ? firstPerson.media_link_count : undefined}
            hint={
              firstPerson != null
                ? stripSlashesFromName(String(firstPerson.full_name ?? "")) || undefined
                : undefined
            }
          />
        </div>
      </StatBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatBlock
          id="admin-media-stat-tag-pie"
          title="Popular tags on media"
          description="App tags on GEDCOM media: tag colors from the tags table when set."
          chartOverflow
        >
          <PlotlyBlock spec={tagPieSpec} emptyMessage={emptyMsg} chartOverflow />
        </StatBlock>
        <StatBlock
          id="admin-media-stat-places"
          title="Top places linked from media"
          description="Places ranked by media→place junction rows."
        >
          <PlotlyBlock spec={placesSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-media-stat-dates"
          title="Top dates linked from media"
          description="Canonical date rows ranked by media→date links."
        >
          <PlotlyBlock spec={datesSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-media-stat-individuals"
          title="Individuals with the most media"
          description="People ranked by individual↔media link count."
        >
          <PlotlyBlock spec={individualsSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-media-stat-families"
          title="Families with the most media"
          description="Families ranked by media link count (compact bar labels)."
        >
          <PlotlyBlock spec={familiesSpec} emptyMessage={emptyMsg} />
        </StatBlock>
        <StatBlock
          id="admin-media-stat-events"
          title="Events with the most media"
          description="Events ranked by event↔media link count."
        >
          <PlotlyBlock spec={eventsSpec} emptyMessage={emptyMsg} />
        </StatBlock>
      </div>
    </div>
  );
}
