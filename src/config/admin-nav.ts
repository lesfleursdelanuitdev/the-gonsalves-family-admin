import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Heart,
  UserCog,
  MessageSquare,
  Image,
  ListTree,
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
  DatabaseBackup,
  Clock,
  Tag,
  FolderOpen,
  Download,
  FileCheck,
  GitMerge,
  ScrollText,
  CircleHelp,
  Shield,
  KeyRound,
  Link2,
  ChefHat,
  SlidersHorizontal,
  Library,
  Inbox,
  Layers,
  ShieldCheck,
  UserPlus,
  HeartPulse,
  ClipboardList,
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
      { href: "/admin/attributes", label: "Attributes", icon: ClipboardList },
      { href: "/admin/event-types", label: "Event types", icon: CalendarDays },
      { href: "/admin/attribute-types", label: "Attribute types", icon: ClipboardList },
      { href: "/admin/places", label: "Places", icon: MapPin },
      { href: "/admin/notes", label: "Notes", icon: StickyNote },
      { href: "/admin/sources", label: "Sources", icon: BookOpen },
      { href: "/admin/repositories", label: "Repositories", icon: Library },
      { href: "/admin/relationship-types", label: "Relationship types", icon: Link2 },
    ],
  },
  {
    label: "GEDCOM",
    items: [
      { href: "/admin/gedcom/export", label: "Export", icon: Download },
      { href: "/admin/gedcom/validator", label: "Validator", icon: FileCheck },
      { href: "/admin/merge-records", label: "Merge records", icon: GitMerge },
    ],
  },
  {
    label: "Research",
    items: [{ href: "/admin/open-questions", label: "Open Questions", icon: CircleHelp }],
  },
  {
    label: "Media & archive",
    items: [
      { href: "/admin/media", label: "Media", icon: Image },
      { href: "/admin/timelines", label: "Timelines", icon: ListTree },
      { href: "/admin/stories", label: "Stories", icon: ScrollText },
      { href: "/admin/recipes", label: "Recipes", icon: ChefHat },
      { href: "/admin/glossary", label: "Words & phrases", icon: BookOpen },
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
      { href: "/admin/contact-inbox", label: "Site messages", icon: Inbox },
      { href: "/admin/contributions", label: "Contributions", icon: Layers },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Users & access",
    items: [
      { href: "/admin/users", label: "Users & access", icon: UserCog },
      { href: "/admin/roles", label: "Roles", icon: Shield },
      { href: "/admin/permissions", label: "Permissions", icon: KeyRound },
      { href: "/admin/access-requests", label: "Access requests", icon: ShieldCheck },
      { href: "/admin/registration-requests", label: "Registration requests", icon: UserPlus },
    ],
  },
  {
    label: "Utilities",
    items: [
      { href: "/admin/place-resolution", label: "Place resolution", icon: Layers },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/backups", label: "Backups", icon: DatabaseBackup },
      { href: "/admin/cron", label: "Scheduled jobs", icon: Clock },
      { href: "/admin/changelog", label: "Changelog", icon: History },
      { href: "/admin/site-health", label: "Site health", icon: HeartPulse },
      { href: "/admin/site-settings", label: "Site settings", icon: SlidersHorizontal },
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
