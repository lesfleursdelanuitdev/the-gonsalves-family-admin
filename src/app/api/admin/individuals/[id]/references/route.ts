import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = await prisma.gedcomIndividual.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          individualEvents: true,
          individualNotes: true,
          individualSources: true,
          individualMedia: true,
          storyIndividuals: true,
          openQuestionIndividuals: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const counts = row._count;
  return NextResponse.json({
    events: counts.individualEvents,
    notes: counts.individualNotes,
    sources: counts.individualSources,
    media: counts.individualMedia,
    stories: counts.storyIndividuals,
    openQuestions: counts.openQuestionIndividuals,
    total:
      counts.individualEvents +
      counts.individualNotes +
      counts.individualSources +
      counts.individualMedia +
      counts.storyIndividuals +
      counts.openQuestionIndividuals,
  });
});
