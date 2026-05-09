import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { AdminTreeResolutionError, getAdminTreeId } from "@/lib/infra/admin-tree";
import type {
  GivenNamesAnalyticsResponse,
  SurnamesAnalyticsResponse,
} from "@/lib/admin/admin-statistics-analytics";

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

async function fetchJson<T>(url: string, userId: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(url, {
    headers: { "X-User-Id": userId, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

export const GET = withAdminAuth(async (_req, user) => {
  let treeId: string;
  try {
    treeId = await getAdminTreeId();
  } catch (e) {
    if (e instanceof AdminTreeResolutionError) {
      return NextResponse.json(
        { configured: false as const, error: e.message },
        { status: 503 },
      );
    }
    throw e;
  }

  const limit = 30;
  const base = `${PYTHON_API_URL}/api/research/trees/${encodeURIComponent(treeId)}/analytics`;
  const [givenRes, surRes] = await Promise.all([
    fetchJson<GivenNamesAnalyticsResponse>(`${base}/given-names?limit=${limit}`, user.id),
    fetchJson<SurnamesAnalyticsResponse>(`${base}/surnames?limit=${limit}`, user.id),
  ]);

  if (!givenRes.ok || !givenRes.data || !surRes.ok || !surRes.data) {
    const detail = !givenRes.ok
      ? `given-names: HTTP ${givenRes.status}`
      : !surRes.ok
        ? `surnames: HTTP ${surRes.status}`
        : "missing JSON body";
    return NextResponse.json(
      {
        configured: true as const,
        treeId,
        error: "Statistics API unavailable or returned an error.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
        pythonApiUrl: process.env.NODE_ENV === "development" ? PYTHON_API_URL : undefined,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    configured: true as const,
    treeId,
    givenNames: givenRes.data,
    surnames: surRes.data,
  });
});
