import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { createAssociateIndividualAndMergeSyncAssociations } from "@/lib/admin/admin-individual-editor-apply";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { parseIndividualEditorPayload } from "@/lib/forms/individual-editor-payload";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { gedcomIndividualNlDenormSelect } from "@/lib/gedcom/gedcom-individual-nl-select";

export const POST = withAdminAuth(async (req, user, ctx) => {
  const { id: subjectIndividualId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomIndividual.findFirst({
    where: { id: subjectIndividualId, fileUuid },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const inner = body.individual;
  if (!inner || typeof inner !== "object") {
    return NextResponse.json({ error: "individual object is required" }, { status: 400 });
  }
  const rela = typeof body.rela === "string" ? body.rela : "";

  const parsed = parseIndividualEditorPayload(inner as Record<string, unknown>);

  try {
    let associateIndividualId = "";
    let xref = "";
    let fullName: string | null = null;
    const nl = {
      primarySurnameLower: null as string | null,
      birthCountry: null as string | null,
      birthCountryLower: null as string | null,
      deathCountry: null as string | null,
      deathCountryLower: null as string | null,
      ageAtDeath: null as number | null,
      generationDepth: null as number | null,
    };

    await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      associateIndividualId = await createAssociateIndividualAndMergeSyncAssociations(
        changeCtx,
        subjectIndividualId,
        parsed,
        rela,
      );
      const row = await tx.gedcomIndividual.findUnique({
        where: { id: associateIndividualId },
        select: { xref: true, fullName: true, ...gedcomIndividualNlDenormSelect },
      });
      xref = row?.xref ?? "";
      fullName = row?.fullName ?? null;
      if (row) {
        nl.primarySurnameLower = row.primarySurnameLower;
        nl.birthCountry = row.birthCountry;
        nl.birthCountryLower = row.birthCountryLower;
        nl.deathCountry = row.deathCountry;
        nl.deathCountryLower = row.deathCountryLower;
        nl.ageAtDeath = row.ageAtDeath;
        nl.generationDepth = row.generationDepth;
      }
    });

    return NextResponse.json({
      associateIndividualId,
      xref,
      fullName,
      ...nl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
