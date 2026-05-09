"use client";

import { BarChart3 } from "lucide-react";
import { AdminDatesAnalyticsPanel } from "@/components/admin/AdminDatesAnalyticsPanel";
import { AdminEventsAnalyticsPanel } from "@/components/admin/AdminEventsAnalyticsPanel";
import { AdminFamiliesAnalyticsPanel } from "@/components/admin/AdminFamiliesAnalyticsPanel";
import { AdminIndividualsAnalyticsPanel } from "@/components/admin/AdminIndividualsAnalyticsPanel";
import { AdminMediaAnalyticsPanel } from "@/components/admin/AdminMediaAnalyticsPanel";
import { AdminNotesAnalyticsPanel } from "@/components/admin/AdminNotesAnalyticsPanel";
import { AdminOpenQuestionsAnalyticsPanel } from "@/components/admin/AdminOpenQuestionsAnalyticsPanel";
import { AdminGivenNamesAnalyticsPanel } from "@/components/admin/AdminGivenNamesAnalyticsPanel";
import { AdminPlacesAnalyticsPanel } from "@/components/admin/AdminPlacesAnalyticsPanel";
import { AdminSurnamesAnalyticsPanel } from "@/components/admin/AdminSurnamesAnalyticsPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminListAnalytics } from "@/hooks/useAdminListAnalytics";
import { cn } from "@/lib/utils";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Stable reference so React Query does not refetch every render. */
const ANALYTICS_INDIVIDUALS_QUERY = { top_n: 10 } as const satisfies Record<string, number>;

/** Match statistics-test marriage-country chart depth (API caps at 50). */
const ANALYTICS_FAMILIES_QUERY = { country_limit: 24 } as const satisfies Record<string, number>;

/** Match statistics-test-style event type / country caps (API max type_limit 150, country_limit 50). */
const ANALYTICS_EVENTS_QUERY = { type_limit: 30, country_limit: 24 } as const satisfies Record<string, number>;

/** Match statistics-test media fetch (default top_n 10, API max 40). */
const ANALYTICS_MEDIA_QUERY = { top_n: 10 } as const satisfies Record<string, number>;

/** API defaults: top_limit 25, country/state 20 (max 150 / 80 / 80). Slightly higher country/state for chart rows. */
const ANALYTICS_PLACES_QUERY = {
  top_limit: 25,
  country_limit: 24,
  state_limit: 24,
} as const satisfies Record<string, number>;

/** API default limit 50, max 200; 30 matches a rich chart without huge payloads. */
const ANALYTICS_GIVEN_NAMES_QUERY = { limit: 30 } as const satisfies Record<string, number>;

const ANALYTICS_SURNAMES_QUERY = { limit: 30 } as const satisfies Record<string, number>;

/** API defaults top_limit 25, calendar_limit 15 (max 150 / 50). Rich charts without huge payloads. */
const ANALYTICS_DATES_QUERY = { top_limit: 30, calendar_limit: 24 } as const satisfies Record<string, number>;

/** API default top_n 10, max 40; 24 fills rank charts without huge payloads. */
const ANALYTICS_OPEN_QUESTIONS_QUERY = { top_n: 24 } as const satisfies Record<string, number>;

/** API default top_n 10, max 40 for ranked note / entity lists. */
const ANALYTICS_NOTES_QUERY = { top_n: 24 } as const satisfies Record<string, number>;

function GenericJsonPanel({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-200/15 p-4">
      <p className="mb-2 text-sm text-muted-foreground">
        Raw analytics payload (add dedicated charts for this list type later).
      </p>
      <pre
        className={cn(
          "max-h-[min(70vh,48rem)] overflow-auto rounded-lg bg-base-300/40 p-3 font-mono text-xs leading-relaxed",
          "text-base-content/90",
        )}
      >
        {text}
      </pre>
    </div>
  );
}

type Props = {
  segment: string;
  /** Plural entity label for headings, e.g. &quot;Individuals&quot; */
  entityPlural: string;
};

