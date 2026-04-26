import { logLink, logUnlink, setBatchSummary, type ChangeCtx } from "@/lib/admin/changelog";

/** Serialize a Prisma row (Dates → ISO strings) for `logLink` / `logUnlink` changesets. */
export function serializeJunctionForChangelog(row: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

/**
 * After creating a junction row, append changelog rows for the same batch.
 * Must run inside the caller's `$transaction` before it commits.
 */
export async function commitMediaJunctionLink(
  ctx: ChangeCtx,
  junctionEntityType: string,
  row: { id: string },
  summary: string,
): Promise<void> {
  await logLink(ctx, junctionEntityType, row.id, null, serializeJunctionForChangelog(row));
  await setBatchSummary(ctx, summary);
}

/**
 * Before deleting a junction row, record an `unlink` entry (snapshot = full row).
 * Caller should delete the row immediately after, still inside the same transaction.
 */
export async function commitMediaJunctionUnlink(
  ctx: ChangeCtx,
  junctionEntityType: string,
  row: { id: string },
  summary: string,
): Promise<void> {
  await logUnlink(ctx, junctionEntityType, row.id, null, serializeJunctionForChangelog(row));
  await setBatchSummary(ctx, summary);
}
