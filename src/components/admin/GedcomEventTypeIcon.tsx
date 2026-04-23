"use client";

import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Briefcase,
  CalendarDays,
  Church,
  Cross,
  Droplets,
  FileText,
  Flame,
  Gem,
  GraduationCap,
  Heart,
  HeartCrack,
  Home,
  Landmark,
  Plane,
  ScrollText,
  Table,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** GEDCOM standard + common extensions; unknown types fall back to {@link CalendarDays}. */
const EVENT_TYPE_ICONS: Record<string, LucideIcon> = {
  BIRT: Baby,
  CHR: Droplets,
  CHRA: Droplets,
  BAPM: Droplets,
  CONF: Church,
  DEAT: Cross,
  BURI: Landmark,
  CREM: Flame,
  MARR: Heart,
  ENGA: Gem,
  DIV: HeartCrack,
  ANUL: HeartCrack,
  RESI: Home,
  OCCU: Briefcase,
  EDUC: GraduationCap,
  GRAD: GraduationCap,
  IMMI: Plane,
  EMIG: Plane,
  NATU: ScrollText,
  CENS: Table,
  PROP: Landmark,
  WILL: FileText,
  ADOP: Users,
  EVEN: CalendarDays,
};

export function GedcomEventTypeIcon({
  eventType,
  className,
}: {
  eventType: string;
  className?: string;
}) {
  const key = (eventType ?? "").toUpperCase().trim();
  const Icon = EVENT_TYPE_ICONS[key] ?? CalendarDays;
  return <Icon className={cn("size-4 shrink-0 text-base-content/80", className)} aria-hidden />;
}
