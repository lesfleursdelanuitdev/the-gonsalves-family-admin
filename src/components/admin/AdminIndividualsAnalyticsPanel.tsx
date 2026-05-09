"use client";

import type { CSSProperties } from "react";
import type { Data, Layout } from "plotly.js";
import Link from "next/link";
import { PanelLeft, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useState } from "react";
import {
  ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
  ADMIN_SIDEBAR_LAYOUT_CHANGED_EVENT,
  readAdminSidebarCollapsedFromStorage,
  type AdminSidebarLayoutChangedDetail,
} from "@/lib/admin/admin-sidebar-layout";
import { PlotlyChart } from "@/components/plotly/PlotlyChart";
import { Button } from "@/components/ui/button";
import { horizontalBarChart, verticalBarChart } from "@/lib/admin/analytics-plotly-charts";
import { individualsSexDistributionPie, isPlotlySpecEmpty } from "@/lib/admin/individuals-analytics-charts";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { cn } from "@/lib/utils";

const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asDecadeRows(v: unknown): { label: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!isRecord(row)) return null;
      const decade = row.decade;
      const count = row.count;
      return {
        label: decade != null ? String(decade) : "—",
        count: typeof count === "number" ? count : Number(count) || 0,
      };
    })
    .filter((x): x is { label: string; count: number } => x != null);
}

function asBucketRows(v: unknown): { label: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!isRecord(row)) return null;
      const bucket = row.bucket;
      const count = row.count;
      return {
        label: bucket != null ? String(bucket) : "—",
        count: typeof count === "number" ? count : Number(count) || 0,
      };
    })
    .filter((x): x is { label: string; count: number } => x != null);
}

function asCountryRows(v: unknown): { label: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!isRecord(row)) return null;
      const country = row.country;
      const count = row.count;
      return {
        label: country != null ? String(country) : "—",
        count: typeof count === "number" ? count : Number(count) || 0,
      };
    })
    .filter((x): x is { label: string; count: number } => x != null);
}

type LifespanRow = {
  id?: string;
  full_name?: string | null;
  age_at_death?: number | null;
  birth_year?: number | null;
  death_year?: number | null;
  sex?: string | null;
};

function asLifespanRows(v: unknown): LifespanRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!isRecord(row)) return null;
      return row as LifespanRow;
    })
    .filter((x): x is LifespanRow => x != null);
}

function decadeChartLabel(raw: string): string {
  const n = Number(raw);
  if (Number.isFinite(n) && raw.trim() !== "") return `${Math.trunc(n)}s`;
  return raw;
}

function formatSummaryNumber(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString();
  return n.toFixed(1);
}

const STAT_NAV: { groupTitle: string; links: { id: string; label: string }[] }[] = [
  {
    groupTitle: "Overview",
    links: [
      { id: "admin-indiv-stat-population", label: "Population" },
      { id: "admin-indiv-stat-family-roles", label: "Family roles" },
      { id: "admin-indiv-stat-lifespan", label: "Lifespan averages" },
      { id: "admin-indiv-stat-associations", label: "Associations" },
    ],
  },
  {
    groupTitle: "Rankings",
    links: [
      { id: "admin-indiv-stat-longest-lived", label: "Longest lived" },
      { id: "admin-indiv-stat-youngest-died", label: "Youngest died" },
    ],
  },
  {
    groupTitle: "Distributions",
    links: [
      { id: "admin-indiv-stat-sex", label: "Sex · living / deceased" },
      { id: "admin-indiv-stat-birth-decade", label: "Birth by decade" },
      { id: "admin-indiv-stat-death-decade", label: "Death by decade" },
      { id: "admin-indiv-stat-age-at-death", label: "Age at death" },
      { id: "admin-indiv-stat-birth-countries", label: "Top birth countries" },
    ],
  },
];

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
  children: React.ReactNode;
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

