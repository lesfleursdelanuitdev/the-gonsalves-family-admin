import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
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

export const POST = withAdminAuth(async (req, user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const body = await req.json();
  const {
    xref,
    title,
    author,
    abbreviation,
    publication,
    text,
    repositoryXref,
    callNumber,
  } = body as Record<string, unknown>;

  if (!xref || typeof xref !== "string") {
    return NextResponse.json({ error: "xref is required" }, { status: 400 });
  }

  const source = await prisma.gedcomSource.create({
    data: {
      fileUuid,
      xref,
      title: title != null ? String(title) : null,
      author: author != null ? String(author) : null,
      abbreviation: abbreviation != null ? String(abbreviation) : null,
      publication: publication != null ? String(publication) : null,
      text: text != null ? String(text) : null,
      repositoryXref: repositoryXref != null ? String(repositoryXref) : null,
      callNumber: callNumber != null ? String(callNumber) : null,
    },
  });

  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await logCreate(ctx, "source", source.id, source.xref, { ...source });
    await setBatchSummary(ctx, `Created source ${source.xref}`);
  });

  return NextResponse.json({ source }, { status: 201 });
});
