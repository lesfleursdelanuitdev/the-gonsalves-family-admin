"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ChevronRight,
  History,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { DashboardSiteHealthPanel } from "@/components/admin/dashboard/DashboardSiteHealthPanel";
import { DashboardContinueWorking } from "@/components/admin/dashboard/DashboardContinueWorking";
import { DashboardDiscoverySection } from "@/components/admin/dashboard/DashboardDiscoverySection";
import { DashboardHeroSection } from "@/components/admin/dashboard/DashboardHeroSection";
import { DashboardInsightsOverview } from "@/components/admin/dashboard/DashboardInsightsOverview";
import { DashboardRecentActivity } from "@/components/admin/dashboard/DashboardRecentActivity";
import { useAdminHrefPermissions } from "@/hooks/useAdminAuthz";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { cn } from "@/lib/utils";

export function DashboardHome() {
  const { data, isLoading, isError } = useAdminDashboard();
  const dashboardLinks = useMemo(
    () => [
      "/admin/messages",
      "/admin/changelog",
      "/admin/individuals",
      "/admin/families",
      "/admin/events",
      "/admin/media",
      "/admin/individuals/new",
      "/admin/families/new",
      "/admin/events/new",
      "/admin/notes/new",
      "/admin/media/new",
      "/admin/albums/new",
      "/admin/tags",
      "/admin/stories/new",
      "/admin/stories",
      "/admin/gedcom/validator",
      "/admin/merge-records",
      "/admin/merge-records?tab=review",
      "/admin/place-resolution",
    ],
    [],
  );
  const dashboardPermissions = useAdminHrefPermissions(dashboardLinks);

  const unread = data?.unreadMessages ?? 0;
  const updates = data?.configured ? data.recentUpdatesCount : 0;
  const configured = Boolean(data?.configured);

  const suggestionBadge =
    data?.configured && data.needsAttention
      ? (data.needsAttention.find((r) => r.id === "duplicates")?.count ?? 0)
      : 0;

  const pendingPlaceGroups = data?.configured ? (data.pendingPlaceGroups ?? 0) : 0;
  const snap = data && data.configured ? data : null;
  const totals = snap?.totals ?? null;
  const lastImportAt = snap?.lastImportAt ?? data?.lastImportAt ?? null;
  const newThisWeek = snap?.newThisWeek ?? data?.newThisWeek ?? { individuals: 0, media: 0, events: 0 };
  const heatmap = data?.heatmap ?? [];
  const insights = snap?.insights ?? null;
  const discoveries = snap?.discoveries ?? [];
  const activity = data?.activity ?? [];

  return (
    <div className="w-full min-w-0 space-y-10 pb-8">
      <header className="sr-only">
        <h1>Dashboard</h1>
      </header>

      <DashboardHeroSection
        totals={totals}
        lastImportAt={lastImportAt}
        newThisWeek={newThisWeek}
        isLoading={isLoading}
        canAccessHref={dashboardPermissions.canAccessHref}
      />

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {dashboardPermissions.canAccessHref("/admin/messages") ? (
          <Link
            href="/admin/messages"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-base-content/[0.08] bg-base-200/25 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-base-200/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <MessageSquare className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Messages</p>
                <p className="truncate text-sm font-medium text-base-content">
                  {isLoading ? "…" : `${unread} new`}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-base-content/35 transition group-hover:text-primary" aria-hidden />
          </Link>
        ) : null}
        {dashboardPermissions.canAccessHref("/admin/changelog") ? (
          <Link
            href="/admin/changelog"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-base-content/[0.08] bg-base-200/25 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-base-200/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <History className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Updates</p>
                <p className="truncate text-sm font-medium text-base-content">
                  {isLoading ? "…" : configured ? `${updates} this week` : "—"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-base-content/35 transition group-hover:text-primary" aria-hidden />
          </Link>
        ) : null}
        {dashboardPermissions.canAccessHref("/admin/place-resolution") ? (
          <Link
            href="/admin/place-resolution"
            className={cn(
              "group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors",
              !isLoading && pendingPlaceGroups > 0
                ? "border-warning/30 bg-warning/[0.06] hover:border-warning/50 hover:bg-warning/[0.10]"
                : "border-base-content/[0.08] bg-base-200/25 hover:border-primary/30 hover:bg-base-200/40",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                !isLoading && pendingPlaceGroups > 0 ? "bg-warning/15 text-warning" : "bg-primary/12 text-primary",
              )}>
                <MapPin className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Place resolution</p>
                <p className="truncate text-sm font-medium text-base-content">
                  {isLoading ? "…" : configured ? `${pendingPlaceGroups} group${pendingPlaceGroups === 1 ? "" : "s"} pending` : "—"}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              "size-4 shrink-0 transition",
              !isLoading && pendingPlaceGroups > 0
                ? "text-warning/50 group-hover:text-warning"
                : "text-base-content/35 group-hover:text-primary",
            )} aria-hidden />
          </Link>
        ) : null}
      </section>

      <div
        className={cn(
          "grid gap-8 xl:grid-cols-[minmax(0,1fr)_18.5rem] xl:items-start",
          "xl:gap-10",
        )}
      >
        <div className="flex min-w-0 flex-col gap-10">
          <DashboardContinueWorking
            suggestionBadgeCount={suggestionBadge}
            canAccessHref={dashboardPermissions.canAccessHref}
          />
          <div
            className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-transparent p-4 text-xs leading-relaxed text-base-content/70"
            role="note"
          >
            <span className="font-semibold text-primary/90">Tip: </span>
            Link a few portraits each session — faces make the archive feel inhabited for everyone who visits.
          </div>

          <DashboardInsightsOverview
            insights={insights}
            individualsTotal={totals?.individuals ?? 0}
            isLoading={isLoading}
            heatmapDays={heatmap}
          />

          <DashboardRecentActivity activity={activity} isLoading={isLoading} configured={configured} />

          <DashboardDiscoverySection items={discoveries} isLoading={isLoading} />
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4">
          <DashboardSiteHealthPanel />
        </aside>
      </div>

      {!isLoading && data && !data.configured ? (
        <div
          role="status"
          className="rounded-xl border border-base-content/[0.1] bg-base-200/25 px-4 py-3 text-sm text-base-content/80"
        >
          <span className="font-medium text-base-content">Tree not fully configured.</span>{" "}
          <span className="text-base-content/70">{data.setupMessage}</span>{" "}
          <Link href="/admin/settings" className="link link-primary text-sm font-medium">
            Settings
          </Link>
        </div>
      ) : null}

      {isError ? (
        <p className="text-sm text-error">Could not load dashboard data. Refresh the page to try again.</p>
      ) : null}
    </div>
  );
}
