"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Heart, Image, Leaf, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import type { AdminDashboardSnapshot } from "@/lib/admin/admin-dashboard-snapshot";
import { cn } from "@/lib/utils";

type Props = {
  totals: AdminDashboardSnapshot["totals"] | null;
  lastImportAt: string | null;
  newThisWeek: AdminDashboardSnapshot["newThisWeek"];
  isLoading: boolean;
  canAccessHref?: (href: string) => boolean;
};

const summaryCards: ReadonlyArray<{
  key: "individuals" | "families" | "events" | "media";
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "individuals", href: "/admin/individuals", label: "Individuals", icon: Users },
  { key: "families", href: "/admin/families", label: "Families", icon: Heart },
  { key: "events", href: "/admin/events", label: "Events", icon: CalendarDays },
  { key: "media", href: "/admin/media", label: "Media", icon: Image },
];

function formatImportDate(iso: string | null): string {
  if (!iso) return "—";
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DashboardHeroSection({ totals, lastImportAt, newThisWeek, isLoading, canAccessHref }: Props) {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const displayName = user?.name?.trim() || user?.username || null;
  const visibleSummaryCards = summaryCards.filter((card) => (canAccessHref ? canAccessHref(card.href) : true));

  return (
    <section
      aria-labelledby="dashboard-hero-heading"
      className="relative overflow-hidden rounded-3xl border border-base-content/[0.09] bg-gradient-to-br from-primary/[0.14] via-base-200/50 to-base-300/55 px-6 py-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.55)] sm:px-10 sm:py-10"
    >
      <div
        className="pointer-events-none absolute -right-12 top-0 h-72 w-72 rounded-full bg-primary/[0.22] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 left-[20%] h-56 w-56 rounded-full bg-primary/[0.16] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-10 top-1/3 h-44 w-44 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-2xl"
        aria-hidden
      />

      <div className="relative flex min-w-0 flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div className="min-w-0 max-w-xl shrink-0 space-y-4">
          {userLoading ? (
            <div className="skeleton h-10 w-[min(100%,20rem)] rounded-lg" aria-hidden />
          ) : (
            <h1
              id="dashboard-hero-heading"
              className="font-heading text-3xl font-semibold tracking-tight text-base-content sm:text-4xl"
            >
              Welcome back{displayName ? `, ${displayName}` : ""}
              <Leaf
                className="ml-2 inline-block size-6 shrink-0 text-primary/85 sm:size-7"
                aria-hidden
                strokeWidth={1.25}
              />
            </h1>
          )}
          <p className="text-pretty text-sm leading-relaxed text-base-content/72 sm:text-base">
            Your family archive at a glance. Continue preserving stories, records, and connections.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-base-content/[0.08] pt-5 text-xs text-base-content/60">
            <span>
              <span className="font-medium text-base-content/80">Last import: </span>
              {isLoading ? "…" : formatImportDate(lastImportAt)}
            </span>
            <span className="hidden sm:inline text-base-content/25" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-medium text-base-content/80">New this week: </span>
              {isLoading ? (
                "…"
              ) : totals ? (
                <>
                  {newThisWeek.individuals.toLocaleString()} people, {newThisWeek.media.toLocaleString()} media,{" "}
                  {newThisWeek.events.toLocaleString()} events
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {visibleSummaryCards.map(({ key, href, label, icon: Icon }) => {
            const n = totals?.[key];
            return (
              <li key={key}>
                <Link
                  href={href}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-base-content/[0.08] bg-base-100/25 px-4 py-4 transition-all duration-200",
                    "hover:border-primary/35 hover:bg-base-100/40 hover:shadow-[0_0_0_1px_rgba(47,125,64,0.12),0_12px_40px_-16px_rgba(0,0,0,0.4)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-base-200",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/14 text-primary shadow-[0_0_24px_-4px_rgba(47,125,64,0.45)] transition group-hover:bg-primary/22">
                    <Icon className="size-[1.1rem]" aria-hidden />
                  </span>
                  <span className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <span className="mt-1 font-heading text-2xl font-semibold tabular-nums text-base-content">
                    {isLoading ? (
                      <span className="skeleton inline-block h-8 w-16 rounded-md" />
                    ) : typeof n === "number" ? (
                      n.toLocaleString()
                    ) : (
                      "—"
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
