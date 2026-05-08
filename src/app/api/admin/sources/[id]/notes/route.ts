import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { attachExistingNoteToSource } from "@/lib/admin/admin-note-links";

const SOURCE_DETAIL_FOR_NOTE_ATTACH = {
  individualSources: {
    include: {
      individual: { select: { id: true, fullName: true, xref: true } },
    },
  },
  familySources: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { fullName: true } },
          wife: { select: { fullName: true } },
        },
      },
    },
  },
  eventSources: { include: { event: { select: { id: true, eventType: true } } } },
  sourceNotes: { include: { note: { select: { id: true, xref: true, content: true } } } },
  sourceMedia: { include: { media: { select: { id: true, title: true, fileRef: true } } } },
} as const;

function parseJsonNoteId(body: unknown): string | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).noteId;
  if (typeof raw !== "string") return null;
  const sp = new URLSearchParams();
  sp.set("id", raw.trim());
  return parseNoteLinkedEntityIdParam(sp, "id");
}

export const POST = withAdminAuth(async (req, _user, ctx) => {
  const { id: sourceId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const srcSp = new URLSearchParams();
  srcSp.set("id", sourceId);
  const parsedSourceId = parseNoteLinkedEntityIdParam(srcSp, "id");
  if (!parsedSourceId) {
    return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
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

  const result = await attachExistingNoteToSource(fileUuid, parsedSourceId, noteId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const source = await prisma.gedcomSource.findUnique({
    where: { id: parsedSourceId },
    include: SOURCE_DETAIL_FOR_NOTE_ATTACH,
  });

  return NextResponse.json({ source });
});
