import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { normalizeStorySlugInput } from "@/lib/admin/story-creator/story-slug";

export const GET = withAdminAuth(async (req: NextRequest, _user, _ctx) => {
  void _user;
  void _ctx;
  const treeId = await getAdminTreeId();
  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug") ?? "";
  const excludeId = url.searchParams.get("excludeId")?.trim() || undefined;

  const slug = normalizeStorySlugInput(slugRaw);
  if (!slug) {
    return NextResponse.json({ available: false });
  }

  const taken = await prisma.story.findFirst({
    where: {
      treeId,
      deletedAt: null,
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({ available: !taken });
});
