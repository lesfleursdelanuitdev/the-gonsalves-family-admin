import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Heart,
  UserCog,
  MessageSquare,
  Image,
  CalendarDays,
  UserCircle,
  StickyNote,
  BookOpen,
  MapPin,
  CalendarRange,
  CaseSensitive,
  CaseUpper,
  Settings,
  History,
  Tag,
  FolderOpen,
  Download,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Grouped main nav — section labels are hidden when the sidebar is collapsed. */
export type AdminNavSection = {
  /** Omit or use empty string to skip a heading (e.g. lone Dashboard). */
  label?: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Tree",
    items: [
      { href: "/admin/individuals", label: "Individuals", icon: Users },
      { href: "/admin/families", label: "Families", icon: Heart },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/places", label: "Places", icon: MapPin },
      { href: "/admin/notes", label: "Notes", icon: StickyNote },
      { href: "/admin/sources", label: "Sources", icon: BookOpen },
      { href: "/admin/export", label: "Export", icon: Download },
    ],
  },
  {
    label: "Media & archive",
    items: [
      { href: "/admin/media", label: "Media", icon: Image },
      { href: "/admin/albums", label: "Albums", icon: FolderOpen },
      { href: "/admin/tags", label: "Tags", icon: Tag },
    ],
  },
  {
    label: "Indexes",
    items: [
      { href: "/admin/dates", label: "Dates", icon: CalendarRange },
      { href: "/admin/given-names", label: "Given names", icon: CaseSensitive },
      { href: "/admin/surnames", label: "Surnames", icon: CaseUpper },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/users", label: "Users & access", icon: UserCog },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/changelog", label: "Changelog", icon: History },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Footer strip — kept minimal (account). */
export const adminNavBottom: AdminNavItem[] = [{ href: "/admin/profile", label: "Profile", icon: UserCircle }];

/** @deprecated Use `adminNavSections` — flat list for tests or legacy callers. */
export const adminNavItems: AdminNavItem[] = adminNavSections.flatMap((s) => s.items);

export function isAdminNavActive(href: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (h === "/admin") {
    return p === "/admin";
  }
  return p === h || p.startsWith(`${h}/`);
}
