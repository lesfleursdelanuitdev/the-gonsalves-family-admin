import type { NextRequest } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import {
  effectiveResolution,
  type ImportMergePlan,
  type ImportResolution,
} from "@/lib/admin/gedcom-import-merge-plan";
import { applyGedcomImport, type ApplyGedcomImportResult } from "@/lib/admin/gedcom-import-apply";
import { requireAuth } from "@/lib/infra/auth";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const runtime = "nodejs";
export const maxDuration = 300;

export type GedcomApplyStreamEvent =
  | { type: "start"; total: number }
  | { type: "progress"; processed: number; total: number; created: number; merged: number; skipped: number; label: string }
  | { type: "done"; stats: ApplyGedcomImportResult }
  | { type: "error"; message: string; candidateId?: string };

function sseChunk(event: GedcomApplyStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function asResolutions(v: unknown): Record<string, ImportResolution> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, ImportResolution> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (
      val === "merge_into_existing" ||
      val === "create_new" ||
      val === "skip" ||
      val === "review_later" ||
      val === "mark_not_match"
    ) {
      out[k] = val;
    }
  }
  return out;
}

/** GET /api/admin/imports/gedcom/[id]/apply-stream — SSE apply with per-candidate progress */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const row = await prisma.pendingGedcomImport.findFirst({ where: { id, fileUuid } });
  if (!row) return new Response(JSON.stringify({ error: "Import not found" }), { status: 404 });
  if (row.status === "discarded") return new Response(JSON.stringify({ error: "Import was discarded" }), { status: 409 });
  if (row.status === "applied") return new Response(JSON.stringify({ error: "Already applied" }), { status: 409 });

  const plan = row.importMergePlanJson as unknown as ImportMergePlan | null;
  if (!plan?.candidates?.length) {
    return new Response(JSON.stringify({ error: "Run compare first (no import merge plan)" }), { status: 400 });
  }

  const rawJson = (row.resolutionsJson ?? {}) as Record<string, unknown>;
  const defaults = plan.defaultResolutions ?? {};
  const overrides = asResolutions(rawJson);
  const alternativeOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawJson)) {
    if (k.startsWith("__alt__") && typeof v === "string") {
      alternativeOverrides[k.slice(7)] = v;
    }
  }

  for (const c of plan.candidates) {
    const r = effectiveResolution(c.candidateId, defaults, overrides);
    if (r === "review_later") {
      return new Response(
        JSON.stringify({
          error: `All rows must be resolved before apply. Candidate "${c.importedDisplay}" is still "review_later".`,
          candidateId: c.candidateId,
        }),
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

  const emit = (event: GedcomApplyStreamEvent) => {
    ref.ctrl?.enqueue(encoder.encode(sseChunk(event)));
  };

  void (async () => {
    emit({ type: "start", total: plan.candidates.length });

    let applyStats: ApplyGedcomImportResult;
    try {
      applyStats = await applyGedcomImport(
        fileUuid,
        user.id,
        plan,
        overrides,
        row.canonicalSnapshotJson,
        Object.keys(alternativeOverrides).length > 0 ? alternativeOverrides : undefined,
        (progress) => {
          emit({
            type: "progress",
            processed: progress.processed,
            total: progress.total,
            created: progress.created,
            merged: progress.merged,
            skipped: progress.skipped,
            label: progress.label,
          });
        },
      );
    } catch (err) {
      emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      ref.ctrl?.close();
      return;
    }

    const auditPayload: Prisma.InputJsonValue = {
      at: new Date().toISOString(),
      filename: row.filename,
      appliedByUserId: user.id,
      resolutions: { ...defaults, ...overrides } as Record<string, string>,
      stats: applyStats,
    };
    const prevSnap = row.canonicalSnapshotJson && typeof row.canonicalSnapshotJson === "object"
      ? (row.canonicalSnapshotJson as Record<string, unknown>)
      : {};
    await prisma.pendingGedcomImport.update({
      where: { id: row.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        appliedByUserId: user.id,
        resolutionsJson: { ...defaults, ...overrides } as Prisma.InputJsonValue,
        canonicalSnapshotJson: { ...prevSnap, applyAudit: auditPayload } as Prisma.InputJsonValue,
      },
    });

    emit({ type: "done", stats: applyStats });
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
