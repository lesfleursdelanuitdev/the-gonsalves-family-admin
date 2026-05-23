import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { runBackup } from "@/lib/admin/backup-service";

/** Backup runs can take several minutes for large trees with many media files. */
export const maxDuration = 600;

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });

  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    backups: backups.map((b) => ({
      ...b,
      fileSize: b.fileSize?.toString() ?? null,
    })),
  });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const trigger = body.trigger === "SCHEDULED" ? "SCHEDULED" : "MANUAL";

  const backup = await prisma.backup.create({
    data: { status: "PENDING", trigger },
  });

  try {
    await runBackup(backup.id);
  } catch (err) {
    const failed = await prisma.backup.findUnique({ where: { id: backup.id } });
    return NextResponse.json(
      {
        backup: { ...failed, fileSize: null },
        error: err instanceof Error ? err.message : "Backup failed.",
      },
      { status: 500 },
    );
  }

  const completed = await prisma.backup.findUnique({ where: { id: backup.id } });
  return NextResponse.json(
    { backup: { ...completed, fileSize: completed?.fileSize?.toString() ?? null } },
    { status: 201 },
  );
});
