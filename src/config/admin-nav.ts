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
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/individuals", label: "Individuals", icon: Users },
  { href: "/admin/families", label: "Families", icon: Heart },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/notes", label: "Notes", icon: StickyNote },
  { href: "/admin/places", label: "Places", icon: MapPin },
  { href: "/admin/dates", label: "Dates", icon: CalendarRange },
  { href: "/admin/given-names", label: "Given names", icon: CaseSensitive },
  { href: "/admin/surnames", label: "Surnames", icon: CaseUpper },
  { href: "/admin/sources", label: "Sources", icon: BookOpen },
  { href: "/admin/media", label: "Media", icon: Image },
  { href: "/admin/users", label: "Users & access", icon: UserCog },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/changelog", label: "Changelog", icon: History },
];

export const adminNavBottom: AdminNavItem[] = [
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/profile", label: "Profile", icon: UserCircle },
];

export function isAdminNavActive(href: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (h === "/admin") {
    return p === "/admin";
  }
  return p === h || p.startsWith(`${h}/`);
}
