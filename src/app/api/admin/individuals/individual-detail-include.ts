/** Shared Prisma include for admin individual GET + PATCH response. */
import type { Prisma } from "@ligneous/prisma";
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";

export const ADMIN_INDIVIDUAL_CHILD_SELECT = {
  id: true,
  xref: true,
  fullName: true,
  sex: true,
  gender: true,
  birthDateDisplay: true,
  birthPlaceDisplay: true,
  birthYear: true,
  deathDateDisplay: true,
  deathPlaceDisplay: true,
  deathYear: true,
  individualNameForms: {
    where: { isPrimary: true },
    take: 1,
    select: {
      isPrimary: true,
      sortOrder: true,
      givenNames: {
        orderBy: { position: "asc" as const },
        select: { givenName: { select: { givenName: true } } },
      },
      surnames: {
        orderBy: { position: "asc" as const },
        select: { surname: { select: { surname: true } } },
      },
    },
  },
};

export const ADMIN_INDIVIDUAL_DETAIL_INCLUDE = {
  birthDate: true,
  deathDate: true,
  birthPlace: true,
  deathPlace: true,
  individualNameForms: {
    include: {
      givenNames: { include: { givenName: true }, orderBy: { position: "asc" as const } },
      surnames: { include: { surname: true }, orderBy: { position: "asc" as const } },
    },
    orderBy: [{ sortOrder: "asc" as const }, { nameType: "asc" as const }],
  },
  individualNotes: {
    include: { note: true },
  },
  individualMedia: {
    include: { media: gedcomMediaWithAppTagsInclude },
  },
  individualSources: {
    include: { source: true },
  },
  parentAsChild: {
    select: {
      familyId: true,
      relationshipType: true,
      pedigree: true,
    },
  },
  familyChildAsChild: {
    include: {
      // Explicit `select` on `family` so husband/wife always use ADMIN_INDIVIDUAL_CHILD_SELECT (incl. `sex`).
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
          wife: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
          familyChildren: {
            orderBy: { birthOrder: "asc" as const },
            select: {
              birthOrder: true,
              child: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
            },
          },
        },
      },
    },
  },
  husbandInFamilies: {
    include: {
      husband: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
      wife: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
      familyChildren: {
        include: { child: { select: ADMIN_INDIVIDUAL_CHILD_SELECT } },
        orderBy: { birthOrder: "asc" as const },
      },
    },
  },
  wifeInFamilies: {
    include: {
      husband: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
      wife: { select: ADMIN_INDIVIDUAL_CHILD_SELECT },
      familyChildren: {
        include: { child: { select: ADMIN_INDIVIDUAL_CHILD_SELECT } },
        orderBy: { birthOrder: "asc" as const },
      },
    },
  },
} satisfies Prisma.GedcomIndividualInclude;
