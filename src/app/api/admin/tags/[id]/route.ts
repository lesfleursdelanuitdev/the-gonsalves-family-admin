import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

/**
 * Delete a tag. `TaggedItem` and `GedcomMediaAppTag` rows cascade from the schema.
 * - Non-global tags: only the owning user may delete.
 * - Global tags: only a site owner may delete.
 */
export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;

  const tag = await prisma.tag.findFirst({
    where: { id },
    select: { id: true, userId: true, isGlobal: true, name: true },
  });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const isOwnUserTag = !tag.isGlobal && tag.userId === user.id;
  const isGlobalDeletableByOwner = tag.isGlobal && user.isWebsiteOwner;

  if (!isOwnUserTag && !isGlobalDeletableByOwner) {
    return NextResponse.json(
      {
        error: tag.isGlobal
          ? "Only a site owner can delete global tags."
          : "You can only delete tags you own.",
      },
      { status: 403 },
    );
  }

  await prisma.tag.delete({ where: { id: tag.id } });
  return NextResponse.json({ success: true });
});
