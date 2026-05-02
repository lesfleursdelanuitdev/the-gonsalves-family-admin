import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { ADMIN_EVENT_DETAIL_INCLUDE } from "@/app/api/admin/events/event-admin-detail-include";

export const PUT = withAdminAuth(async (req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as { mediaId?: unknown };
  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const [entity, media] = await Promise.all([
    prisma.gedcomEvent.findFirst({ where: { id, fileUuid }, select: { id: true } }),
    prisma.gedcomMedia.findFirst({ where: { id: mediaId, fileUuid }, select: { id: true } }),
  ]);
  if (!entity) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media not found in this tree" }, { status: 404 });
  }

  await prisma.gedcomEventProfileMedia.upsert({
    where: { eventId: id },
    create: { eventId: id, mediaId, fileUuid },
    update: { mediaId, fileUuid },
  });

  const event = await prisma.gedcomEvent.findFirst({
    where: { id, fileUuid },
    include: ADMIN_EVENT_DETAIL_INCLUDE,
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const entity = await prisma.gedcomEvent.findFirst({ where: { id, fileUuid }, select: { id: true } });
  if (!entity) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.gedcomEventProfileMedia.deleteMany({ where: { eventId: id } });

  const event = await prisma.gedcomEvent.findFirst({
    where: { id, fileUuid },
    include: ADMIN_EVENT_DETAIL_INCLUDE,
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
});
