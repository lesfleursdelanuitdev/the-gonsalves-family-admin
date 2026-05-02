/** Shared Prisma include for admin event GET / PATCH / profile-media responses. */
import type { Prisma } from "@ligneous/prisma";
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";

const primaryNameFormSelect = {
  where: { isPrimary: true },
  take: 1,
  select: {
    givenNames: {
      orderBy: { position: "asc" as const },
      select: { givenName: { select: { givenName: true } } },
    },
    surnames: {
      orderBy: { position: "asc" as const },
      select: { surname: { select: { surname: true } } },
    },
  },
} as const;

const individualForEventLink = {
  select: {
    id: true,
    fullName: true,
    xref: true,
    sex: true,
    individualNameForms: primaryNameFormSelect,
  },
} as const;

export const ADMIN_EVENT_DETAIL_INCLUDE = {
  date: true,
  place: true,
  eventNotes: { include: { note: true } },
  eventSources: { include: { source: true } },
  eventMedia: { include: { media: gedcomMediaWithAppTagsInclude } },
  profileMediaSelection: {
    include: { media: gedcomMediaWithAppTagsInclude },
  },
  individualEvents: {
    include: {
      individual: individualForEventLink,
    },
  },
  familyEvents: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: individualForEventLink,
          wife: individualForEventLink,
        },
      },
    },
  },
} satisfies Prisma.GedcomEventInclude;
