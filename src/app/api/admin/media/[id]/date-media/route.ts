import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  findOrCreateGedcomDate,
  parseDateInput,
} from "@/lib/admin/admin-event-create";
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

export const POST = withAdminAuth(async (request, _user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const dateIdDirect = typeof body.dateId === "string" ? body.dateId.trim() : "";
  const dateRaw = body.date;

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  let dateId = dateIdDirect;
  if (!dateId) {
    if (!dateRaw || typeof dateRaw !== "object") {
      return NextResponse.json({ error: "dateId or date payload is required" }, { status: 400 });
    }
    const parsed = parseDateInput(dateRaw);
    if (!parsed) {
      return NextResponse.json({ error: "date payload is empty" }, { status: 400 });
    }
    dateId = await findOrCreateGedcomDate(prisma, fileUuid, parsed);
  }

  const date = await prisma.gedcomDate.findFirst({
    where: { id: dateId, fileUuid },
    select: { id: true },
  });
  if (!date) {
    return NextResponse.json({ error: "Date not found in this tree" }, { status: 404 });
  }

  try {
    const row = await prisma.gedcomMediaDate.create({
      data: { fileUuid, dateId, mediaId },
      include: { date: { select: dateSelect } },
    });
    return NextResponse.json({ dateMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that date" }, { status: 409 });
  }
});