function LifespanTable({ rows }: { rows: LifespanRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rows (need age_at_death on individuals).</p>;
  }
  return (
    <div className="max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-base-content/8">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-base-content/10 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-3 pr-3">Name</th>
            <th className="py-2 pr-3">Age</th>
            <th className="py-2 pr-3">Sex</th>
            <th className="py-2 pr-3">Birth</th>
            <th className="py-2 pr-3">Death</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const displayName = stripSlashesFromName(r.full_name ?? "") || "—";
            const href = r.id?.trim() ? `/admin/individuals/${r.id.trim()}` : null;
            return (
            <tr key={r.id ?? `${r.full_name}-${r.age_at_death}`} className="border-b border-base-content/5 last:border-0">
              <td className="max-w-[200px] truncate py-1.5 pl-3 pr-3 text-base-content" title={displayName}>
                {href ? (
                  <Link href={href} className="link link-primary block max-w-full truncate font-medium">
                    {displayName}
                  </Link>
                ) : (
                  displayName
                )}
              </td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-base-content">{formatSummaryNumber(r.age_at_death)}</td>
              <td className="py-1.5 pr-3">{r.sex === "U" || r.sex == null ? "—" : r.sex}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums">{r.birth_year != null ? r.birth_year : "—"}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums">{r.death_year != null ? r.death_year : "—"}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Props = { data: Record<string, unknown> };

function useMinWidthLg() {
  const [lg, setLg] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return lg;
}

export function AdminIndividualsAnalyticsPanel({ data }: Props) {
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isLg = useMinWidthLg();
  const titleId = useId();

  useEffect(() => {
    queueMicrotask(() => setSidebarCollapsed(readAdminSidebarCollapsedFromStorage()));
    const onLayout = (e: Event) => {
      const ce = e as CustomEvent<AdminSidebarLayoutChangedDetail>;
      if (ce.detail?.collapsed != null) setSidebarCollapsed(ce.detail.collapsed);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) setSidebarCollapsed(readAdminSidebarCollapsedFromStorage());
    };
    window.addEventListener(ADMIN_SIDEBAR_LAYOUT_CHANGED_EVENT, onLayout);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ADMIN_SIDEBAR_LAYOUT_CHANGED_EVENT, onLayout);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const summary = isRecord(data.summary) ? data.summary : {};
  const num = (k: string) => summary[k];

  const familyRoles = isRecord(data.family_roles) ? data.family_roles : {};
  const lifespan = isRecord(data.lifespan_averages) ? data.lifespan_averages : {};
  const associations = isRecord(data.associations) ? data.associations : {};

  const oldest = asLifespanRows(data.oldest_lived);
  const youngest = asLifespanRows(data.youngest_died);

  const sexSpec = individualsSexDistributionPie({
    sex_by_living: isRecord(data.sex_by_living) ? data.sex_by_living : null,
    by_sex: data.by_sex,
  });

  const birthDec = asDecadeRows(data.birth_by_decade);
  const birthChart = verticalBarChart(
    birthDec.map((r) => decadeChartLabel(r.label)),
    birthDec.map((r) => r.count),
    "Birth year by decade",
    "Decade (start year)",
    "Individuals",
    { height: Math.min(520, 120 + birthDec.length * 28) },
  );

  const deathDec = asDecadeRows(data.death_by_decade);
  const deathChart = verticalBarChart(
    deathDec.map((r) => decadeChartLabel(r.label)),
    deathDec.map((r) => r.count),
    "Death year by decade",
    "Decade (start year)",
    "Individuals",
    { height: Math.min(520, 120 + deathDec.length * 28) },
  );

  const ageBuckets = asBucketRows(data.age_at_death_buckets);
  const ageChart = verticalBarChart(
    ageBuckets.map((r) => r.label),
    ageBuckets.map((r) => r.count),
    "Age at death",
    "Age bucket (years)",
    "Individuals",
  );

  const countries = asCountryRows(data.top_birth_countries).slice(0, 24);
  const countryChart = horizontalBarChart(
    countries.map((r) => r.label),
    countries.map((r) => r.count),
    "Top birth countries",
  );

  const goTo = useCallback((id: string) => {
    setNavOpen(false);
    queueMicrotask(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  const sidebarWidth = sidebarCollapsed ? "4.25rem" : "18rem";
  const fabLeftStyle: CSSProperties = isLg
    ? { left: `calc(${sidebarWidth} + 0.5rem)` }
    : { left: "max(0.75rem, env(safe-area-inset-left, 0px))" };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setNavOpen(true)}
        aria-expanded={navOpen}
        aria-controls="admin-individuals-stat-nav"
        title="Section navigator"
        aria-label="Open statistics section navigator"
        style={{ ...fabLeftStyle, top: "45%" }}
        className={cn(
          "fixed size-11 -translate-y-1/2 border-base-content/15 bg-base-200/95 text-base-content shadow-lg shadow-black/20 ring-1 ring-base-content/10 backdrop-blur-sm transition-[left] duration-200 ease-out",
          navOpen ? "z-[35]" : "z-[45]",
          "hover:border-base-content/25 hover:bg-base-200 hover:text-base-content",
        )}
      >
        <PanelLeft className="size-5" aria-hidden />
      </Button>

      <div className="min-w-0 space-y-8">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Grouped like the public statistics-test individuals block. The panel button is fixed to the viewport edge (past the
          sidebar on large screens).
        </p>
        <StatBlock
          id="admin-indiv-stat-population"
          title="Population"
          description="Row-level counts from gedcom_individuals_v2 for this admin tree."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryStat label="Total individuals" value={num("total")} />
            <SummaryStat label="Living" value={num("living")} />
            <SummaryStat label="Deceased" value={num("deceased")} />
            <SummaryStat label="With birth year" value={num("with_birth_year")} />
            <SummaryStat label="With death year" value={num("with_death_year")} />
          </div>
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-family-roles"
          title="Family roles"
          description="Child vs spouse roles from gedcom_family_children_v2 and partner columns on gedcom_families_v2."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              label="Only as child (not spouse in any family)"
              value={familyRoles.only_as_child}
            />
            <SummaryStat
              label="Only as spouse (not child in any family)"
              value={familyRoles.only_as_spouse}
            />
            <SummaryStat label="In multiple families as child" value={familyRoles.multiple_families_as_child} />
            <SummaryStat label="In multiple families as spouse" value={familyRoles.multiple_families_as_spouse} />
          </div>
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-lifespan"
          title="Lifespan averages"
          description="Mean age at death where age_at_death is populated."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryStat
              label="Avg lifespan · male (years)"
              value={lifespan.avg_lifespan_male}
              hint={
                lifespan.males_with_age_at_death != null
                  ? `n = ${formatSummaryNumber(lifespan.males_with_age_at_death)} with age_at_death`
                  : undefined
              }
            />
            <SummaryStat
              label="Avg lifespan · female (years)"
              value={lifespan.avg_lifespan_female}
              hint={
                lifespan.females_with_age_at_death != null
                  ? `n = ${formatSummaryNumber(lifespan.females_with_age_at_death)} with age_at_death`
                  : undefined
              }
            />
          </div>
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-associations"
          title="Associations"
          description="GEDCOM ASSO rows (gedcom_individual_associations_v2)."
        >
          <div className="max-w-md">
            <SummaryStat label="Association records" value={associations.association_records} />
          </div>
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-longest-lived"
          title="Longest lived"
          description="Top individuals by age_at_death (API top_n, default 10)."
        >
          <LifespanTable rows={oldest} />
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-youngest-died"
          title="Youngest died"
          description="Shortest age_at_death; useful for infant mortality."
        >
          <LifespanTable rows={youngest} />
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-sex"
          title="Sex · living / deceased"
          description="Prefer sex_by_living when present; zero-count slices omitted. Falls back to by_sex codes."
          chartOverflow
        >
          <PlotlyBlock
            spec={sexSpec}
            emptyMessage="Nothing to chart — every value is zero or there are no rows for this view."
            chartOverflow
          />
        </StatBlock>

        <div className="grid gap-6 lg:grid-cols-2">
          <StatBlock
            id="admin-indiv-stat-birth-decade"
            title="Birth year by decade"
            description="Individuals with a parsed birth year."
          >
            <PlotlyBlock
              spec={birthChart}
              emptyMessage="Nothing to chart — every value is zero or there are no rows for this view."
            />
          </StatBlock>
          <StatBlock
            id="admin-indiv-stat-death-decade"
            title="Death year by decade"
            description="Individuals with a parsed death year."
          >
            <PlotlyBlock
              spec={deathChart}
              emptyMessage="Nothing to chart — every value is zero or there are no rows for this view."
            />
          </StatBlock>
        </div>

        <StatBlock
          id="admin-indiv-stat-age-at-death"
          title="Age at death"
          description="Where age_at_death is populated."
        >
          <PlotlyBlock
            spec={ageChart}
            emptyMessage="Nothing to chart — every value is zero or there are no rows for this view."
          />
        </StatBlock>

        <StatBlock
          id="admin-indiv-stat-birth-countries"
          title="Top birth countries"
          description="From birth_country on the individual row (Unknown if blank)."
        >
          <PlotlyBlock
            spec={countryChart}
            emptyMessage="Nothing to chart — every value is zero or there are no rows for this view."
          />
        </StatBlock>
      </div>

      <div
        aria-hidden={!navOpen}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
      />

      <aside
        id="admin-individuals-stat-nav"
        role={navOpen ? "dialog" : undefined}
        aria-modal={navOpen ? true : undefined}
        aria-hidden={!navOpen}
        aria-labelledby={titleId}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-dvh w-[min(100vw-40px,320px)] flex-col border-r border-base-content/10 bg-base-200 shadow-2xl transition-transform duration-300 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-base-content/10 px-3 py-3">
          <p id={titleId} className="text-sm font-semibold text-base-content">
            Individuals statistics
          </p>
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X className="size-4" />
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Statistics sections">
          {STAT_NAV.map((g) => (
            <div key={g.groupTitle} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.groupTitle}</p>
              <ul className="space-y-0.5">
                {g.links.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => goTo(link.id)}
                      className="w-full rounded-lg px-2 py-2 text-left text-sm text-base-content transition-none hover:bg-base-300/50"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
