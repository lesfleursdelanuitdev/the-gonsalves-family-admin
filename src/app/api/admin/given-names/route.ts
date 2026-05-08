import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");
  const treeId = await getAdminTreeId();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const { limit, offset } = parseListParams(searchParams);

  const upstreamLimit = Math.max(200, offset + limit);
  const res = await fetch(
    `${PYTHON_API_URL}/api/research/trees/${encodeURIComponent(treeId)}/analytics/given-names?limit=${upstreamLimit}`,
  );
  const data = (await res.json().catch(() => ({}))) as {
    top_names?: Array<{ id: string; name: string; frequency: number }>;
    error?: string;
  };
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error || "Failed to fetch given-name analytics" },
      { status: res.status },
    );
  }

  const normalizedQ = q?.toLowerCase();
  const allRows = (data.top_names ?? [])
    .map((row) => ({
      id: row.id,
      givenName: row.name,
      givenNameLower: row.name.toLowerCase(),
      frequency: row.frequency,
    }))
    .filter((row) => !normalizedQ || row.givenNameLower.includes(normalizedQ));

  const total = allRows.length;
  const givenNames = allRows.slice(offset, offset + limit);

  return NextResponse.json({
    givenNames,
    total,
    hasMore: offset + givenNames.length < total,
  });
});
