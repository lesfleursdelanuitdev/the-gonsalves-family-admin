import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnionFind, branchHash, topN, branchName, type IndividualRow } from "./branch-detection.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeIndividual(overrides: Partial<IndividualRow> & { id: string }): IndividualRow {
  return {
    fullName: null,
    primarySurnameLower: null,
    birthYear: null,
    deathYear: null,
    hasParents: false,
    ...overrides,
  };
}

// ── UnionFind ──────────────────────────────────────────────────────────────────

describe("UnionFind", () => {
  it("registers a new node on first find — root is itself", () => {
    const uf = new UnionFind();
    expect(uf.find("a")).toBe("a");
  });

  it("find is idempotent", () => {
    const uf = new UnionFind();
    expect(uf.find("x")).toBe(uf.find("x"));
  });

  it("union joins two previously separate nodes", () => {
    const uf = new UnionFind();
    uf.union("a", "b");
    expect(uf.find("a")).toBe(uf.find("b"));
  });

  it("union of already-connected nodes is a no-op", () => {
    const uf = new UnionFind();
    uf.union("a", "b");
    const root1 = uf.find("a");
    uf.union("a", "b");
    expect(uf.find("a")).toBe(root1);
  });

  it("union is transitive — three nodes end up in the same component", () => {
    const uf = new UnionFind();
    uf.union("a", "b");
    uf.union("b", "c");
    const root = uf.find("a");
    expect(uf.find("b")).toBe(root);
    expect(uf.find("c")).toBe(root);
  });

  it("nodes in different components have different roots", () => {
    const uf = new UnionFind();
    uf.union("a", "b");
    uf.find("c"); // register c separately
    expect(uf.find("a")).not.toBe(uf.find("c"));
  });

  it("path compression: after find, all nodes on path point to root", () => {
    const uf = new UnionFind();
    // Build a chain a→b→c→d by rank-equal unions (each union raises rank of winner)
    // Then verify all share the same root after find
    uf.union("a", "b");
    uf.union("c", "d");
    uf.union("a", "c"); // merges the two pairs
    const root = uf.find("d");
    expect(uf.find("a")).toBe(root);
    expect(uf.find("b")).toBe(root);
    expect(uf.find("c")).toBe(root);
  });

  it("union by rank: equal-rank union increments winner's rank", () => {
    const uf = new UnionFind();
    // Two fresh nodes have rank 0; after union, one becomes root with rank 1
    uf.union("x", "y");
    const root = uf.find("x");
    // A third node unioned with root: root still wins (rank 1 > 0)
    uf.union(root, "z");
    expect(uf.find("z")).toBe(root);
  });

  it("handles large linear chain without stack overflow", () => {
    const uf = new UnionFind();
    const ids = Array.from({ length: 500 }, (_, i) => `node-${i}`);
    for (let i = 0; i < ids.length - 1; i++) uf.union(ids[i], ids[i + 1]);
    const root = uf.find(ids[0]);
    for (const id of ids) expect(uf.find(id)).toBe(root);
  });
});

// ── branchHash ────────────────────────────────────────────────────────────────

