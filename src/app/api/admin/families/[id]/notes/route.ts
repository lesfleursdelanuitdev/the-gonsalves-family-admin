import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { attachExistingNoteToFamily } from "@/lib/admin/admin-note-links";
import { ADMIN_FAMILY_DETAIL_INCLUDE } from "@/app/api/admin/families/family-admin-detail-include";

function parseJsonNoteId(body: unknown): string | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).noteId;
  if (typeof raw !== "string") return null;
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

export const POST = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "note", action: "update", scope: "tree" });
  const { id: familyId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const famSp = new URLSearchParams();
  famSp.set("id", familyId);
  const parsedFamilyId = parseNoteLinkedEntityIdParam(famSp, "id");
  if (!parsedFamilyId) {
    return NextResponse.json({ error: "Invalid family id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const noteId = parseJsonNoteId(body);
  if (!noteId) {
    return NextResponse.json({ error: "noteId is required (UUID)" }, { status: 400 });
  }

  const result = await attachExistingNoteToFamily(fileUuid, parsedFamilyId, noteId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const family = await prisma.gedcomFamily.findUnique({
    where: { id: parsedFamilyId },
    include: ADMIN_FAMILY_DETAIL_INCLUDE,
  });

  return NextResponse.json({ family });
});
