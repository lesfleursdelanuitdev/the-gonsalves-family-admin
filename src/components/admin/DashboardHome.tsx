"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  History,
  Heart,
  Image,
  MessageSquare,
  ScrollText,
  StickyNote,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardWelcome } from "@/components/admin/DashboardWelcome";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import type {
  AdminDashboardSnapshot,
  DashboardActivityItem,
} from "@/lib/admin/admin-dashboard-snapshot";
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

type DashboardTotalsKey = keyof AdminDashboardSnapshot["totals"];

const coreSections: ReadonlyArray<{
  countKey: DashboardTotalsKey;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    countKey: "individuals",
    href: "/admin/individuals",
    title: "Individuals",
    description: "People in your tree — names, facts, and links.",
    icon: Users,
  },
  {
    countKey: "families",
    href: "/admin/families",
    title: "Families",
    description: "Spouses, children, and household groupings.",
    icon: Heart,
  },
  {
    countKey: "events",
    href: "/admin/events",
    title: "Events",
    description: "Births, marriages, residences, and other life events.",
    icon: CalendarDays,
  },
  {
    countKey: "media",
    href: "/admin/media",
    title: "Media",
    description: "Photos, documents, and other files linked to the tree.",
    icon: Image,
  },
  {
    countKey: "stories",
    href: "/admin/stories",
    title: "Stories",
    description: "Narratives and articles built in the story editor.",
    icon: ScrollText,
  },
  {
    countKey: "notes",
    href: "/admin/notes",
    title: "Notes",
    description: "GEDCOM notes attached to people, families, and sources.",
    icon: StickyNote,
  },
  {
    countKey: "sources",
    href: "/admin/sources",
    title: "Sources",
    description: "Citations, repositories, and evidence for facts.",
    icon: BookOpen,
  },
];

const quickActionCards: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    href: "/admin/individuals/new",
    title: "Add Individual",
    description: "Create a new person in your tree",
    icon: UserPlus,
  },
  {
    href: "/admin/media/new",
    title: "Upload Media",
    description: "Add photos, documents, and files",
    icon: Upload,
  },
  {
    href: "/admin/stories/new",
    title: "Create Story",
    description: "Write a rich family story",
    icon: BookOpen,
  },
  {
    href: "/admin/events/new",
    title: "Add Event",
    description: "Record a life event",
    icon: CalendarPlus,
  },
];

