import { describe, it, expect } from "vitest";
import {
  normalizeChildRelationshipType,
  canonicalSpouseSlotsForPair,
  singleSpouseSlotForFirstParent,
  spouseSlotFromSex,
} from "@/lib/admin/admin-individual-families";

// ── normalizeChildRelationshipType ────────────────────────────────────────────

describe("normalizeChildRelationshipType", () => {
  it("passes through recognised types unchanged", () => {
    expect(normalizeChildRelationshipType("adopted")).toBe("adopted");
    expect(normalizeChildRelationshipType("foster")).toBe("foster");
    expect(normalizeChildRelationshipType("step")).toBe("step");
    expect(normalizeChildRelationshipType("sealing")).toBe("sealing");
    expect(normalizeChildRelationshipType("guardian")).toBe("guardian");
    expect(normalizeChildRelationshipType("other")).toBe("other");
  });

  it("normalises 'biological' to 'biological'", () => {
    expect(normalizeChildRelationshipType("biological")).toBe("biological");
  });

  it("normalises 'birth' alias to 'biological'", () => {
    expect(normalizeChildRelationshipType("birth")).toBe("biological");
  });

  it("lowercases before matching", () => {
    expect(normalizeChildRelationshipType("ADOPTED")).toBe("adopted");
    expect(normalizeChildRelationshipType("Biological")).toBe("biological");
    expect(normalizeChildRelationshipType("BIRTH")).toBe("biological");
  });

  it("trims whitespace before matching", () => {
    expect(normalizeChildRelationshipType("  adopted  ")).toBe("adopted");
  });

  it("falls back to 'biological' for unrecognised values", () => {
    expect(normalizeChildRelationshipType("unknown-type")).toBe("biological");
    expect(normalizeChildRelationshipType("")).toBe("biological");
    expect(normalizeChildRelationshipType("GARBAGE")).toBe("biological");
  });
});

// ── spouseSlotFromSex ─────────────────────────────────────────────────────────

describe("spouseSlotFromSex", () => {
  it("returns 'husband' for M", () => {
    expect(spouseSlotFromSex("M")).toBe("husband");
    expect(spouseSlotFromSex("m")).toBe("husband");
  });

  it("returns 'wife' for F", () => {
    expect(spouseSlotFromSex("F")).toBe("wife");
    expect(spouseSlotFromSex("f")).toBe("wife");
  });

  it("throws for U (ambiguous without pair context)", () => {
    expect(() => spouseSlotFromSex("U")).toThrow();
  });

  it("throws for X", () => {
    expect(() => spouseSlotFromSex("X")).toThrow();
  });

  it("throws for null", () => {
    expect(() => spouseSlotFromSex(null)).toThrow();
  });

  it("throws for undefined", () => {
    expect(() => spouseSlotFromSex(undefined)).toThrow();
  });
});

// ── singleSpouseSlotForFirstParent ────────────────────────────────────────────

describe("singleSpouseSlotForFirstParent", () => {
  it("F → wife", () => expect(singleSpouseSlotForFirstParent("F")).toBe("wife"));
  it("f → wife (case-insensitive)", () => expect(singleSpouseSlotForFirstParent("f")).toBe("wife"));

  it("M → husband", () => expect(singleSpouseSlotForFirstParent("M")).toBe("husband"));
  it("U → husband (unknown defaults to husband slot)", () => expect(singleSpouseSlotForFirstParent("U")).toBe("husband"));
  it("X → husband", () => expect(singleSpouseSlotForFirstParent("X")).toBe("husband"));
  it("null → husband", () => expect(singleSpouseSlotForFirstParent(null)).toBe("husband"));
  it("undefined → husband", () => expect(singleSpouseSlotForFirstParent(undefined)).toBe("husband"));
  it("empty string → husband", () => expect(singleSpouseSlotForFirstParent("")).toBe("husband"));
});

// ── canonicalSpouseSlotsForPair ───────────────────────────────────────────────
//
// Rules (in priority order):
//   1. M + F  → M=husband, F=wife  (regardless of argument order)
//   2. M + U/X/null → M=husband, other=wife
//   3. F + U/X/null → other=husband, F=wife
//   4. Neither M nor F (U+U, U+X, X+X, null+null, …) → husband=lesser id, wife=greater id

