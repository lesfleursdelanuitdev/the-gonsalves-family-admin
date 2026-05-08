import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { attachExistingNoteToEvent } from "@/lib/admin/admin-note-links";
import { ADMIN_EVENT_DETAIL_INCLUDE } from "@/app/api/admin/events/event-admin-detail-include";

function parseJsonNoteId(body: unknown): string | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).noteId;
  if (typeof raw !== "string") return null;
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

export const POST = withAdminAuth(async (req, _user, ctx) => {
  const { id: eventId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const evSp = new URLSearchParams();
  evSp.set("id", eventId);
  const parsedEventId = parseNoteLinkedEntityIdParam(evSp, "id");
  if (!parsedEventId) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
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

  const result = await attachExistingNoteToEvent(fileUuid, parsedEventId, noteId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const event = await prisma.gedcomEvent.findUnique({
    where: { id: parsedEventId },
    include: ADMIN_EVENT_DETAIL_INCLUDE,
  });

  return NextResponse.json({ event });
});
