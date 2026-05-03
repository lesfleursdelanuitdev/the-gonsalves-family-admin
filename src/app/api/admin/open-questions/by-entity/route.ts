import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { getOpenQuestionsForEntity, isOpenQuestionEntityType } from "@/lib/admin/open-questions";

export const GET = withAdminAuth(async (req) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const entityType = searchParams.get("entityType")?.trim() ?? "";
  const entityId = searchParams.get("entityId")?.trim() ?? "";
  if (!isOpenQuestionEntityType(entityType)) {
    return NextResponse.json(
      { error: "entityType must be individual, family, event, or media" },
      { status: 400 },
    );
  }
  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  const openQuestions = await getOpenQuestionsForEntity(fileUuid, entityType, entityId);
  return NextResponse.json({ openQuestions });
});
