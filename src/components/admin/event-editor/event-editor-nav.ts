import type { LucideIcon } from "lucide-react";
import { AlignLeft, CalendarDays, CircleHelp, FileText, Image, Link2, Lock, MapPin, Tag } from "lucide-react";

export type EventEditorSectionId =
  | "event-type"
  | "event-date"
  | "event-place"
  | "event-details"
  | "event-linked"
  | "event-notes"
  | "event-media"
  | "event-open-questions"
  | "event-advanced";

export type EventEditorNavItem = {
  id: EventEditorSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const EVENT_EDITOR_NAV: readonly EventEditorNavItem[] = [
  { id: "event-type", label: "Event type", description: "What happened?", icon: Tag },
  { id: "event-date", label: "Date", description: "When did it happen?", icon: CalendarDays },
  { id: "event-place", label: "Place", description: "Where did it happen?", icon: MapPin },
  { id: "event-details", label: "Details", description: "Additional details about this event.", icon: AlignLeft },
  { id: "event-linked", label: "Linked records", description: "Individuals or families.", icon: Link2 },
  { id: "event-notes", label: "Notes", description: "Research notes for this event.", icon: FileText },
  { id: "event-media", label: "Media", description: "Photos and documents.", icon: Image },
  {
    id: "event-open-questions",
    label: "Open questions",
    description: "Research and verification",
    icon: CircleHelp,
  },
  {
    id: "event-advanced",
    label: "Advanced details",
    description: "GEDCOM and technical fields.",
    icon: Lock,
  },
] as const;
