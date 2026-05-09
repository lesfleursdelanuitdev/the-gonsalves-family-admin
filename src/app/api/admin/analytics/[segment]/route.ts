import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { AdminTreeResolutionError, getAdminTreeId } from "@/lib/infra/admin-tree";

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

/** Path segment after `/analytics/` on ligneous-python-api (must match Flask routes). */
const ALLOWED_SEGMENTS = new Set([
  "given-names",
  "surnames",
  "individuals",
  "families",
  "events",
  "places",
  "dates",
  "media",
  "notes",
  "open-questions",
]);

export const GET = withAdminAuth(async (req: NextRequest, user, ctx) => {
  const params = await ctx.params;
  const segment = params.segment ?? "";
  if (!ALLOWED_SEGMENTS.has(segment)) {
    return NextResponse.json({ error: "Unsupported analytics segment" }, { status: 400 });
  }

  let treeId: string;
  try {
    treeId = await getAdminTreeId();
  } catch (e) {
    if (e instanceof AdminTreeResolutionError) {
      return NextResponse.json({ configured: false as const, error: e.message }, { status: 503 });
    }
    throw e;
  }

  const qs = req.nextUrl.searchParams.toString();
  const url = `${PYTHON_API_URL}/api/research/trees/${encodeURIComponent(treeId)}/analytics/${segment}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: { "X-User-Id": user.id, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": contentType },
  });
});
