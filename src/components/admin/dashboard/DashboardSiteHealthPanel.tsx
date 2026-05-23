"use client";

import Link from "next/link";
import { CheckCircle2, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLatestHealthRun } from "@/hooks/useAdminSiteHealth";
import type { CheckResult } from "@/lib/health/types";

const CATEGORY_ORDER = ["data_integrity", "media", "community", "user_hygiene"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  data_integrity: "Data Integrity",
  media: "Media",
  community: "Community",
  user_hygiene: "User Hygiene",
};

function groupByCategory(results: CheckResult[]): { category: string; items: CheckResult[] }[] {
  const map = new Map<string, CheckResult[]>();
  for (const r of results) {
    if (r.count <= 0) continue;
    const bucket = map.get(r.category);
    if (bucket) bucket.push(r);
    else map.set(r.category, [r]);
  }
  return CATEGORY_ORDER
    .filter((cat) => map.has(cat))
    .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat] ?? cat, items: map.get(cat)! })) as {
      category: string;
      items: CheckResult[];
    }[];
}

export function DashboardSiteHealthPanel() {
  const { data, isLoading } = useLatestHealthRun();

  const groups = data ? groupByCategory(data.results) : [];
  const totalIssues = data?.totalIssues ?? 0;
  const allClear = !isLoading && data != null && totalIssues === 0;

  return (
    <section
      id="site-health"
      className="scroll-mt-24 rounded-3xl border border-base-content/[0.08] bg-gradient-to-b from-base-200/50 to-base-300/30 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      aria-labelledby="site-health-heading"
    >
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="size-4 text-primary" aria-hidden />
          <h2 id="site-health-heading" className="text-sm font-semibold text-base-content">
            Site health
          </h2>
        </div>
        {!isLoading && data ? (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              totalIssues === 0
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning",
            )}
          >
            {totalIssues === 0 ? "All clear" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-full rounded-lg" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">
          No report yet.{" "}
          <Link href="/admin/site-health" className="font-medium text-primary hover:underline">
            Run a health check
          </Link>{" "}
          to see results here.
        </p>
      ) : allClear ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-8 text-success" aria-hidden />
          <p className="text-sm font-medium text-base-content">No issues found</p>
          <p className="text-xs text-muted-foreground">The last run found nothing to fix.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {groups.map(({ category, items }) => (
            <li key={category}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.checkKey} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-base-content/75">{item.label}</span>
                    <span className="shrink-0 tabular-nums text-warning">{item.count}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {data ? (
        <div className="mt-5 border-t border-base-content/[0.08] pt-4">
          <Link href="/admin/site-health" className="text-xs font-medium text-primary hover:underline">
            View full health report →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
