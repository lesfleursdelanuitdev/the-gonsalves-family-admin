"use client";

import Link from "next/link";
import type { DashboardArchiveHealth } from "@/lib/admin/admin-dashboard-snapshot";
import { cn } from "@/lib/utils";

type Row = { label: string; pct: number };

function rowsFromHealth(h: DashboardArchiveHealth): Row[] {
  return [
    { label: "Linked media", pct: h.linkedMediaPct },
    { label: "Dated events", pct: h.datedEventsPct },
    { label: "Geocoded places", pct: h.geocodedPlacesPct },
    { label: "Sourced individuals", pct: h.sourcedFactsPct },
    { label: "People with photos", pct: h.peopleWithPhotosPct },
    { label: "People with stories", pct: h.peopleWithStoriesPct },
  ];
}

function RadialRing({ pct }: { pct: number }) {
  const r = 46;
  const stroke = 9;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative mx-auto flex size-[11.5rem] items-center justify-center">
      <div
        className="pointer-events-none absolute inset-2 rounded-full bg-primary/[0.12] blur-xl"
        aria-hidden
      />
      <svg viewBox="0 0 120 120" className="size-full -rotate-90 text-primary" aria-hidden>
        <defs>
          <linearGradient id="archiveHealthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          className="text-base-content/12"
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#archiveHealthGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="drop-shadow-[0_0_12px_rgba(47,125,64,0.35)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-heading text-3xl font-semibold tabular-nums text-base-content">{clamped}%</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Archive health
        </p>
      </div>
    </div>
  );
}

type Props = {
  health: DashboardArchiveHealth | null;
  isLoading: boolean;
};

export function DashboardArchiveHealthPanel({ health, isLoading }: Props) {
  const rows = health ? rowsFromHealth(health) : [];

  return (
    <section
      id="archive-health"
      className="scroll-mt-24 rounded-3xl border border-base-content/[0.08] bg-gradient-to-b from-base-200/50 to-base-300/30 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      aria-labelledby="archive-health-heading"
    >
      <h2 id="archive-health-heading" className="sr-only">
        Archive health
      </h2>
      {isLoading ? (
        <div className="space-y-4">
          <div className="skeleton mx-auto size-44 rounded-full" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : health ? (
        <>
          <RadialRing pct={health.score} />
          <ul className="mt-6 space-y-3.5">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-base-content/75">{row.label}</span>
                  <span className="tabular-nums text-base-content/55">{row.pct}%</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-content/[0.08]"
                  role="presentation"
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-primary/50 to-primary transition-[width] duration-500",
                    )}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-base-content/[0.08] pt-4">
            <Link href="/admin/changelog" className="text-xs font-medium text-primary hover:underline">
              View full health report
            </Link>
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Configure the tree to see archive health.</p>
      )}
    </section>
  );
}
