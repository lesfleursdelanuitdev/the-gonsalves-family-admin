import type { NextRequest } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/infra/auth";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { mergeTwoIndividuals } from "@/lib/admin/gedcom-merge-individuals";
import type { InternalDuplicatePair, InternalDuplicateResolution } from "@/lib/admin/gedcom-internal-scan";

export const runtime = "nodejs";
export const maxDuration = 300;

export type ScanApplyStreamEvent =
  | { type: "start"; total: number }
  | { type: "progress"; processed: number; total: number; merged: number; skipped: number; errorCount: number; label: string }
  | { type: "done"; merged: number; skipped: number; errors: { pairId: string; error: string }[] }
  | { type: "error"; message: string };

function sseChunk(event: ScanApplyStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** GET /api/admin/merge-records/scans/[id]/apply-stream — SSE apply with per-pair progress */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Auth before starting the stream
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth();
    await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  } catch (e) {
    const status = e instanceof Error && e.message === "Unauthorized" ? 401 : 403;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Forbidden" }), { status });
  }

  const { id } = await ctx.params;

  let fileUuid: string;
  try {
    fileUuid = await getAdminFileUuid();
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "No admin tree" }), { status: 503 });
  }

  const scan = await prisma.internalDuplicateScan.findFirst({ where: { id, fileUuid } });
  if (!scan) return new Response(JSON.stringify({ error: "Scan not found" }), { status: 404 });
  if (scan.status === "applied") return new Response(JSON.stringify({ error: "Already applied" }), { status: 409 });
  if (scan.status === "discarded") return new Response(JSON.stringify({ error: "Scan was discarded" }), { status: 409 });

  const pairs = (scan.pairsJson ?? []) as InternalDuplicatePair[];
  const resolutions = (scan.resolutionsJson ?? {}) as Record<string, InternalDuplicateResolution>;

  for (const pair of pairs) {
    const res = resolutions[pair.pairId] ?? "review_later";
    if (res === "review_later") {
      return new Response(
        JSON.stringify({ error: `Pair "${pair.aDisplay}" / "${pair.bDisplay}" is still "review_later".`, pairId: pair.pairId }),
        { status: 400 },
      );
    }
  }

  const encoder = new TextEncoder();
  const ref = { ctrl: null as ReadableStreamDefaultController<Uint8Array> | null };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ref.ctrl = controller;
    },
    cancel() {
      ref.ctrl = null;
    },
  });

  const emit = (event: ScanApplyStreamEvent) => {
    ref.ctrl?.enqueue(encoder.encode(sseChunk(event)));
  };

  void (async () => {
    let merged = 0;
    let skipped = 0;
    const errors: { pairId: string; error: string }[] = [];

    emit({ type: "start", total: pairs.length });

    let processed = 0;
    for (const pair of pairs) {
      if (!ref.ctrl) break; // client disconnected

      const res = resolutions[pair.pairId] ?? "not_duplicate";
      processed++;

      if (res === "not_duplicate") {
        skipped++;
        emit({ type: "progress", processed, total: pairs.length, merged, skipped, errorCount: errors.length, label: `Skipped — not a duplicate` });
        continue;
      }

      const primaryId = res === "merge_a_into_b" ? pair.individualBId : pair.individualAId;
      const secondaryId = res === "merge_a_into_b" ? pair.individualAId : pair.individualBId;
      const keepDisplay = res === "merge_a_into_b" ? pair.bDisplay : pair.aDisplay;

      try {
        await mergeTwoIndividuals(fileUuid, user.id, primaryId, secondaryId);
        merged++;
        emit({ type: "progress", processed, total: pairs.length, merged, skipped, errorCount: errors.length, label: `Merged → ${keepDisplay}` });
      } catch (err) {
        errors.push({ pairId: pair.pairId, error: err instanceof Error ? err.message : String(err) });
        emit({ type: "progress", processed, total: pairs.length, merged, skipped, errorCount: errors.length, label: `Error — ${keepDisplay}` });
      }
    }

    try {
      await prisma.internalDuplicateScan.update({
        where: { id },
        data: {
          status: "applied",
          appliedAt: new Date(),
          appliedByUserId: user.id,
          resolutionsJson: resolutions as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      emit({ type: "error", message: `Failed to mark scan as applied: ${err instanceof Error ? err.message : String(err)}` });
      ref.ctrl?.close();
      return;
    }

    emit({ type: "done", merged, skipped, errors });
    ref.ctrl?.close();
  })().catch((err) => {
    emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
    ref.ctrl?.close();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
