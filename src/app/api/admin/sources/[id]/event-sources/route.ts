import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
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
  return Math.round(n);
}

export const POST = withAdminAuth(async (req, user, ctx) => {
  const { id: sourceId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const source = await prisma.gedcomSource.findFirst({
    where: { id: sourceId, fileUuid },
    select: { id: true, xref: true, title: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const event = await prisma.gedcomEvent.findFirst({
    where: { id: eventId, fileUuid },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found in this tree" }, { status: 404 });
  }

  const dup = await prisma.gedcomEventSource.findFirst({
    where: { sourceId, eventId },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "This event is already linked to this source" }, { status: 409 });
  }

  const page = optText(body.page);
  const citationText = optText(body.citationText);
  const quality = optQuality(body.quality);

  const batchId = newBatchId();
  const row = await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    const created = await tx.gedcomEventSource.create({
      data: {
        fileUuid,
        sourceId,
        eventId,
        page,
        citationText,
        quality,
      },
      include: {
        event: { select: { id: true, eventType: true } },
      },
    });
    const label = source.title?.trim() || source.xref?.trim() || sourceId;
    await commitMediaJunctionLink(changeCtx, "event_source", created, `Citation: source ${label} → event`);
    return created;
  });

  return NextResponse.json({ eventSource: row }, { status: 201 });
});
