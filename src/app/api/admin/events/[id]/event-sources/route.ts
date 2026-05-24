import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";

function optText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function optQuality(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 0 || r > 3) return null;
  return r;
}

const SOURCE_SELECT = {
  id: true,
  xref: true,
  title: true,
  author: true,
  abbreviation: true,
  publication: true,
};

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "source", action: "read", scope: "tree" });
  const { id: eventId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const links = await prisma.gedcomEventSource.findMany({
    where: { eventId, fileUuid },
    include: { source: { select: SOURCE_SELECT } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ eventSources: links });
});

export const POST = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "source", action: "update", scope: "tree" });
  const { id: eventId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const [event, source] = await Promise.all([
    prisma.gedcomEvent.findFirst({ where: { id: eventId, fileUuid }, select: { id: true } }),
    prisma.gedcomSource.findFirst({ where: { id: sourceId, fileUuid }, select: { id: true, xref: true, title: true } }),
  ]);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const dup = await prisma.gedcomEventSource.findFirst({ where: { sourceId, eventId }, select: { id: true } });
  if (dup) return NextResponse.json({ error: "This source is already cited on this event" }, { status: 409 });

  const page = optText(body.page);
  const citationText = optText(body.citationText);
  const quality = optQuality(body.quality);

  const batchId = newBatchId();
  const row = await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    const created = await tx.gedcomEventSource.create({
      data: { fileUuid, sourceId, eventId, page, citationText, quality },
      include: { source: { select: SOURCE_SELECT } },
    });
    const label = source.title?.trim() || source.xref?.trim() || sourceId;
    await commitMediaJunctionLink(changeCtx, "event_source", created, `Citation: event → source ${label}`);
    return created;
  });

  return NextResponse.json({ eventSource: row }, { status: 201 });
});
