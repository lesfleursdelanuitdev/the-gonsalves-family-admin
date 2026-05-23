import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { runBackup } from "@/lib/admin/backup-service";

/** Monthly backup can take several minutes for large trees. */
export const maxDuration = 600;

export const GET = async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backup = await prisma.backup.create({
    data: { status: "PENDING", trigger: "SCHEDULED" },
  });

  try {
    await runBackup(backup.id);
    const completed = await prisma.backup.findUnique({ where: { id: backup.id } });
    return NextResponse.json({
      ok: true,
      backupId: backup.id,
      fileSize: completed?.fileSize?.toString() ?? null,
    });
  } catch (err) {
    console.error("Scheduled backup failed:", err);
    return NextResponse.json(
      { error: "Backup failed.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};