describe("branchHash", () => {
  it("returns a 16-char hex string", () => {
    expect(branchHash(["a", "b"])).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic — same input always gives the same hash", () => {
    const ids = ["id-1", "id-2", "id-3"];
    expect(branchHash(ids)).toBe(branchHash(ids));
  });

  it("is order-independent — shuffled input gives the same hash", () => {
    const a = branchHash(["id-1", "id-2", "id-3"]);
    const b = branchHash(["id-3", "id-1", "id-2"]);
    const c = branchHash(["id-2", "id-3", "id-1"]);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("different founder sets produce different hashes", () => {
    expect(branchHash(["id-1", "id-2"])).not.toBe(branchHash(["id-1", "id-3"]));
  });

  it("single founder hashes correctly", () => {
    const h = branchHash(["only-one"]);
    expect(h).toHaveLength(16);
    expect(branchHash(["only-one"])).toBe(h);
  });
});

// ── topN ──────────────────────────────────────────────────────────────────────

describe("topN", () => {
  it("returns empty array for empty input", () => {
    expect(topN([], 3)).toEqual([]);
  });

  it("returns the single item when n=1", () => {
    expect(topN(["a", "b", "b", "a", "a"], 1)).toEqual(["a"]);
  });

  it("ranks by frequency descending", () => {
    const result = topN(["b", "a", "a", "a", "b", "c"], 3);
    expect(result[0]).toBe("a"); // 3 times
    expect(result[1]).toBe("b"); // 2 times
    expect(result[2]).toBe("c"); // 1 time
  });

  it("defaults to n=3", () => {
    expect(topN(["a", "b", "c", "d"])).toHaveLength(3);
  });

  it("returns all items when n exceeds unique count", () => {
    expect(topN(["x", "y"], 10)).toHaveLength(2);
  });

  it("returns at most n items", () => {
    expect(topN(["a", "b", "c", "d", "e"], 2)).toHaveLength(2);
  });

  it("each item appears at most once in the result", () => {
    const result = topN(["a", "a", "a", "b", "b"], 3);
    expect(new Set(result).size).toBe(result.length);
  });
});

// ── branchName ────────────────────────────────────────────────────────────────

describe("branchName", () => {
  describe("single founder", () => {
    it("uses founder's full name + 'family'", () => {
      const founder = makeIndividual({ id: "f1", fullName: "John Smith" });
      expect(branchName([founder], [founder])).toBe("John Smith family");
    });

    it("strips GEDCOM slashes from founder name", () => {
      const founder = makeIndividual({ id: "f1", fullName: "/Smith/ John" });
      expect(branchName([founder], [founder])).toBe("Smith John family");
    });

    it("falls back to top surname when founder has no name", () => {
      const founder = makeIndividual({ id: "f1", fullName: null, primarySurnameLower: "jones" });
      const member = makeIndividual({ id: "m1", primarySurnameLower: "jones" });
      expect(branchName([founder], [founder, member])).toBe("jones family");
    });

    it("falls back to 'Unknown family' when founder has no name and no surnames exist", () => {
      const founder = makeIndividual({ id: "f1" });
      expect(branchName([founder], [founder])).toBe("Unknown family");
    });
  });

  describe("multiple founders", () => {
    it("uses dominant surname across members", () => {
      const f1 = makeIndividual({ id: "f1", fullName: "Alice Brown", primarySurnameLower: "brown" });
      const f2 = makeIndividual({ id: "f2", fullName: "Bob Green", primarySurnameLower: "green" });
      const m1 = makeIndividual({ id: "m1", primarySurnameLower: "brown" });
      const m2 = makeIndividual({ id: "m2", primarySurnameLower: "brown" });
      expect(branchName([f1, f2], [f1, f2, m1, m2])).toBe("brown family");
    });

    it("falls back to 'Unknown family' when no surnames exist", () => {
      const f1 = makeIndividual({ id: "f1" });
      const f2 = makeIndividual({ id: "f2" });
      expect(branchName([f1, f2], [f1, f2])).toBe("Unknown family");
    });
  });

  describe("no founders (empty array)", () => {
    it("uses top surname from members", () => {
      const m1 = makeIndividual({ id: "m1", primarySurnameLower: "garcia" });
      const m2 = makeIndividual({ id: "m2", primarySurnameLower: "garcia" });
      expect(branchName([], [m1, m2])).toBe("garcia family");
    });
  });
});

// ── runBranchDetection (integration with mocked Prisma) ───────────────────────

vi.mock("../database/prisma.ts", () => {
  const upsertedIds: string[] = [];

  const prisma = {
    gedcomBranchRun: {
      create: vi.fn().mockResolvedValue({ id: "run-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    gedcomBranch: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockImplementation(async () => {
        const id = `branch-${upsertedIds.length + 1}`;
        upsertedIds.push(id);
        return { id };
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    gedcomIndividual: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    gedcomParentChild: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return { prisma };
});

describe("runBranchDetection (mocked Prisma)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../database/prisma.ts");
    prismaMock = mod.prisma;
    // Reset defaults
    prismaMock.gedcomBranchRun.create.mockResolvedValue({ id: "run-1" });
    prismaMock.gedcomBranchRun.update.mockResolvedValue({});
    prismaMock.gedcomBranch.findMany.mockResolvedValue([]);
    prismaMock.gedcomBranch.count.mockResolvedValue(0);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue(null);
    prismaMock.gedcomBranch.upsert.mockResolvedValue({ id: "branch-1" });
    prismaMock.gedcomBranch.update.mockResolvedValue({});
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([]);
  });

  it("returns zero summary when there are no individuals", async () => {
    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");
    expect(result).toMatchObject({
      type: "branch-detection",
      totalBranches: 0,
      mainBranchSize: 0,
      mainBranchCoverage: 0,
      isolatedIndividuals: 0,
      newBranches: 0,
      mergedBranches: 0,
      updatedBranches: 0,
    });
  });

  it("counts a size-1 component as isolated, not a branch", async () => {
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([
      makeIndividual({ id: "solo", hasParents: false }),
    ]);
    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");
    expect(result.isolatedIndividuals).toBe(1);
    expect(prismaMock.gedcomBranch.upsert).not.toHaveBeenCalled();
  });

  it("upserts one branch for a connected pair", async () => {
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([
      makeIndividual({ id: "p1", hasParents: false, primarySurnameLower: "smith" }),
      makeIndividual({ id: "c1", hasParents: true, primarySurnameLower: "smith" }),
    ]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([{ parentId: "p1", childId: "c1" }]);
    prismaMock.gedcomBranch.count.mockResolvedValue(1);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue({ id: "branch-1" });

    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");

    expect(prismaMock.gedcomBranch.upsert).toHaveBeenCalledOnce();
    expect(result.totalBranches).toBe(1);
    expect(result.newBranches).toBe(1);
    expect(result.isolatedIndividuals).toBe(0);
  });

  it("increments newBranches for hashes not in existing DB records", async () => {
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([
      makeIndividual({ id: "p1", hasParents: false }),
      makeIndividual({ id: "c1", hasParents: true }),
    ]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([{ parentId: "p1", childId: "c1" }]);
    prismaMock.gedcomBranch.findMany.mockResolvedValue([]); // no existing branches
    prismaMock.gedcomBranch.count.mockResolvedValue(1);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue({ id: "branch-1" });

    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");
    expect(result.newBranches).toBe(1);
    expect(result.updatedBranches).toBe(0);
  });

  it("increments updatedBranches when hash exists but size changed", async () => {
    const ind1 = makeIndividual({ id: "p1", hasParents: false });
    const ind2 = makeIndividual({ id: "c1", hasParents: true });
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([ind1, ind2]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([{ parentId: "p1", childId: "c1" }]);

    const hash = branchHash(["p1"]); // founder is p1 (hasParents:false)
    prismaMock.gedcomBranch.findMany.mockResolvedValue([
      { id: "old-branch", branchHash: hash, size: 99 }, // size mismatch → updated
    ]);
    prismaMock.gedcomBranch.count.mockResolvedValue(1);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue({ id: "branch-1" });

    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");
    expect(result.updatedBranches).toBe(1);
    expect(result.newBranches).toBe(0);
  });

  it("counts stale DB hashes as mergedBranches and deletes them", async () => {
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([
      makeIndividual({ id: "p1", hasParents: false }),
      makeIndividual({ id: "c1", hasParents: true }),
    ]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([{ parentId: "p1", childId: "c1" }]);

    // DB has an extra branch that isn't in the current computation
    prismaMock.gedcomBranch.findMany.mockResolvedValue([
      { id: "ghost-branch", branchHash: "deadbeef00000000", size: 5 },
    ]);
    prismaMock.gedcomBranch.count.mockResolvedValue(1);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue({ id: "branch-1" });

    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");

    expect(result.mergedBranches).toBe(1);
    expect(prismaMock.gedcomBranch.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchHash: { in: ["deadbeef00000000"] } }),
      }),
    );
  });

  it("records error message and re-throws on unexpected failure", async () => {
    prismaMock.gedcomIndividual.findMany.mockRejectedValue(new Error("DB gone"));

    const { runBranchDetection } = await import("./branch-detection.ts");
    await expect(runBranchDetection("file-uuid", "manual")).rejects.toThrow("DB gone");

    expect(prismaMock.gedcomBranchRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: "DB gone" }),
      }),
    );
  });

  it("two disjoint pairs each become a branch, larger becomes isMain", async () => {
    prismaMock.gedcomIndividual.findMany.mockResolvedValue([
      // pair A (3 members)
      makeIndividual({ id: "a1", hasParents: false, primarySurnameLower: "adams" }),
      makeIndividual({ id: "a2", hasParents: true, primarySurnameLower: "adams" }),
      makeIndividual({ id: "a3", hasParents: true, primarySurnameLower: "adams" }),
      // pair B (2 members)
      makeIndividual({ id: "b1", hasParents: false, primarySurnameLower: "brown" }),
      makeIndividual({ id: "b2", hasParents: true, primarySurnameLower: "brown" }),
    ]);
    prismaMock.gedcomParentChild.findMany.mockResolvedValue([
      { parentId: "a1", childId: "a2" },
      { parentId: "a1", childId: "a3" },
      { parentId: "b1", childId: "b2" },
    ]);
    prismaMock.gedcomBranch.count.mockResolvedValue(2);
    prismaMock.gedcomBranch.findFirst.mockResolvedValue({ id: "branch-1" });

    let upsertCallCount = 0;
    prismaMock.gedcomBranch.upsert.mockImplementation(async () => {
      upsertCallCount++;
      return { id: `branch-${upsertCallCount}` };
    });

    const { runBranchDetection } = await import("./branch-detection.ts");
    const result = await runBranchDetection("file-uuid", "manual");

    expect(result.totalBranches).toBe(2);
    expect(result.newBranches).toBe(2);
    expect(result.mainBranchSize).toBe(3);
    expect(prismaMock.gedcomBranch.upsert).toHaveBeenCalledTimes(2);
    // isMain should be set on the largest
    expect(prismaMock.gedcomBranch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isMain: true } }),
    );
  });
});