export function DashboardHome() {
  const { data, isLoading, isError } = useAdminDashboard();

  const unread = data?.unreadMessages ?? 0;
  const updates = data?.configured ? data.recentUpdatesCount : 0;
  const attention = data?.needsAttentionTotal ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-4">
      <header className="space-y-4">
        <div className="prose prose-invert prose-evergreen max-w-none">
          <h1 className="font-heading text-base-content">Dashboard</h1>
        </div>
        <DashboardWelcome />
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-base-content/75">
          A calm view of what changed and what might deserve a quick pass — then jump into the tree when you are ready.
        </p>
      </header>

      {/* Status summary — three compact, clickable strips */}
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/messages"
          className="group flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/20 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-base-200/35"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <MessageSquare className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Messages</p>
              <p className="truncate text-sm font-medium text-base-content">
                {isLoading ? "…" : `${unread} new`}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-base-content/35 transition group-hover:text-primary" aria-hidden />
        </Link>
        <Link
          href="/admin/changelog"
          className="group flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/20 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-base-200/35"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <History className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updates</p>
              <p className="truncate text-sm font-medium text-base-content">
                {isLoading ? "…" : data?.configured ? `${updates} recent` : "—"}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-base-content/35 transition group-hover:text-primary" aria-hidden />
        </Link>
        <Link
          href="#needs-attention"
          className="group flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/20 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-base-200/35"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</p>
              <p className="truncate text-sm font-medium text-base-content">
                {isLoading ? "…" : `${attention.toLocaleString()} items`}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-base-content/35 transition group-hover:text-primary" aria-hidden />
        </Link>
      </section>

      {/* Primary entry points — full-width action cards */}
      <section
        aria-labelledby="dashboard-quick-actions-heading"
        className="rounded-2xl border border-primary/15 bg-gradient-to-b from-base-200/40 to-base-200/20 p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] sm:p-8"
      >
        <div className="mb-6 max-w-2xl space-y-2 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Quick actions</p>
          <h2
            id="dashboard-quick-actions-heading"
            className="font-heading text-xl font-semibold tracking-tight text-base-content sm:text-2xl"
          >
            Start something new
          </h2>
        </div>
        <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:gap-6 md:grid-cols-2">
          {quickActionCards.map(({ href, title, description, icon: Icon }) => (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                className={cn(
                  "group relative flex h-full min-h-[9.5rem] flex-col rounded-2xl border border-base-content/12 bg-base-200/50 p-5 shadow-sm transition-all duration-200",
                  "outline-none hover:border-primary/35 hover:bg-base-200/70 hover:shadow-md hover:shadow-primary/[0.07]",
                  "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base-200",
                )}
              >
                <div className="flex flex-1 flex-col gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/14 text-primary transition-colors group-hover:bg-primary/22 group-hover:text-primary">
                    <Icon className="size-7" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1 pr-8">
                    <span className="block text-base font-semibold leading-snug text-base-content">{title}</span>
                    <span className="block text-sm leading-snug text-base-content/60">{description}</span>
                  </div>
                </div>
                <ChevronRight
                  className="pointer-events-none absolute bottom-5 right-5 size-5 text-base-content/25 transition group-hover:translate-x-0.5 group-hover:text-primary/80"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {!isLoading && data && !data.configured ? (
        <div
          role="status"
          className="rounded-xl border border-base-content/12 bg-base-200/25 px-4 py-3 text-sm text-base-content/80"
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

      {/* Main two-column area */}
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <Card className="border-base-content/10 bg-base-200/15 shadow-none">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold tracking-tight">Recent activity</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Messages and tree edits, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            {isLoading ? (
              <ul className="divide-y divide-base-content/8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex gap-3 py-3">
                    <div className="skeleton size-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-4 w-[65%] max-w-[14rem] rounded" />
                      <div className="skeleton h-3 w-full max-w-[20rem] rounded" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : data?.configured && data.activity.length > 0 ? (
              <ul className="divide-y divide-base-content/8">
                {data.activity.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={activityHref(item)}
                      className="flex gap-3 py-3.5 transition-colors hover:bg-base-content/[0.04] -mx-1 px-1 rounded-lg"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-base-content/10 bg-base-100/40",
                          item.kind === "message" ? "text-primary" : "text-base-content/70",
                        )}
                      >
                        {item.kind === "message" ? (
                          <MessageSquare className="size-4" aria-hidden />
                        ) : (
                          <History className="size-4" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-base-content">{item.headline}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-base-content/55">{item.body}</p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {shortRelative(item.occurredAt)} · {item.actor}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity yet.</p>
            )}
            {data?.configured ? (
              <div className="border-t border-base-content/8 pt-3">
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

        <Card
          id="needs-attention"
          className="scroll-mt-24 border-base-content/10 bg-base-200/15 shadow-none ring-1 ring-warning/10"
        >
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold tracking-tight">Needs attention</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Heuristic counts — use them as a gentle checklist, not a grade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            {isLoading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : data?.configured && data.needsAttention.length > 0 ? (
              <ul className="divide-y divide-base-content/8">
                {data.needsAttention.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="flex items-start justify-between gap-4 py-3.5 transition-colors hover:bg-base-content/[0.04] -mx-1 px-1 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-base-content">{row.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-base-content/55">{row.description}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-warning/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
                        {row.count.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {data?.configured ? "Nothing flagged right now." : "Configure the tree to see checklist items."}
              </p>
            )}
            {data?.configured ? (
              <div className="border-t border-base-content/8 pt-3">
                <Link href="/admin/changelog" className="link link-primary text-xs font-medium">
                  View all activity
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Core tree sections */}
      <section aria-label="Core sections" className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tree</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {coreSections.map(({ countKey, href, title, description, icon: Icon }) => {
            const count =
              data?.configured && data.totals ? data.totals[countKey] : null;
            return (
              <Card key={href} className="group flex flex-col border-base-content/10 bg-base-200/15 shadow-none">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="size-[1.15rem]" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
                    <CardDescription className="text-xs leading-snug">{description}</CardDescription>
                    {count != null ? (
                      <p className="pt-1 text-[11px] font-medium tabular-nums text-base-content/50">
                        {count.toLocaleString()} records
                      </p>
                    ) : isLoading ? (
                      <div className="skeleton mt-1 h-3 w-16 rounded" />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Link
                    href={href}
                    className="btn btn-outline btn-sm border-primary/50 text-primary hover:border-primary hover:bg-primary hover:text-primary-content"
                  >
                    Open
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
