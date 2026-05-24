import { prisma } from "../database/prisma.ts";
import { logLink, logUnlink, newBatchId, setBatchSummary, type ChangeCtx } from "./changelog.ts";
import { syncSuggestionStatus } from "./place-resolution-sync.ts";

// ── Create ────────────────────────────────────────────────────────────────────

export type CreatePlaceLinkArgs = {
  fileUuid: string;
  userId: string;
  gedcomPlaceId: string;
  resolvedPlaceId: string;
  matchMethod: string;
  confidence?: number;
  notes?: string | null;
};

export async function createPlaceLink(args: CreatePlaceLinkArgs) {
  const { fileUuid, userId, gedcomPlaceId, resolvedPlaceId, matchMethod, confidence, notes } = args;

  const [gedcomPlace, resolvedPlace] = await Promise.all([
    prisma.gedcomPlace.findFirst({ where: { id: gedcomPlaceId, fileUuid }, select: { id: true, original: true } }),
    prisma.resolvedPlace.findFirst({ where: { id: resolvedPlaceId, fileUuid }, select: { id: true, displayName: true } }),
  ]);
  if (!gedcomPlace) throw Object.assign(new Error("GedcomPlace not found"), { status: 404 });
  if (!resolvedPlace) throw Object.assign(new Error("ResolvedPlace not found"), { status: 404 });

  const existing = await prisma.resolvedPlaceLink.findUnique({ where: { gedcomPlaceId } });
  if (existing) throw Object.assign(new Error("GedcomPlace is already linked to a ResolvedPlace"), { status: 409 });

  const batchId = newBatchId();
  const link = await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId, batchId };
    const created = await tx.resolvedPlaceLink.create({
      data: {
        gedcomPlaceId,
        resolvedPlaceId,
        matchMethod,
        confidence: confidence ?? 100,
        notes: notes ?? null,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });
    await logLink(ctx, "resolved_place_link", created.id, null, created as Record<string, unknown>);
    await setBatchSummary(ctx, `Link "${gedcomPlace.original}" → "${resolvedPlace.displayName}"`);
    return created;
  });

  await syncSuggestionStatus(gedcomPlaceId);
  return link;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePlaceLink(linkId: string, fileUuid: string, userId: string) {
  const link = await prisma.resolvedPlaceLink.findUnique({
    where: { id: linkId },
    include: { gedcomPlace: { select: { id: true, fileUuid: true, original: true } } },
  });
  if (!link) throw Object.assign(new Error("Link not found"), { status: 404 });
  if (link.gedcomPlace.fileUuid !== fileUuid) throw Object.assign(new Error("Link not found"), { status: 404 });

  const { gedcomPlaceId } = link;
  const batchId = newBatchId();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gedcomPlace: _gp, ...linkRow } = link;

  await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId, batchId };
    await tx.resolvedPlaceLink.delete({ where: { id: linkId } });
    await logUnlink(ctx, "resolved_place_link", linkId, null, linkRow as Record<string, unknown>);
    await setBatchSummary(ctx, `Unlink "${link.gedcomPlace.original}"`);
  });

  await syncSuggestionStatus(gedcomPlaceId);
}

// ── Batch move ────────────────────────────────────────────────────────────────

export type BatchMovePlaceLinksArgs = {
  fileUuid: string;
  userId: string;
  linkIds: string[];
  targetResolvedPlaceId: string;
};

export async function batchMovePlaceLinks(args: BatchMovePlaceLinksArgs) {
  const { fileUuid, userId, linkIds, targetResolvedPlaceId } = args;

  const links = await prisma.resolvedPlaceLink.findMany({
    where: { id: { in: linkIds } },
    include: { gedcomPlace: { select: { id: true, fileUuid: true } } },
  });
  if (links.length !== linkIds.length) throw Object.assign(new Error("One or more links not found"), { status: 404 });
  if (links.some((l) => l.gedcomPlace.fileUuid !== fileUuid)) {
    throw Object.assign(new Error("One or more links belong to a different file"), { status: 403 });
  }

  const target = await prisma.resolvedPlace.findFirst({
    where: { id: targetResolvedPlaceId, fileUuid },
    select: { id: true, displayName: true },
  });
  if (!target) throw Object.assign(new Error("Target ResolvedPlace not found"), { status: 404 });

  if (links.some((l) => l.resolvedPlaceId === targetResolvedPlaceId)) {
    throw Object.assign(
      new Error("One or more links are already assigned to the target place"),
      { status: 409 },
    );
  }

  const gedcomPlaceIds = links.map((l) => l.gedcomPlace.id);
  const batchId = newBatchId();

  await prisma.$transaction(async (tx) => {
    const ctx: ChangeCtx = { tx, fileUuid, userId, batchId };

    // Log old links as unlinked, then delete them
    for (const link of links) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { gedcomPlace: _gp, ...linkRow } = link;
      await logUnlink(ctx, "resolved_place_link", link.id, null, linkRow as Record<string, unknown>);
    }
    await tx.resolvedPlaceLink.deleteMany({ where: { id: { in: linkIds } } });

    // Create new links and log them
    for (const gedcomPlaceId of gedcomPlaceIds) {
      const created = await tx.resolvedPlaceLink.create({
        data: {
          gedcomPlaceId,
          resolvedPlaceId: targetResolvedPlaceId,
          matchMethod: "manual",
          confidence: 100,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });
      await logLink(ctx, "resolved_place_link", created.id, null, created as Record<string, unknown>);
    }

    await setBatchSummary(ctx, `Move ${linkIds.length} link${linkIds.length === 1 ? "" : "s"} → "${target.displayName}"`);
  });

  for (const gedcomPlaceId of gedcomPlaceIds) {
    await syncSuggestionStatus(gedcomPlaceId);
  }

  return { moved: gedcomPlaceIds.length };
}
