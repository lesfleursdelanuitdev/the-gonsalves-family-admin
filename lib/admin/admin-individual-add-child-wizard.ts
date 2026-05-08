import type { Prisma } from "@ligneous/prisma";
import type { ChangeCtx } from "@/lib/admin/changelog";
import {
  createIndividualFromEditorPayload,
  createNewFamilyLinkingPair,
  createNewFamilyWithSingleParent,
  type IndividualEditorPayload,
} from "@/lib/admin/admin-individual-editor-apply";
import { addChildToFamily } from "@/lib/admin/admin-family-membership";
import { parseIndividualEditorPayload } from "@/lib/forms/individual-editor-payload";

type Tx = Prisma.TransactionClient;

export type AddChildWizardPath = "unknown_parent" | "existing_person" | "new_person" | "existing_family";

export type AddChildWizardBody = {
  path: AddChildWizardPath;
  /** Path `existing_family` */
  familyId?: string;
  /** Path `existing_person` */
  secondParentIndividualId?: string;
  /** Path `new_person` — parsed like membership `createChildAndAdd` individual */
  newSecondParent?: Record<string, unknown>;
  child:
    | { kind: "existing"; childIndividualId: string }
    | { kind: "new"; individual: Record<string, unknown> };
  /** Used when only one parent is linked or as fallback */
  relationshipType?: string;
  /** When two parents: relationship of child to the edited person */
  relationshipToCurrentPerson?: string;
  /** When two parents: relationship of child to the other parent */
  relationshipToOtherParent?: string;
  birthOrder?: number | null;
};

function stripIndividualPayloadForNestedCreate(p: IndividualEditorPayload): IndividualEditorPayload {
  const out: IndividualEditorPayload = { ...p };
  delete (out as { familiesAsSpouse?: unknown }).familiesAsSpouse;
  delete (out as { familiesAsChild?: unknown }).familiesAsChild;
  delete (out as { newSpouseFamilies?: unknown }).newSpouseFamilies;
  delete (out as { newChildFamiliesFromNewParents?: unknown }).newChildFamiliesFromNewParents;
  delete (out as { newChildFamiliesLinkExistingParents?: unknown }).newChildFamiliesLinkExistingParents;
  delete (out as { addChildrenToSpouseFamilies?: unknown }).addChildrenToSpouseFamilies;
  delete (out as { associates?: unknown }).associates;
  return out;
}

/** Prefer an existing “unknown other parent” family (sole parent = subject) so Path A does not spam duplicate FAMs. */
export async function findReusableSingleParentFamily(
  tx: Tx,
  fileUuid: string,
  subjectId: string,
): Promise<string | null> {
  const row = await tx.gedcomFamily.findFirst({
    where: {
      fileUuid,
      OR: [
        { husbandId: subjectId, wifeId: null },
        { wifeId: subjectId, husbandId: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function assertSubjectIsSpouseInFamily(
  tx: Tx,
  fileUuid: string,
  subjectId: string,
  familyId: string,
): Promise<void> {
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error("Family not found");
  if (fam.husbandId !== subjectId && fam.wifeId !== subjectId) {
    throw new Error("This person is not a parent in the selected family");
  }
}

function buildAddChildRelationshipOpts(
  fam: { husbandId: string | null; wifeId: string | null },
  subjectId: string,
  body: AddChildWizardBody,
): {
  relationshipType?: string;
  relationshipToHusband?: string | null;
  relationshipToWife?: string | null;
  birthOrder?: number | null;
} {
  const hasTwoParents = !!fam.husbandId && !!fam.wifeId;
  const relDef = (body.relationshipType ?? "biological").trim() || "biological";
  const relCur = (body.relationshipToCurrentPerson ?? relDef).trim() || relDef;
  const relOth = (body.relationshipToOtherParent ?? relCur).trim() || relCur;

  if (!hasTwoParents) {
    return { relationshipType: relCur };
  }

  if (fam.husbandId === subjectId) {
    return {
      relationshipType: relDef,
      relationshipToHusband: relCur,
      relationshipToWife: relOth,
    };
  }
  if (fam.wifeId === subjectId) {
    return {
      relationshipType: relDef,
      relationshipToHusband: relOth,
      relationshipToWife: relCur,
    };
  }

  return { relationshipType: relCur };
}

/**
 * Single transaction: resolve family context (reuse/create/link), create child if needed, attach as family child.
 */
export async function executeAddChildWizard(
  ctx: ChangeCtx,
  subjectIndividualId: string,
  body: AddChildWizardBody,
): Promise<{ familyId: string; childId: string }> {
  const { tx, fileUuid } = ctx;
  const subject = subjectIndividualId.trim();
  if (!subject) throw new Error("Subject individual id is required");

  const subj = await tx.gedcomIndividual.findFirst({
    where: { id: subject, fileUuid },
    select: { id: true },
  });
  if (!subj) throw new Error("Individual not found in this tree");

  let familyId = "";

  switch (body.path) {
    case "unknown_parent": {
      const reuse = await findReusableSingleParentFamily(tx, fileUuid, subject);
      familyId = reuse ?? (await createNewFamilyWithSingleParent(ctx, subject));
      break;
    }
    case "existing_person": {
      const pid = body.secondParentIndividualId?.trim();
      if (!pid) throw new Error("secondParentIndividualId is required");
      if (pid === subject) throw new Error("The other parent cannot be the same person");
      const partner = await tx.gedcomIndividual.findFirst({
        where: { id: pid, fileUuid },
        select: { id: true },
      });
      if (!partner) throw new Error("Other parent not found in this tree");
      familyId = await createNewFamilyLinkingPair(ctx, subject, pid);
      break;
    }
    case "new_person": {
      const inner = body.newSecondParent;
      if (!inner || typeof inner !== "object") throw new Error("newSecondParent object is required");
      const parsed = parseIndividualEditorPayload(inner as Record<string, unknown>);
      const stripped = stripIndividualPayloadForNestedCreate(parsed);
      const partnerId = await createIndividualFromEditorPayload(ctx, stripped);
      familyId = await createNewFamilyLinkingPair(ctx, subject, partnerId);
      break;
    }
    case "existing_family": {
      const fid = body.familyId?.trim();
      if (!fid) throw new Error("familyId is required");
      await assertSubjectIsSpouseInFamily(tx, fileUuid, subject, fid);
      familyId = fid;
      break;
    }
    default:
      throw new Error("Invalid path");
  }

  let childId = "";
  if (body.child.kind === "existing") {
    childId = body.child.childIndividualId.trim();
    if (!childId) throw new Error("childIndividualId is required");
  } else {
    const parsed = parseIndividualEditorPayload(body.child.individual as Record<string, unknown>);
    const stripped = stripIndividualPayloadForNestedCreate(parsed);
    childId = await createIndividualFromEditorPayload(ctx, stripped);
  }

  const childExists = await tx.gedcomIndividual.findFirst({
    where: { id: childId, fileUuid },
    select: { id: true },
  });
  if (!childExists) throw new Error("Child individual not found in this tree");

  if (childId === subject) throw new Error("A person cannot be their own child");

  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error("Family not found");

  const birthOrder =
    body.birthOrder != null && Number.isFinite(body.birthOrder) ? Math.trunc(body.birthOrder) : null;

  const relOpts = buildAddChildRelationshipOpts(fam, subject, body);

  await addChildToFamily(ctx, familyId, childId, {
    birthOrder,
    ...relOpts,
  });

  return { familyId, childId };
}