function pair(aId: string, aSex: string | null, bId: string, bSex: string | null) {
  return canonicalSpouseSlotsForPair({ id: aId, sex: aSex }, { id: bId, sex: bSex });
}

describe("canonicalSpouseSlotsForPair — M+F combinations", () => {
  it("M(a) + F(b) → a=husband, b=wife", () => {
    expect(pair("a", "M", "b", "F")).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("F(a) + M(b) → b=husband, a=wife (argument order irrelevant)", () => {
    expect(pair("a", "F", "b", "M")).toEqual({ husbandId: "b", wifeId: "a" });
  });

  it("lowercase sex values treated the same as uppercase", () => {
    expect(pair("a", "m", "b", "f")).toEqual({ husbandId: "a", wifeId: "b" });
  });
});

describe("canonicalSpouseSlotsForPair — unknown/other sex with M", () => {
  it("M(a) + U(b) → a=husband, b=wife", () => {
    expect(pair("a", "M", "b", "U")).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("U(a) + M(b) → b=husband, a=wife", () => {
    expect(pair("a", "U", "b", "M")).toEqual({ husbandId: "b", wifeId: "a" });
  });

  it("M(a) + X(b) → a=husband, b=wife", () => {
    expect(pair("a", "M", "b", "X")).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("M(a) + null(b) → a=husband, b=wife", () => {
    expect(pair("a", "M", "b", null)).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("null(a) + M(b) → b=husband, a=wife", () => {
    expect(pair("a", null, "b", "M")).toEqual({ husbandId: "b", wifeId: "a" });
  });
});

describe("canonicalSpouseSlotsForPair — unknown/other sex with F", () => {
  it("U(a) + F(b) → a=husband, b=wife", () => {
    expect(pair("a", "U", "b", "F")).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("F(a) + U(b) → b=husband, a=wife", () => {
    expect(pair("a", "F", "b", "U")).toEqual({ husbandId: "b", wifeId: "a" });
  });

  it("null(a) + F(b) → a=husband, b=wife", () => {
    expect(pair("a", null, "b", "F")).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("F(a) + null(b) → b=husband, a=wife", () => {
    expect(pair("a", "F", "b", null)).toEqual({ husbandId: "b", wifeId: "a" });
  });

  it("X(a) + F(b) → a=husband, b=wife", () => {
    expect(pair("a", "X", "b", "F")).toEqual({ husbandId: "a", wifeId: "b" });
  });
});

describe("canonicalSpouseSlotsForPair — ID sort fallback (neither M nor F)", () => {
  it("U + U: alphabetically earlier id becomes husband", () => {
    // "aaa" < "zzz" → husband=aaa
    expect(pair("aaa", "U", "zzz", "U")).toEqual({ husbandId: "aaa", wifeId: "zzz" });
  });

  it("U + U: later id becomes wife when argument order is reversed", () => {
    expect(pair("zzz", "U", "aaa", "U")).toEqual({ husbandId: "aaa", wifeId: "zzz" });
  });

  it("null + null: alphabetically earlier id becomes husband", () => {
    expect(pair("a", null, "b", null)).toEqual({ husbandId: "a", wifeId: "b" });
    expect(pair("b", null, "a", null)).toEqual({ husbandId: "a", wifeId: "b" });
  });

  it("X + X: id sort determines slots", () => {
    expect(pair("@I1@", "X", "@I2@", "X")).toEqual({ husbandId: "@I1@", wifeId: "@I2@" });
  });

  it("M + M: id sort fallback (both same sex)", () => {
    // Both M — no F counterpart — falls through all conditions to ID sort
    expect(pair("aaa", "M", "zzz", "M")).toEqual({ husbandId: "aaa", wifeId: "zzz" });
  });

  it("F + F: id sort fallback (both same sex)", () => {
    expect(pair("aaa", "F", "zzz", "F")).toEqual({ husbandId: "aaa", wifeId: "zzz" });
  });

  it("result is deterministic regardless of argument order (id sort)", () => {
    const ab = pair("alpha", "U", "beta", "U");
    const ba = pair("beta", "U", "alpha", "U");
    expect(ab).toEqual(ba);
  });
});
