/**
 * Resolve the admin tree's GedcomFile UUID from env config.
 * All admin CRUD endpoints call this to scope queries to the single tree.
 */
import { prisma } from "@/lib/database/prisma";

/** Max records returned by admin list APIs when loading "all" data (single request, no pagination). */
export const ADMIN_LIST_MAX_LIMIT = 10_000;

/** Thrown when env / DB state cannot resolve a GEDCOM file for admin routes. */
export class AdminTreeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminTreeResolutionError";
  }
}

export type AdminGedcomFileResolution =
  | { ok: true; fileUuid: string }
  | { ok: false; reason: string };

/**
 * Resolve which `gedcom_files.id` admin APIs should use, without caching.
 * Use for setup/diagnostics; prefer `getAdminFileUuid()` in route handlers.
 */
export async function resolveAdminGedcomFileUuid(): Promise<AdminGedcomFileResolution> {
  const treeId = process.env.ADMIN_TREE_ID;
  const fileIdEnv = process.env.ADMIN_TREE_FILE_ID;

  if (treeId) {
    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { gedcomFileId: true },
    });
    if (!tree) {
      return {
        ok: false,
        reason: `No tree found for ADMIN_TREE_ID=${treeId}. Check that the UUID is correct.`,
      };
    }
    if (tree.gedcomFileId) {
      return { ok: true, fileUuid: tree.gedcomFileId };
    }
  }

  if (fileIdEnv) {
    const file = await prisma.gedcomFile.findFirst({
      where: { fileId: fileIdEnv },
      select: { id: true },
    });
    if (file) {
      return { ok: true, fileUuid: file.id };
    }
    return {
      ok: false,
      reason:
        "ADMIN_TREE_FILE_ID is set but no row in gedcom_files matches that file_id. Check .env.local against the database.",
    };
  }

  if (treeId) {
    return {
      ok: false,
      reason:
        "ADMIN_TREE_ID points to a tree with no linked GEDCOM file (gedcom_file_id is null). Set ADMIN_TREE_FILE_ID to gedcom_files.file_id, or link the tree to a file, then restart the dev server.",
    };
  }

  return {
    ok: false,
    reason:
      "Admin tree not configured. Set ADMIN_TREE_ID (trees.id) or ADMIN_TREE_FILE_ID (gedcom_files.file_id) in .env.local, then restart the dev server.",
  };
}

let cachedFileUuid: string | null = null;

export async function getAdminFileUuid(): Promise<string> {
  if (cachedFileUuid) return cachedFileUuid;

  const r = await resolveAdminGedcomFileUuid();
  if (!r.ok) {
    throw new AdminTreeResolutionError(r.reason);
  }
  cachedFileUuid = r.fileUuid;
  return cachedFileUuid;
}
