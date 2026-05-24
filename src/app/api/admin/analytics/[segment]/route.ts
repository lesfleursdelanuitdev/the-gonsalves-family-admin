import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { AdminTreeResolutionError, getAdminTreeId, getAdminFileUuid } from "@/lib/infra/admin-tree";
import { prisma } from "@/lib/database/prisma";

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

/** Segments served from the Python research API. */
const PYTHON_SEGMENTS = new Set([
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

/** Segments served from Prisma (no Python dependency). */
const DB_SEGMENTS = new Set(["branches", "lineages"]);

async function branchesAnalytics(fileUuid: string) {
  const [branches, lastRun] = await Promise.all([
    prisma.gedcomBranch.findMany({
      where: { fileUuid },
      orderBy: { size: "desc" },
      select: { id: true, name: true, size: true, isMain: true, earliestYear: true, latestYear: true, topSurnames: true },
    }),
    prisma.gedcomBranchRun.findFirst({
      where: { fileUuid },
      orderBy: { startedAt: "desc" },
      select: { completedAt: true, errorMessage: true },
    }),
  ]);
  const main = branches.find((b) => b.isMain) ?? branches[0] ?? null;
  return {
    totalBranches: branches.length,
    totalIndividualsInBranches: branches.reduce((s, b) => s + b.size, 0),
    mainBranch: main ? { name: main.name, size: main.size } : null,
    topBranches: branches.slice(0, 20).map((b) => ({ name: b.name, size: b.size, isMain: b.isMain })),
    lastComputedAt: lastRun?.completedAt?.toISOString() ?? null,
  };
}

async function lineagesAnalytics(fileUuid: string) {
  const [lineages, lastRun] = await Promise.all([
    prisma.lineage.findMany({
      where: { fileUuid },
      orderBy: { size: "desc" },
      select: { id: true, name: true, surname: true, size: true, earliestYear: true, latestYear: true },
    }),
    prisma.lineageRun.findFirst({
      where: { fileUuid },
      orderBy: { startedAt: "desc" },
      select: { completedAt: true, bridgeChildren: true, errorMessage: true },
    }),
  ]);
  const years = lineages
    .flatMap((l) => [l.earliestYear, l.latestYear])
    .filter((y): y is number => y != null);

  // Size distribution buckets
  const BUCKETS = [
    { label: "1–10", min: 1, max: 10 },
    { label: "11–50", min: 11, max: 50 },
    { label: "51–200", min: 51, max: 200 },
    { label: "201–500", min: 201, max: 500 },
    { label: "500+", min: 501, max: Infinity },
  ];
  const sizeDistribution = BUCKETS.map(({ label, min, max }) => ({
    label,
    count: lineages.filter((l) => l.size >= min && l.size <= max).length,
  }));

  return {
    totalLineages: lineages.length,
    totalMemberships: lineages.reduce((s, l) => s + l.size, 0),
    bridgeChildren: lastRun?.bridgeChildren ?? null,
    topLineages: lineages.slice(0, 20).map((l) => ({
      name: l.name,
      size: l.size,
      earliestYear: l.earliestYear,
      latestYear: l.latestYear,
    })),
    sizeDistribution,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    lastComputedAt: lastRun?.completedAt?.toISOString() ?? null,
  };
}

export const GET = withAdminAuth(async (req: NextRequest, user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const params = await ctx.params;
  const segment = params.segment ?? "";

  if (DB_SEGMENTS.has(segment)) {
    let fileUuid: string;
    try {
      fileUuid = await getAdminFileUuid();
    } catch (e) {
      if (e instanceof AdminTreeResolutionError) {
        return NextResponse.json({ configured: false as const, error: e.message }, { status: 503 });
      }
      throw e;
    }
    const data =
      segment === "branches"
        ? await branchesAnalytics(fileUuid)
        : await lineagesAnalytics(fileUuid);
    return NextResponse.json(data);
  }

  if (!PYTHON_SEGMENTS.has(segment)) {
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
