import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Briefcase,
  CalendarDays,
  Church,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Skull,
  Sparkles,
} from "lucide-react";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

/** Type label shown in the card header (e.g. "BIRTH", "POLITICAL UNREST"). */
export function typeLabel(e: IndividualDetailEvent): string {
  if ((e.eventType === "CUST" || e.eventType === "EVEN") && e.customType?.trim()) {
    return e.customType.trim().replace(/_/g, " ");
  }
  return labelGedcomEventType(e.eventType);
}

/** "place · original" subtitle line under the header. */
export function placeLine(e: IndividualDetailEvent): string | null {
  const a = (e.placeName ?? "").trim();
  const b = (e.placeOriginal ?? "").trim();
  const line = [a, b].filter(Boolean).join(" · ");
  return line || null;
}

/** Glyph icon shown in the card header. */
export function timelineGlyphForEvent(e: IndividualDetailEvent): LucideIcon {
  const et = (e.eventType ?? "").toUpperCase();
  if (et === "CUST" || et === "EVEN") return Sparkles;
  switch (et) {
    case "BIRT":
    case "CHR":
    case "CHRA":
    case "BAPM":
      return Baby;
    case "DEAT":
      return Skull;
    case "BURI":
    case "CREM":
      return Church;
    case "MARR":
    case "ENGA":
    case "DIV":
    case "ANUL":
      return Heart;
    case "RESI":
    case "PROP":
      return Home;
    case "OCCU":
      return Briefcase;
    case "EDUC":
    case "GRAD":
      return GraduationCap;
    case "IMMI":
    case "EMIG":
      return Plane;
    default:
      return CalendarDays;
  }
}

/**
 * Strip the safe HTML produced by `timelineBodyToSafeHtml` to plain text + newlines for SVG rendering.
 * Keeps `[label](url)` markdown that happens to remain unconverted, just as text.
 */
export function stripHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
