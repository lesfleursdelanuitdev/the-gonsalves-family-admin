"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardActivityItem } from "@/lib/admin/admin-dashboard-snapshot";
import { cn } from "@/lib/utils";

function shortRelative(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "";
  const sec = Math.floor((Date.now() - d) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function activityHref(item: DashboardActivityItem): string {
  if (item.kind === "message") return "/admin/messages";
  return `/admin/changelog/${encodeURIComponent(item.id)}`;
}

function kindLabel(kind: DashboardActivityItem["kind"]): string {
  if (kind === "message") return "Message";
  return "Tree edit";
}

type Props = {
  activity: DashboardActivityItem[];
  isLoading: boolean;
  configured: boolean;
};

const PAGE_SIZE = 3;

function clampPage(p: number, totalPages: number): number {
  return Math.min(Math.max(1, p), totalPages);
}

function buildPageList(totalPages: number, current: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    if (i > 0 && p - sorted[i - 1]! > 1) {
      out.push(-1);
    }
    out.push(p);
  }
  return out;
}

function PaginatedActivityBody({ activity }: { activity: DashboardActivityItem[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const safePage = clampPage(page, totalPages);
  const pageItems = activity.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showPager = activity.length > PAGE_SIZE;
  const pageNumbers = showPager ? buildPageList(totalPages, safePage) : [];

  return (
    <>
      <ul className="divide-y divide-base-content/[0.07]">
        {pageItems.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <Link
              href={activityHref(item)}
              className="flex gap-3.5 py-4 transition-colors hover:bg-base-content/[0.04] -mx-2 rounded-xl px-2"
            >
              <div className="relative shrink-0">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border border-base-content/[0.08] bg-base-100/35",
                    item.kind === "message" ? "text-primary" : "text-base-content/70",
                  )}
                >
                  {item.kind === "message" ? (
                    <MessageSquare className="size-[1.1rem]" aria-hidden />
                  ) : (
                    <History className="size-[1.1rem]" aria-hidden />
                  )}
                </span>
                <span className="absolute -bottom-1 -right-1 rounded bg-base-300/90 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-base-content/55">
                  {kindLabel(item.kind)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-base-content">{item.headline}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-base-content/58">{item.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-base-content/50">{item.actor}</span>
                  <span className="mx-1.5 text-base-content/25">·</span>
                  {shortRelative(item.occurredAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {showPager ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t border-base-content/[0.07] py-3"
          aria-label="Recent activity pages"
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1 px-2 text-xs font-medium text-base-content/80 disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => clampPage(p - 1, totalPages))}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {pageNumbers.map((n, idx) =>
              n === -1 ? (
                <span key={`e-${idx}`} className="px-1 text-xs text-base-content/35" aria-hidden>
                  …
                </span>
              ) : n === safePage ? (
                <span
                  key={n}
                  className="inline-flex min-w-8 items-center justify-center rounded-md bg-primary px-2 py-1.5 text-xs font-semibold tabular-nums text-primary-content"
                  aria-current="page"
                >
                  {n}
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className="btn btn-ghost btn-sm min-w-8 px-2 text-xs font-medium tabular-nums text-base-content/75"
                  onClick={() => setPage(clampPage(n, totalPages))}
                >
                  {n}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1 px-2 text-xs font-medium text-base-content/80 disabled:opacity-40"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => clampPage(p + 1, totalPages))}
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      ) : null}
    </>
  );
}

export function DashboardRecentActivity({ activity, isLoading, configured }: Props) {
  const activityKey = useMemo(
    () => activity.map((a) => `${a.kind}-${a.id}`).join("|"),
    [activity],
  );

  return (
    <Card className="border-base-content/[0.08] bg-base-200/20 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">Recent activity</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Imports, stories, media links, and edits — newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0 pt-0">
        {isLoading ? (
          <ul className="divide-y divide-base-content/[0.07]">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <li key={i} className="flex gap-3 py-4">
                <div className="skeleton size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton h-4 w-[70%] max-w-[16rem] rounded" />
                  <div className="skeleton h-3 w-full max-w-[22rem] rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : configured && activity.length > 0 ? (
          <PaginatedActivityBody key={activityKey} activity={activity} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No recent activity yet.</p>
        )}

        {configured ? (
          <div className="border-t border-base-content/[0.07] pt-3">
            <Link href="/admin/messages" className="link link-primary text-xs font-medium">
              Inbox
            </Link>
            <span className="mx-2 text-base-content/25">·</span>
            <Link href="/admin/changelog" className="link link-primary text-xs font-medium">
              Full changelog
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
