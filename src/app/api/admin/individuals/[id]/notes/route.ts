import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { attachExistingNoteToIndividual } from "@/lib/admin/admin-note-links";
import { ADMIN_INDIVIDUAL_DETAIL_INCLUDE } from "@/app/api/admin/individuals/individual-detail-include";

function parseJsonNoteId(body: unknown): string | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).noteId;
  if (typeof raw !== "string") return null;
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

export const POST = withAdminAuth(async (req, _user, ctx) => {
  const { id: individualId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const indSp = new URLSearchParams();
  indSp.set("id", individualId);
  const parsedIndividualId = parseNoteLinkedEntityIdParam(indSp, "id");
  if (!parsedIndividualId) {
    return NextResponse.json({ error: "Invalid individual id" }, { status: 400 });
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

  const result = await attachExistingNoteToIndividual(fileUuid, parsedIndividualId, noteId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id: parsedIndividualId },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });

  return NextResponse.json({ individual });
});
