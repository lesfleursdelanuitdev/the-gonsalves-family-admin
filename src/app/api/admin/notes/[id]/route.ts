import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import {
  parseNoteLinksFromBody,
  replaceNoteLinksInTx,
  validateNoteLinksForFile,
} from "@/lib/admin/admin-note-links";
import { newBatchId, logUpdate, logDelete, setBatchSummary, type ChangeCtx } from "@/lib/admin/changelog";

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

const individualForNoteLink = {
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

  const note = await prisma.gedcomNote.findFirst({
    where: { id, fileUuid },
    include: {
      individualNotes: {
        include: {
          individual: individualForNoteLink,
        },
      },
      familyNotes: {
        include: {
          family: {
            select: {
              id: true,
              xref: true,
              husband: individualForNoteLink,
              wife: individualForNoteLink,
            },
          },
        },
      },
      eventNotes: {
        include: {
          event: { select: { id: true, eventType: true, customType: true } },
        },
      },
      sourceNotes: { include: { source: { select: { id: true, title: true, xref: true } } } },
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ note });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.gedcomNote.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if ("content" in body) {
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    data.content = body.content;
  }
  if ("isTopLevel" in body) {
    data.isTopLevel = body.isTopLevel === true;
  }

  let linksPayload: ReturnType<typeof parseNoteLinksFromBody> | undefined;
  if ("links" in body) {
    try {
      linksPayload = parseNoteLinksFromBody(body.links);
    } catch {
      return NextResponse.json({ error: "Invalid links payload" }, { status: 400 });
    }
    const validation = await validateNoteLinksForFile(fileUuid, linksPayload);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0 && !linksPayload) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const batchId = newBatchId();
  const note = await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    let updated = existing;
    if (Object.keys(data).length > 0) {
      updated = await tx.gedcomNote.update({
        where: { id },
        data,
      });
    }
    if (linksPayload) {
      await replaceNoteLinksInTx(tx, fileUuid, id, linksPayload);
    }
    await logUpdate(
      changeCtx,
      "note",
      id,
      existing.xref,
      { content: existing.content, isTopLevel: existing.isTopLevel },
      { content: updated.content, isTopLevel: updated.isTopLevel },
    );
    await setBatchSummary(changeCtx, `Updated note ${updated.xref ?? id}`);
    return updated;
  });

  return NextResponse.json({ note });
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomNote.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const batchId = newBatchId();
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await logDelete(changeCtx, "note", id, existing.xref, { ...existing });
    await setBatchSummary(changeCtx, `Deleted note ${existing.xref ?? id}`);
    await tx.gedcomIndividualNote.deleteMany({ where: { noteId: id } });
    await tx.gedcomFamilyNote.deleteMany({ where: { noteId: id } });
    await tx.gedcomEventNote.deleteMany({ where: { noteId: id } });
    await tx.gedcomSourceNote.deleteMany({ where: { noteId: id } });
    await tx.gedcomFileObject.deleteMany({ where: { fileUuid, objectUuid: id } });
    await tx.gedcomNote.delete({ where: { id } });
  });

  return new NextResponse(null, { status: 204 });
});
