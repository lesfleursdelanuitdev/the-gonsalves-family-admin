import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  logDelete,
  logUpdate,
  newBatchId,
  setBatchSummary,
  type ChangeCtx,
} from "@/lib/admin/changelog";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { normalizeStoredMediaFileRef } from "@/lib/admin/media-upload-storage";

const primaryNameFormSelect = {
  where: { isPrimary: true },
  take: 1,
  select: {
    givenNames: {
      orderBy: { position: "asc" as const },
      select: { givenName: { select: { givenName: true } } },
    },
    surnames: {
      orderBy: { position: "asc" as const },
      select: { surname: { select: { surname: true } } },
    },
  },
} as const;

const individualForMediaLink = {
  select: {
    id: true,
    fullName: true,
    xref: true,
    sex: true,
    individualNameForms: primaryNameFormSelect,
  },
} as const;

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const media = await prisma.gedcomMedia.findFirst({
    where: { id, fileUuid },
    include: {
      individualMedia: {
        include: {
          individual: individualForMediaLink,
        },
      },
      familyMedia: {
        include: {
          family: {
            select: {
              id: true,
              xref: true,
              husband: individualForMediaLink,
              wife: individualForMediaLink,
            },
          },
        },
      },
      sourceMedia: {
        include: {
          source: { select: { id: true, title: true, xref: true } },
        },
      },
      eventMedia: {
        include: {
          event: { select: { id: true, eventType: true, customType: true } },
        },
      },
      appTags: {
        include: { tag: { select: { id: true, name: true, color: true } } },
      },
      albumLinks: {
        include: { album: { select: { id: true, name: true } } },
      },
    },
  });

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  return NextResponse.json({ media });
});

export const PATCH = withAdminAuth(async (request, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = await request.json();

  const existing = await prisma.gedcomMedia.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const { title, fileRef, form, description } = body;
  const batchId = newBatchId();
  const media = await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    const updated = await tx.gedcomMedia.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(fileRef !== undefined && { fileRef: normalizeStoredMediaFileRef(fileRef) }),
        ...(form !== undefined && { form }),
        ...(description !== undefined && { description }),
      },
    });
    await logUpdate(
      changeCtx,
      "media",
      id,
      existing.xref,
      {
        title: existing.title,
        fileRef: existing.fileRef,
        form: existing.form,
        description: existing.description,
      },
      {
        title: updated.title,
        fileRef: updated.fileRef,
        form: updated.form,
        description: updated.description,
      },
    );
    await setBatchSummary(changeCtx, `Updated media ${existing.xref ?? id}`);
    return updated;
  });

  return NextResponse.json({ media });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomMedia.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await tx.gedcomIndividualMedia.deleteMany({ where: { mediaId: id } });
    await tx.gedcomFamilyMedia.deleteMany({ where: { mediaId: id } });
    await tx.gedcomSourceMedia.deleteMany({ where: { mediaId: id } });
    await tx.gedcomEventMedia.deleteMany({ where: { mediaId: id } });
    await tx.gedcomMedia.delete({ where: { id } });
    await logDelete(changeCtx, "media", id, existing.xref, { ...existing });
    await setBatchSummary(changeCtx, `Deleted media ${existing.xref ?? id}`);
  });

  return NextResponse.json({ success: true });
});
