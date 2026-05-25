/**
 * Branch detection via Union-Find over the pedigree parent-child graph.
 * O(V + E·α(V)) ≈ linear. No Python dependency.
 */
import { createHash } from "crypto";
import { prisma } from "../database/prisma.ts";

// ── Union-Find ────────────────────────────────────────────────────────────────

export class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
    const p = this.parent.get(id)!;
    if (p !== id) {
      this.parent.set(id, this.find(p));
    }
    return this.parent.get(id)!;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BranchDetectionSummary = {
  type: "branch-detection";
  totalBranches: number;
  mainBranchSize: number;
  mainBranchCoverage: number;
  isolatedIndividuals: number;
  newBranches: number;
  mergedBranches: number;
  updatedBranches: number;
};

export type IndividualRow = {
  id: string;
  fullName: string | null;
  primarySurnameLower: string | null;
  birthYear: number | null;
  deathYear: number | null;
  hasParents: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function branchHash(founderIds: string[]): string {
  return createHash("sha256")
    .update([...founderIds].sort().join(","))
    .digest("hex")
    .slice(0, 16);
}

export function topN<T extends string>(items: T[], n = 3): T[] {
  const freq = new Map<T, number>();
  for (const item of items) freq.set(item, (freq.get(item) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
}

export function branchName(founders: IndividualRow[], members: IndividualRow[]): string {
  const surnames = members
    .map((m) => m.primarySurnameLower)
    .filter((s): s is string => s != null && s.length > 0);
  const top = topN(surnames, 1)[0];

  if (founders.length === 1) {
    const name = founders[0].fullName?.replace(/\//g, "").trim();
    return name ? `${name} family` : top ? `${top} family` : "Unknown family";
  }
  return top ? `${top} family` : "Unknown family";
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runBranchDetection(
  fileUuid: string,
  triggeredBy: "manual" | "scheduled" = "manual",
): Promise<BranchDetectionSummary> {
  const run = await prisma.gedcomBranchRun.create({
    data: { fileUuid, triggeredBy },
  });

  try {
    const summary = await _detect(fileUuid, run.id);
    await prisma.gedcomBranchRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        totalBranches: summary.totalBranches,
        mainBranchSize: summary.mainBranchSize,
        isolatedIndividuals: summary.isolatedIndividuals,
        newBranches: summary.newBranches,
        mergedBranches: summary.mergedBranches,
        updatedBranches: summary.updatedBranches,
      },
    });
    return summary;
  } catch (err) {
    await prisma.gedcomBranchRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function _detect(fileUuid: string, _runId: string): Promise<BranchDetectionSummary> {
  // 1. Load all individuals + edges in parallel
  const [individuals, edges, families] = await Promise.all([
    prisma.gedcomIndividual.findMany({
      where: { fileUuid },
      select: {
        id: true,
        fullName: true,
        primarySurnameLower: true,
        birthYear: true,
        deathYear: true,
        hasParents: true,
      },
    }),
    prisma.gedcomParentChild.findMany({
      where: { fileUuid },
      select: { parentId: true, childId: true },
    }),
    prisma.gedcomFamily.findMany({
      where: { fileUuid },
      select: { husbandId: true, wifeId: true },
    }),
  ]);

  if (individuals.length === 0) {
    return {
      type: "branch-detection",
      totalBranches: 0,
      mainBranchSize: 0,
      mainBranchCoverage: 0,
      isolatedIndividuals: 0,
      newBranches: 0,
      mergedBranches: 0,
      updatedBranches: 0,
    };
  }

  // 2. Build Union-Find
  const uf = new UnionFind();
  for (const ind of individuals) uf.find(ind.id); // register all nodes
  for (const e of edges) {
    if (e.parentId && e.childId) uf.union(e.parentId, e.childId);
  }
  // Union spouses so childless couples aren't isolated from the graph
  for (const f of families) {
    if (f.husbandId && f.wifeId) uf.union(f.husbandId, f.wifeId);
  }

  // 3. Group into components
  const byRoot = new Map<string, IndividualRow[]>();
  for (const ind of individuals) {
    const root = uf.find(ind.id);
    const group = byRoot.get(root);
    if (group) group.push(ind);
    else byRoot.set(root, [ind]);
  }

  // 4. Load existing branches for change detection
  const existing = await prisma.gedcomBranch.findMany({
    where: { fileUuid },
    select: { id: true, branchHash: true, size: true },
  });
  const existingByHash = new Map(existing.map((b) => [b.branchHash, b]));
  const seenHashes = new Set<string>();

  // 5. Compute + upsert branches (size ≥ 2 only)
  let newBranches = 0;
  let mergedBranches = 0;
  let updatedBranches = 0;
  let isolatedIndividuals = 0;
  let mainBranchSize = 0;
  const upsertedBranchIds: string[] = [];
  const isolatedIds: string[] = [];

  const CHUNK = 1000;

  for (const [, members] of byRoot) {
    if (members.length < 2) {
      isolatedIndividuals += members.length;
      isolatedIds.push(...members.map((m) => m.id));
      continue;
    }

    const founders = members.filter((m) => !m.hasParents);
    // Fallback: if every member has parents recorded, use the member with earliest birth year
    const effectiveFounders =
      founders.length > 0
        ? founders
        : members
            .filter((m) => m.birthYear != null)
            .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
            .slice(0, 1);

    const hash = branchHash(effectiveFounders.map((f) => f.id));
    seenHashes.add(hash);

    const size = members.length;
    const founderIds = effectiveFounders.map((f) => f.id);
    const surnames = members
      .map((m) => m.primarySurnameLower)
      .filter((s): s is string => !!s);
    const topSurnames = topN(surnames, 3);
    const years = members.flatMap((m) => [m.birthYear, m.deathYear]).filter((y): y is number => y != null);
    const earliestYear = years.length ? Math.min(...years) : null;
    const latestYear = years.length ? Math.max(...years) : null;
    const name = branchName(effectiveFounders, members);

    if (size > mainBranchSize) mainBranchSize = size;

    const prev = existingByHash.get(hash);
    if (!prev) newBranches++;
    else if (prev.size !== size) updatedBranches++;

    const upserted = await prisma.gedcomBranch.upsert({
      where: { fileUuid_branchHash: { fileUuid, branchHash: hash } },
      create: {
        fileUuid,
        branchHash: hash,
        name,
        size,
        isMain: false,
        founderIds,
        topSurnames,
        earliestYear,
        latestYear,
        computedAt: new Date(),
      },
      update: {
        name,
        size,
        founderIds,
        topSurnames,
        earliestYear,
        latestYear,
        computedAt: new Date(),
      },
      select: { id: true },
    });
    upsertedBranchIds.push(upserted.id);

    // Bulk-update branch_id on members in chunks
    const memberIds = members.map((m) => m.id);
    for (let i = 0; i < memberIds.length; i += CHUNK) {
      const chunk = memberIds.slice(i, i + CHUNK);
      await prisma.gedcomIndividual.updateMany({
        where: { id: { in: chunk } },
        data: { branchId: upserted.id },
      });
    }
  }

  // 6. Mark the largest branch as isMain
  if (upsertedBranchIds.length > 0) {
    await prisma.gedcomBranch.updateMany({
      where: { fileUuid },
      data: { isMain: false },
    });
    const mainBranch = await prisma.gedcomBranch.findFirst({
      where: { fileUuid },
      orderBy: { size: "desc" },
      select: { id: true },
    });
    if (mainBranch) {
      await prisma.gedcomBranch.update({
        where: { id: mainBranch.id },
        data: { isMain: true },
      });
    }
  }

  // 7. Clear branch_id for truly isolated individuals (size-1 components only).
  // Using the collected IDs rather than hasParents/hasChildren avoids incorrectly
  // nulling spouses who are connected to a branch only through their partner.
  for (let i = 0; i < isolatedIds.length; i += CHUNK) {
    const chunk = isolatedIds.slice(i, i + CHUNK);
    await prisma.gedcomIndividual.updateMany({
      where: { id: { in: chunk } },
      data: { branchId: null },
    });
  }

  // 8. Delete branches that no longer exist (merged or removed)
  const staleHashes = [...existingByHash.keys()].filter((h) => !seenHashes.has(h));
  mergedBranches = staleHashes.length;
  if (staleHashes.length > 0) {
    await prisma.gedcomBranch.deleteMany({
      where: { fileUuid, branchHash: { in: staleHashes } },
    });
  }

  const totalBranches = await prisma.gedcomBranch.count({ where: { fileUuid } });
  const mainBranchCoverage =
    individuals.length > 0 ? mainBranchSize / individuals.length : 0;

  return {
    type: "branch-detection",
    totalBranches,
    mainBranchSize,
    mainBranchCoverage,
    isolatedIndividuals,
    newBranches,
    mergedBranches,
    updatedBranches,
  };
}
