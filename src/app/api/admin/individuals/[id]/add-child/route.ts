import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  executeAddChildWizard,
  type AddChildWizardBody,
} from "@/lib/admin/admin-individual-add-child-wizard";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

function parseBody(raw: Record<string, unknown>): AddChildWizardBody | null {
  const path = raw.path;
  if (
    path !== "unknown_parent" &&
    path !== "existing_person" &&
    path !== "new_person" &&
    path !== "existing_family"
  ) {
    return null;
  }

  const child = raw.child as Record<string, unknown> | undefined;
  if (!child || typeof child !== "object") return null;
  const kind = child.kind;
  if (kind === "existing") {
    const childIndividualId =
      typeof child.childIndividualId === "string" ? child.childIndividualId.trim() : "";
    if (!childIndividualId) return null;
    return {
      path,
      familyId: typeof raw.familyId === "string" ? raw.familyId : undefined,
      secondParentIndividualId:
        typeof raw.secondParentIndividualId === "string" ? raw.secondParentIndividualId : undefined,
      newSecondParent:
        raw.newSecondParent && typeof raw.newSecondParent === "object"
          ? (raw.newSecondParent as Record<string, unknown>)
          : undefined,
      child: { kind: "existing", childIndividualId },
      relationshipType: typeof raw.relationshipType === "string" ? raw.relationshipType : undefined,
      relationshipToCurrentPerson:
        typeof raw.relationshipToCurrentPerson === "string" ? raw.relationshipToCurrentPerson : undefined,
      relationshipToOtherParent:
        typeof raw.relationshipToOtherParent === "string" ? raw.relationshipToOtherParent : undefined,
      birthOrder:
        typeof raw.birthOrder === "number" && Number.isFinite(raw.birthOrder)
          ? Math.trunc(raw.birthOrder)
          : raw.birthOrder === null
            ? null
            : undefined,
    };
  }
  if (kind === "new") {
    const individual = child.individual;
    if (!individual || typeof individual !== "object") return null;
    return {
      path,
      familyId: typeof raw.familyId === "string" ? raw.familyId : undefined,
      secondParentIndividualId:
        typeof raw.secondParentIndividualId === "string" ? raw.secondParentIndividualId : undefined,
      newSecondParent:
        raw.newSecondParent && typeof raw.newSecondParent === "object"
          ? (raw.newSecondParent as Record<string, unknown>)
          : undefined,
      child: { kind: "new", individual: individual as Record<string, unknown> },
      relationshipType: typeof raw.relationshipType === "string" ? raw.relationshipType : undefined,
      relationshipToCurrentPerson:
        typeof raw.relationshipToCurrentPerson === "string" ? raw.relationshipToCurrentPerson : undefined,
      relationshipToOtherParent:
        typeof raw.relationshipToOtherParent === "string" ? raw.relationshipToOtherParent : undefined,
      birthOrder:
        typeof raw.birthOrder === "number" && Number.isFinite(raw.birthOrder)
          ? Math.trunc(raw.birthOrder)
          : raw.birthOrder === null
            ? null
            : undefined,
    };
  }
  return null;
}

export const POST = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { id: subjectIndividualId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomIndividual.findFirst({
    where: { id: subjectIndividualId, fileUuid },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  const raw = (await req.json()) as Record<string, unknown>;
  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    let familyId = "";
    let childId = "";
    await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      const out = await executeAddChildWizard(changeCtx, subjectIndividualId, body);
      familyId = out.familyId;
      childId = out.childId;
    });
    return NextResponse.json({ familyId, childId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Add child failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