export function AdminListAnalyticsPanel({ segment, entityPlural }: Props) {
  const analyticsQuery =
    segment === "individuals"
      ? ANALYTICS_INDIVIDUALS_QUERY
      : segment === "families"
        ? ANALYTICS_FAMILIES_QUERY
        : segment === "events"
          ? ANALYTICS_EVENTS_QUERY
          : segment === "media"
            ? ANALYTICS_MEDIA_QUERY
            : segment === "places"
              ? ANALYTICS_PLACES_QUERY
              : segment === "given-names"
                ? ANALYTICS_GIVEN_NAMES_QUERY
                : segment === "surnames"
                  ? ANALYTICS_SURNAMES_QUERY
                  : segment === "dates"
                    ? ANALYTICS_DATES_QUERY
                    : segment === "open-questions"
                      ? ANALYTICS_OPEN_QUESTIONS_QUERY
                      : segment === "notes"
                        ? ANALYTICS_NOTES_QUERY
                        : undefined;
  const { data, isLoading, isError, error } = useAdminListAnalytics(segment, true, analyticsQuery);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[320px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !isRecord(data)) {
    const msg = error instanceof Error ? error.message : "Could not load analytics.";
    return (
      <div
        role="status"
        className="rounded-xl border border-base-content/12 bg-base-200/25 px-4 py-3 text-sm text-base-content/80"
      >
        <span className="font-medium text-base-content">Analytics unavailable.</span> {msg}
      </div>
    );
  }

  if ("error" in data && typeof data.error === "string") {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-base-content">
        {data.error}
      </div>
    );
  }

  return (
    <section aria-label={`${entityPlural} statistics`} className="space-y-4">
      <Card className="border-base-content/10 bg-base-200/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary/80" aria-hidden />
            <CardTitle className="text-base">{entityPlural} — statistics</CardTitle>
          </div>
          <CardDescription>
            {segment === "individuals" ? (
              <>
                Same individual metrics as the public <span className="font-medium text-base-content/90">statistics-test</span> page. Use the{" "}
                <span className="font-medium text-base-content/90">floating panel control</span> fixed to the viewport (just past the sidebar on wide
                screens) to open the section navigator. List and card views stay in the toolbar.
              </>
            ) : segment === "families" ? (
              <>
                Same family metrics as the public <span className="font-medium text-base-content/90">statistics-test</span> Families block. Switch
                back to list or card view to edit records.
              </>
            ) : segment === "events" ? (
              <>
                Same event metrics as the public <span className="font-medium text-base-content/90">statistics-test</span> Events block. Switch back
                to list or card view to edit records.
              </>
            ) : segment === "media" ? (
              <>
                Same GEDCOM media metrics as the public <span className="font-medium text-base-content/90">statistics-test</span> media section. Switch
                back to list or card view to edit records.
              </>
            ) : segment === "places" ? (
              <>
                Same place metrics as the public <span className="font-medium text-base-content/90">statistics-test</span> Places block. Switch back to
                list or card view to edit records.
              </>
            ) : segment === "given-names" ? (
              <>
                Given-name aggregates and charts aligned with <span className="font-medium text-base-content/90">statistics-test</span>, plus sex splits
                and decade cohort data from the research API. Switch back to list or card view to edit records.
              </>
            ) : segment === "surnames" ? (
              <>
                Surname aggregates and charts aligned with <span className="font-medium text-base-content/90">statistics-test</span>, plus Soundex clusters
                and decade / country cohorts from the research API. Switch back to list or card view to edit records.
              </>
            ) : segment === "dates" ? (
              <>
                Canonical date aggregates from <span className="font-medium text-base-content/90">gedcom_dates_v2</span>: qualifier mix, calendar tags,
                year-by-decade histogram, and most-referenced dates from the research API. Switch back to list or card view to edit records.
              </>
            ) : segment === "open-questions" ? (
              <>
                Resolution totals and per-entity rankings (individuals, media, families, events) by open-question link count from the research API.
                Switch back to list or card view to edit records.
              </>
            ) : segment === "notes" ? (
              <>
                GEDCOM note coverage, orphan detection, junction-row totals, and ranked notes / individuals / families / events / sources from the
                research API. Switch back to list or card view to edit records.
              </>
            ) : (
              <>Data from the research API for this admin tree. Switch back to list or card view to edit records.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {segment === "individuals" ? (
            <AdminIndividualsAnalyticsPanel data={data} />
          ) : segment === "families" ? (
            <AdminFamiliesAnalyticsPanel data={data} />
          ) : segment === "events" ? (
            <AdminEventsAnalyticsPanel data={data} />
          ) : segment === "media" ? (
            <AdminMediaAnalyticsPanel data={data} />
          ) : segment === "places" ? (
            <AdminPlacesAnalyticsPanel data={data} />
          ) : segment === "given-names" ? (
            <AdminGivenNamesAnalyticsPanel data={data} />
          ) : segment === "surnames" ? (
            <AdminSurnamesAnalyticsPanel data={data} />
          ) : segment === "dates" ? (
            <AdminDatesAnalyticsPanel data={data} />
          ) : segment === "open-questions" ? (
            <AdminOpenQuestionsAnalyticsPanel data={data} />
          ) : segment === "notes" ? (
            <AdminNotesAnalyticsPanel data={data} />
          ) : (
            <GenericJsonPanel data={data} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
