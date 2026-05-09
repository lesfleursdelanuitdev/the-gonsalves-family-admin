import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { postLibApiParseValidateEnrich } from "@/lib/admin/lib-api-pipeline";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import type { Prisma } from "@ligneous/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

function countValidationSeverity(errList: unknown): { errors: number; warnings: number; hints: number } {
  let errN = 0;
  let warnN = 0;
  let hintN = 0;
  if (!Array.isArray(errList)) return { errors: errN, warnings: warnN, hints: hintN };
  for (const e of errList) {
    const o = e && typeof e === "object" ? (e as Record<string, unknown>) : null;
    const s = o?.Severity ?? o?.severity;
    const n = typeof s === "number" ? s : Number(s);
    if (n === 2) errN++;
    else if (n === 1) warnN++;
    else hintN++;
  }
  return { errors: errN, warnings: warnN, hints: hintN };
}

export const GET = withAdminAuth(async () => {
  const fileUuid = await getAdminFileUuid();
  const rows = await prisma.pendingGedcomImport.findMany({
    where: { fileUuid },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      appliedAt: true,
      discardedAt: true,
    },
  });
  return NextResponse.json({ imports: rows });
});

export const POST = withAdminAuth(async (req, user) => {
  const fileUuid = await getAdminFileUuid();
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Use multipart/form-data with field file" }, { status: 415 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  let pipeline: Awaited<ReturnType<typeof postLibApiParseValidateEnrich>>;
  try {
    pipeline = await postLibApiParseValidateEnrich(file, file.name || "upload.ged", { generateIds: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }

  const val = pipeline.validation;
  const sev = countValidationSeverity(val?.errors);
  const valid = Boolean(val?.valid);

  const snapshot = JSON.parse(
    JSON.stringify({
      pipeline: "parse-validate-enrich",
      enriched: pipeline.enriched,
      stats: pipeline.stats,
      validation: pipeline.validation,
      warnings: pipeline.warnings,
    }),
  ) as Prisma.InputJsonValue;

  const status = "validated";

  const row = await prisma.pendingGedcomImport.create({
    data: {
      fileUuid,
      filename: file.name || "upload.ged",
      status,
      canonicalSnapshotJson: snapshot,
      uploadedByUserId: user.id,
    },
  });

  return NextResponse.json(
    {
      import: row,
      validation: { ...sev, valid },
    },
    { status: 201 },
  );
});
