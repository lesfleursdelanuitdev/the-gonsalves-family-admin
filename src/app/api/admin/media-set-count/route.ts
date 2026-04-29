import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseGeneratedMediaSource } from "@/lib/album/parse-generated-media-source";
import { countGeneratedMediaForSource } from "@ligneous/album-generated-queries";

/** Lightweight count for generated media-set views (no full model payload). */
export const GET = withAdminAuth(async (request) => {
  const sp = request.nextUrl.searchParams;
  let fileUuid: string;
  try {
    fileUuid = await getAdminFileUuid();
  } catch {
    return NextResponse.json({ error: "Tree not configured" }, { status: 503 });
  }

  const source = parseGeneratedMediaSource(sp.get("type"), sp.get("id"));
  if (!source) {
    return NextResponse.json({ error: "Invalid or missing type / id" }, { status: 400 });
  }

  const count = await countGeneratedMediaForSource(prisma, fileUuid, source);
  return NextResponse.json({ count });
});
