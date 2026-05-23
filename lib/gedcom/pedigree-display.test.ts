import { describe, it, expect } from "vitest";
import {
  formatPedigreeRelationship,
  mergePedigreesForChild,
  parentChildEdgesForFamilyAsChild,
  buildChildNonBirthIndicatorMap,
  childShowsNonBirthIndicator,
  type ParentChildEdgeForPedigree,
  type ParentChildRelForChildIndicator,
} from "@/lib/gedcom/pedigree-display";

// ── formatPedigreeRelationship ────────────────────────────────────────────────

describe("formatPedigreeRelationship", () => {
  it("returns pedigree text when present (takes precedence)", () => {
    expect(formatPedigreeRelationship("biological", "Custom label")).toBe("Custom label");
  });

  it("maps 'biological' to 'Birth'", () => {
    expect(formatPedigreeRelationship("biological", null)).toBe("Birth");
  });

  it("maps 'birth' to 'Birth'", () => {
    expect(formatPedigreeRelationship("birth", null)).toBe("Birth");
  });

  it("maps 'adopted' to 'Adopted'", () => {
    expect(formatPedigreeRelationship("adopted", null)).toBe("Adopted");
  });

  it("maps 'foster' to 'Foster'", () => {
    expect(formatPedigreeRelationship("foster", null)).toBe("Foster");
  });

  it("maps 'step' to 'Step'", () => {
    expect(formatPedigreeRelationship("step", null)).toBe("Step");
  });

  it("maps 'sealing' to 'Sealing'", () => {
    expect(formatPedigreeRelationship("sealing", null)).toBe("Sealing");
  });

  it("defaults null/undefined relationship to 'Birth'", () => {
    expect(formatPedigreeRelationship(null, null)).toBe("Birth");
    expect(formatPedigreeRelationship(undefined, null)).toBe("Birth");
  });

  it("passes through unknown relationship types", () => {
    expect(formatPedigreeRelationship("CUSTOM_TYPE", null)).toBe("CUSTOM_TYPE");
  });

  it("is case-insensitive for relationship type", () => {
    expect(formatPedigreeRelationship("ADOPTED", null)).toBe("Adopted");
    expect(formatPedigreeRelationship("Foster", null)).toBe("Foster");
  });
});

// ── mergePedigreesForChild ────────────────────────────────────────────────────

describe("mergePedigreesForChild", () => {
  it("returns '—' for empty rows", () => {
    expect(mergePedigreesForChild([])).toBe("—");
  });

  it("returns a single label for one row", () => {
    expect(mergePedigreesForChild([{ relationshipType: "adopted", pedigree: null }])).toBe("Adopted");
  });

  it("deduplicates identical labels", () => {
    const rows = [
      { relationshipType: "biological", pedigree: null },
      { relationshipType: "birth", pedigree: null },
    ];
    expect(mergePedigreesForChild(rows)).toBe("Birth");
  });

  it("joins distinct labels with ·", () => {
    const rows = [
      { relationshipType: "biological", pedigree: null },
      { relationshipType: "adopted", pedigree: null },
    ];
    expect(mergePedigreesForChild(rows)).toBe("Birth · Adopted");
  });

  it("filters out '—' placeholders from the join", () => {
    const rows = [
      { relationshipType: null, pedigree: null },
    ];
    // null → 'Birth', not '—'
    expect(mergePedigreesForChild(rows)).toBe("Birth");
  });
});

// ── parentChildEdgesForFamilyAsChild ─────────────────────────────────────────

const HUSBAND_ID = "h1";
const WIFE_ID = "w1";
const FAMILY_ID = "f1";

function edge(
  parentId: string,
  familyId: string | null,
  relationshipType: string | null = "biological",
  pedigree: string | null = null,
): ParentChildEdgeForPedigree {
  return { parentId, familyId, relationshipType, pedigree };
}

