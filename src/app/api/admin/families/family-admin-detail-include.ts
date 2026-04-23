/** Shared Prisma include for admin family GET / PATCH / membership response. */
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";

export const ADMIN_FAMILY_DETAIL_INCLUDE = {
  husband: { select: { id: true, xref: true, fullName: true, sex: true } },
  wife: { select: { id: true, xref: true, fullName: true, sex: true } },
  marriageDate: true,
  marriagePlace: true,
  divorceDate: true,
  divorcePlace: true,
  familyChildren: {
    include: {
      child: { select: { id: true, xref: true, fullName: true, sex: true, birthYear: true } },
    },
    orderBy: { birthOrder: "asc" as const },
  },
  familyNotes: {
    include: { note: true },
  },
  familyMedia: {
    include: { media: gedcomMediaWithAppTagsInclude },
  },
  familySources: {
    include: { source: true },
  },
  parentChildRels: {
    select: {
      childId: true,
      relationshipType: true,
      pedigree: true,
    },
  },
} as const;
