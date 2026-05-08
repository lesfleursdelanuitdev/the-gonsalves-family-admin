/** Shared Prisma include for admin family GET / PATCH / membership response. */
import { gedcomMediaWithAppTagsInclude } from "@/lib/admin/gedcom-media-with-tags-include";
import { gedcomIndividualNlDenormSelect } from "@/lib/gedcom/gedcom-individual-nl-select";

export const ADMIN_FAMILY_DETAIL_INCLUDE = {
  husband: {
    select: { id: true, xref: true, fullName: true, sex: true, ...gedcomIndividualNlDenormSelect },
  },
  wife: {
    select: { id: true, xref: true, fullName: true, sex: true, ...gedcomIndividualNlDenormSelect },
  },
  marriageDate: true,
  marriagePlace: true,
  divorceDate: true,
  divorcePlace: true,
  familyChildren: {
    include: {
      child: {
        select: {
          id: true,
          xref: true,
          fullName: true,
          sex: true,
          birthYear: true,
          ...gedcomIndividualNlDenormSelect,
        },
      },
    },
    orderBy: { birthOrder: "asc" as const },
  },
  familyNotes: {
    include: { note: true },
  },
  familyMedia: {
    include: { media: gedcomMediaWithAppTagsInclude },
  },
  profileMediaSelection: {
    include: { media: gedcomMediaWithAppTagsInclude },
  },
  familySources: {
    include: { source: true },
  },
  parentChildRels: {
    select: {
      childId: true,
      parentId: true,
      familyId: true,
      relationshipType: true,
      pedigree: true,
    },
  },
  familyPartners: { select: { individualId: true } },
} as const;
