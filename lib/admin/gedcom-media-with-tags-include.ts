/**
 * Prisma fragment: full `gedcom_media_v2` row plus app tags (for admin entity detail nested media lists).
 */
export const gedcomMediaWithAppTagsInclude = {
  include: {
    appTags: {
      include: { tag: { select: { id: true, name: true, color: true } } },
    },
  },
} as const;
