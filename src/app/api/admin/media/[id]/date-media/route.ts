import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  findOrCreateGedcomDate,
  parseDateInput,
} from "@/lib/admin/admin-event-create";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const dateSelect = {
  id: true,
  original: true,
  dateType: true,
  year: true,
  month: true,
  day: true,
  endYear: true,
  endMonth: true,
  endDay: true,
} as const;

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const dateIdDirect = typeof body.dateId === "string" ? body.dateId.trim() : "";
  const dateRaw = body.date;

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.gedcomMedia.findFirst({
        where: { id: mediaId, fileUuid },
        select: { id: true },
      });
      if (!media) {
        throw new Error("MEDIA_NOT_FOUND");
      }

      let dateId = dateIdDirect;
      if (!dateId) {
        if (!dateRaw || typeof dateRaw !== "object") {
          throw new Error("DATE_PAYLOAD_REQUIRED");
        }
        const parsed = parseDateInput(dateRaw);
        if (!parsed) {
          throw new Error("DATE_PAYLOAD_EMPTY");
        }
        dateId = await findOrCreateGedcomDate(tx, fileUuid, parsed);
      }

      const date = await tx.gedcomDate.findFirst({
        where: { id: dateId, fileUuid },
        select: { id: true },
      });
      if (!date) {
        throw new Error("DATE_NOT_FOUND");
      }

      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      const created = await tx.gedcomMediaDate.create({
        data: { fileUuid, dateId, mediaId },
        include: { date: { select: dateSelect } },
      });
      await commitMediaJunctionLink(
        changeCtx,
        "media_date",
        created,
        `Linked media to date ${created.date.original || dateId}`,
      );
      return created;
    });
    return NextResponse.json({ dateMedia: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MEDIA_NOT_FOUND") {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (msg === "DATE_PAYLOAD_REQUIRED") {
      return NextResponse.json({ error: "dateId or date payload is required" }, { status: 400 });
    }
    if (msg === "DATE_PAYLOAD_EMPTY") {
      return NextResponse.json({ error: "date payload is empty" }, { status: 400 });
    }
    if (msg === "DATE_NOT_FOUND") {
      return NextResponse.json({ error: "Date not found in this tree" }, { status: 404 });
    }
    return NextResponse.json({ error: "This media is already linked to that date" }, { status: 409 });
  }
});
