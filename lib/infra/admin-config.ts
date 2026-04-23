/**
 * Admin app scope: exactly one tree.
 * Set ADMIN_TREE_ID (Tree.id UUID) or ADMIN_TREE_FILE_ID (Tree.fileId) in .env.local.
 * If unset, UI will show a setup message.
 */

export const ADMIN_TREE_NAME = "The Gonsalves Family";

export function getAdminTreeId(): string | null {
  return process.env.ADMIN_TREE_ID ?? process.env.ADMIN_TREE_FILE_ID ?? null;
}

export function getAdminTreeFileId(): string | null {
  return process.env.ADMIN_TREE_FILE_ID ?? null;
}
