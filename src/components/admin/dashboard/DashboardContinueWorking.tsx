"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarPlus,
  FileCheck,
  FolderPlus,
  GitMerge,
  ImagePlus,
  ListTree,
  ScrollText,
  Sparkles,
  StickyNote,
  Tag,
  Upload,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Group = {
  id: string;
  title: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }>;
};

const groups: Group[] = [
  {
    id: "research",
    title: "Research",
    items: [
      { href: "/admin/individuals/new", label: "Add Individual", icon: UserPlus },
      { href: "/admin/families/new", label: "Add Family", icon: UsersRound },
      { href: "/admin/events/new", label: "Add Event", icon: CalendarPlus },
      { href: "/admin/notes/new", label: "Add Note", icon: StickyNote },
    ],
  },
  {
    id: "archive-media",
    title: "Archive & media",
    items: [
      { href: "/admin/media/new", label: "Upload Media", icon: Upload },
      { href: "/admin/albums/new", label: "Create Album", icon: FolderPlus },
      { href: "/admin/tags", label: "Tag Media", icon: Tag },
      { href: "/admin/media", label: "Review Unlinked Media", icon: ImagePlus },
    ],
  },
  {
    id: "storytelling",
    title: "Storytelling",
    items: [
      { href: "/admin/stories/new", label: "Create Story", icon: BookOpen },
      { href: "/admin/stories", label: "Open Drafts", icon: ScrollText },
      { href: "/admin/timelines", label: "Timeline Builder", icon: ListTree },
    ],
  },
  {
    id: "tree",
    title: "Tree management",
    items: [
      { href: "/admin/gedcom/validator", label: "Validate GEDCOM", icon: FileCheck },
      { href: "/admin/merge-records", label: "Merge Records", icon: GitMerge },
      { href: "/admin/merge-records?tab=review", label: "Review Suggestions", icon: Sparkles },
    ],
  },
];

type Props = {
  suggestionBadgeCount: number;
};

export function DashboardContinueWorking({ suggestionBadgeCount }: Props) {
  const merged = groups.map((g) =>
    g.id === "tree"
      ? {
          ...g,
          items: g.items.map((it) =>
            it.label === "Review Suggestions" ? { ...it, badge: suggestionBadgeCount } : it,
          ),
        }
      : g,
  );

  return (
    <section
      aria-labelledby="continue-working-heading"
      className="rounded-3xl border border-base-content/[0.08] bg-gradient-to-b from-base-200/45 to-base-200/15 p-6 sm:p-8"
    >
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/85">Workspace</p>
          <h2
            id="continue-working-heading"
            className="mt-1 font-heading text-xl font-semibold tracking-tight text-base-content sm:text-2xl"
          >
            Continue working
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-base-content/65">
            Curated shortcuts into the tools you use most — arranged like a desk, not a menu.
          </p>
        </div>
        <Link
          href="/admin/changelog"
          className="text-xs font-medium text-primary hover:underline sm:mb-0.5"
        >
          My shortcuts → changelog
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {merged.map((group) => (
          <div
            key={group.id}
            className="flex min-h-[14rem] flex-col rounded-2xl border border-base-content/[0.07] bg-base-100/20 p-5 shadow-sm transition hover:border-primary/25 hover:bg-base-100/30"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            <ul className="mt-4 flex flex-1 flex-col gap-1.5">
              {group.items.map(({ href, label, icon: Icon, badge }) => (
                <li key={href + label}>
                  <Link
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
                      "hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition group-hover:bg-primary/20">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-base-content">{label}</span>
                    {typeof badge === "number" && badge > 0 ? (
                      <span className="shrink-0 rounded-md bg-warning/18 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warning">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
