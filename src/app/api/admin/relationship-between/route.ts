import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { AdminTreeResolutionError, getAdminFileUuid } from "@/lib/infra/admin-tree";

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

export const POST = withAdminAuth(async (req: NextRequest) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });

  let fileUuid: string;
  try {
    fileUuid = await getAdminFileUuid();
  } catch (e) {
    if (e instanceof AdminTreeResolutionError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const res = await fetch(`${PYTHON_API_URL}/api/relationship/between`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, file_uuid: fileUuid }),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
