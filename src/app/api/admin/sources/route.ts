import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  allocateNewSourceXref,
  registerXrefInFileObjects,
} from "@/lib/admin/admin-individual-editor-apply";
import {
  logCreate,
  newBatchId,
  setBatchSummary,
  type ChangeCtx,
} from "@/lib/admin/changelog";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const where: {
    fileUuid: string;
    OR?: Array<{
      title?: { contains: string; mode: "insensitive" };
      author?: { contains: string; mode: "insensitive" };
      xref?: { contains: string; mode: "insensitive" };
    }>;
  } = { fileUuid };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
      { xref: { contains: q, mode: "insensitive" } },
    ];
  }

  const [sources, total] = await Promise.all([
    prisma.gedcomSource.findMany({
      where,
      include: {
        individualSources: {
          include: {
            individual: { select: { id: true, fullName: true, xref: true } },
          },
        },
        familySources: {
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
        },
        eventSources: {
          include: {
            event: { select: { id: true, eventType: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gedcomSource.count({ where }),
  ]);

  return NextResponse.json({
    sources,
    total,
    hasMore: offset + sources.length < total,
  });
});

function optBodyString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export const POST = withAdminAuth(async (req, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = await req.json();
  const { title, author, abbreviation, publication, text, repositoryXref, callNumber } = body as Record<string, unknown>;

  const titleStr = typeof title === "string" ? title.trim() : "";
  if (!titleStr) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const batchId = newBatchId();
  const source = await prisma.$transaction(async (tx) => {
    const xref = await allocateNewSourceXref(tx, fileUuid);
    const s = await tx.gedcomSource.create({
      data: {
        fileUuid,
        xref,
        title: titleStr,
        author: optBodyString(author),
        abbreviation: optBodyString(abbreviation),
        publication: optBodyString(publication),
        text: optBodyString(text),
        repositoryXref: optBodyString(repositoryXref),
        callNumber: optBodyString(callNumber),
      },
    });
    await registerXrefInFileObjects(tx, fileUuid, xref, "SOUR", s.id);
    const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await logCreate(ctx, "source", s.id, s.xref, { ...s });
    await setBatchSummary(ctx, `Created source ${s.xref}`);
    return s;
  });

  return NextResponse.json({ source }, { status: 201 });
});
