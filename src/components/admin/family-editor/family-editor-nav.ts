import type { LucideIcon } from "lucide-react";
import { Baby, BookOpen, CalendarDays, Image, Lock, StickyNote, Users } from "lucide-react";

export type FamilyEditorSectionId =
  | "family-partners"
  | "family-timeline"
  | "family-children"
  | "family-notes"
  | "family-media"
  | "family-sources"
  | "family-advanced";

export type FamilyEditorNavItem = {
  id: FamilyEditorSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const FAMILY_EDITOR_NAV: readonly FamilyEditorNavItem[] = [
  { id: "family-partners", label: "Partners", description: "The people in this relationship", icon: Users },
  {
    id: "family-timeline",
    label: "Relationship timeline",
    description: "Marriage, divorce, and more",
    icon: CalendarDays,
  },
  { id: "family-children", label: "Children", description: "Children in this relationship", icon: Baby },
  { id: "family-notes", label: "Notes", description: "Notes about this family", icon: StickyNote },
  { id: "family-media", label: "Media", description: "Photos and documents", icon: Image },
  { id: "family-sources", label: "Sources", description: "Source citations", icon: BookOpen },
  {
    id: "family-advanced",
    label: "Advanced details",
    description: "GEDCOM and technical fields",
    icon: Lock,
  },
] as const;
