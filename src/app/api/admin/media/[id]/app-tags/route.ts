import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

async function assertTagUsableByUser(tagId: string, userId: string) {
  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      OR: [{ isGlobal: true }, { userId }],
    },
    select: { id: true },
  });
  return !!tag;
}

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const tagId = typeof body.tagId === "string" ? body.tagId.trim() : "";
  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const ok = await assertTagUsableByUser(tagId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Tag not found or not allowed" }, { status: 400 });
  }

  try {
    const row = await prisma.gedcomMediaAppTag.create({
      data: {
        tagId,
        gedcomMediaId: mediaId,
        taggedBy: user.id,
      },
      include: { tag: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({ appTag: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Tag already applied for this user" }, { status: 409 });
  }
});
