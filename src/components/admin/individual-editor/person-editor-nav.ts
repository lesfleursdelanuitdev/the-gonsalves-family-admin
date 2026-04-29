import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  CaseSensitive,
  Image,
  StickyNote,
  User,
  Users,
} from "lucide-react";

export type PersonEditorSectionId =
  | "person-basic"
  | "person-names"
  | "person-events"
  | "person-relationships"
  | "person-notes"
  | "person-media"
  | "person-sources";

export type PersonEditorNavItem = {
  id: PersonEditorSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const PERSON_EDITOR_NAV: readonly PersonEditorNavItem[] = [
  { id: "person-basic", label: "Basic info", description: "Name, sex, living status", icon: User },
  { id: "person-names", label: "Names", description: "Primary & alternate names", icon: CaseSensitive },
  { id: "person-events", label: "Life events", description: "Birth, death, and more", icon: CalendarDays },
  { id: "person-relationships", label: "Relationships", description: "Parents, partners, children", icon: Users },
  { id: "person-notes", label: "Notes", description: "Stories and research notes", icon: StickyNote },
  { id: "person-media", label: "Media", description: "Photos and documents", icon: Image },
  { id: "person-sources", label: "Sources", description: "Citations and references", icon: BookOpen },
] as const;

/** Used for relationship hub subsection anchors */
export const PERSON_REL_PARENTS_ID = "person-rel-parents";
export const PERSON_REL_PARTNERS_ID = "person-rel-partners";
export const PERSON_REL_CHILDREN_ID = "person-rel-children";
