/** Whether the signed-in admin user may edit or delete this tag (matches list/delete rules). */
export function tagMayMutate(
  tag: { isGlobal: boolean; userId: string | null },
  user: { id: string; isWebsiteOwner: boolean },
): boolean {
  if (!tag.isGlobal && tag.userId === user.id) return true;
  if (tag.isGlobal && user.isWebsiteOwner) return true;
  return false;
}
