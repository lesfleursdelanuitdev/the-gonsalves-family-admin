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
  const familyId = typeof body.familyId === "string" ? body.familyId.trim() : "";
  if (!familyId) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const source = await prisma.gedcomSource.findFirst({
    where: { id: sourceId, fileUuid },
    select: { id: true, xref: true, title: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const family = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true },
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found in this tree" }, { status: 404 });
  }

  const dup = await prisma.gedcomFamilySource.findFirst({
    where: { sourceId, familyId },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "This family is already linked to this source" }, { status: 409 });
  }

  const page = optText(body.page);
  const citationText = optText(body.citationText);
  const quality = optQuality(body.quality);

  const batchId = newBatchId();
  const row = await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    const created = await tx.gedcomFamilySource.create({
      data: {
        fileUuid,
        sourceId,
        familyId,
        page,
        citationText,
        quality,
      },
      include: {
        family: {
          select: {
            id: true,
            xref: true,
            husband: { select: { fullName: true } },
            wife: { select: { fullName: true } },
          },
        },
      },
    });
    const label = source.title?.trim() || source.xref?.trim() || sourceId;
    await commitMediaJunctionLink(changeCtx, "family_source", created, `Citation: source ${label} → family`);
    return created;
  });

  return NextResponse.json({ familySource: row }, { status: 201 });
});