describe("parentChildEdgesForFamilyAsChild — matching by familyId", () => {
  it("returns edges that match familyId and parent is in union", () => {
    const edges = [
      edge(HUSBAND_ID, FAMILY_ID),
      edge(WIFE_ID, FAMILY_ID),
      edge(HUSBAND_ID, "other-fam"),
    ];
    const result = parentChildEdgesForFamilyAsChild(edges, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(result).toHaveLength(2);
  });

  it("orders husband before wife", () => {
    const edges = [
      edge(WIFE_ID, FAMILY_ID),
      edge(HUSBAND_ID, FAMILY_ID),
    ];
    const result = parentChildEdgesForFamilyAsChild(edges, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(result[0].relationshipType).toBe("biological"); // husband first
    expect(result).toHaveLength(2);
  });

  it("excludes edges whose parent is not in the union", () => {
    const edges = [
      edge("stranger", FAMILY_ID),
      edge(HUSBAND_ID, FAMILY_ID),
    ];
    const result = parentChildEdgesForFamilyAsChild(edges, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ relationshipType: "biological" });
  });
});

describe("parentChildEdgesForFamilyAsChild — null-familyId fallback", () => {
  it("falls back to null-familyId edges when no edges match familyId", () => {
    const edges = [
      edge(HUSBAND_ID, null),
      edge(WIFE_ID, null),
    ];
    const result = parentChildEdgesForFamilyAsChild(edges, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(result).toHaveLength(2);
  });

  it("prefers familyId match over null-familyId fallback", () => {
    const edges = [
      edge(HUSBAND_ID, null, "adopted"),
      edge(HUSBAND_ID, FAMILY_ID, "biological"),
    ];
    const result = parentChildEdgesForFamilyAsChild(edges, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(result).toHaveLength(1);
    expect(result[0].relationshipType).toBe("biological");
  });
});

// ── childShowsNonBirthIndicator ───────────────────────────────────────────────

describe("childShowsNonBirthIndicator", () => {
  it("returns false for all-biological rows", () => {
    expect(childShowsNonBirthIndicator([
      { relationshipType: "biological", pedigree: null },
      { relationshipType: "birth", pedigree: null },
    ])).toBe(false);
  });

  it("returns true when any row has a non-birth relationshipType", () => {
    expect(childShowsNonBirthIndicator([
      { relationshipType: "adopted", pedigree: null },
    ])).toBe(true);
  });

  it("returns true when any row has a non-empty pedigree", () => {
    expect(childShowsNonBirthIndicator([
      { relationshipType: "biological", pedigree: "By church record" },
    ])).toBe(true);
  });

  it("returns false for empty rows", () => {
    expect(childShowsNonBirthIndicator([])).toBe(false);
  });
});

// ── buildChildNonBirthIndicatorMap ────────────────────────────────────────────

function childRel(
  childId: string,
  parentId: string,
  familyId: string | null,
  relationshipType: string | null = "biological",
  pedigree: string | null = null,
): ParentChildRelForChildIndicator {
  return { childId, parentId, familyId, relationshipType, pedigree };
}

describe("buildChildNonBirthIndicatorMap", () => {
  it("returns false for a child with only biological links in this family", () => {
    const rels = [
      childRel("c1", HUSBAND_ID, FAMILY_ID, "biological"),
      childRel("c1", WIFE_ID, FAMILY_ID, "birth"),
    ];
    const m = buildChildNonBirthIndicatorMap(rels, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(m.get("c1")).toBe(false);
  });

  it("returns true for a child with an adopted link in this family", () => {
    const rels = [
      childRel("c1", HUSBAND_ID, FAMILY_ID, "adopted"),
    ];
    const m = buildChildNonBirthIndicatorMap(rels, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(m.get("c1")).toBe(true);
  });

  it("does not include children from other families", () => {
    const rels = [
      childRel("c1", HUSBAND_ID, "other-fam", "adopted"),
    ];
    const m = buildChildNonBirthIndicatorMap(rels, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(m.has("c1")).toBe(false);
  });

  it("handles multiple children independently", () => {
    const rels = [
      childRel("c1", HUSBAND_ID, FAMILY_ID, "biological"),
      childRel("c2", WIFE_ID, FAMILY_ID, "adopted"),
    ];
    const m = buildChildNonBirthIndicatorMap(rels, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(m.get("c1")).toBe(false);
    expect(m.get("c2")).toBe(true);
  });

  it("returns empty map when no rels match this family", () => {
    const rels = [childRel("c1", HUSBAND_ID, "other-fam")];
    const m = buildChildNonBirthIndicatorMap(rels, FAMILY_ID, HUSBAND_ID, WIFE_ID);
    expect(m.size).toBe(0);
  });
});
