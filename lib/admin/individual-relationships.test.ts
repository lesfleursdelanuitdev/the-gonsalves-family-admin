import { describe, expect, it } from "vitest";
import { DEFAULT_RELATIONSHIP_TYPE_SEEDS, lookupTypeRoleForRela, normalizeRelaToken } from "./individual-relationships";

describe("individual-relationships normalization", () => {
  it("normalizes RELA values with whitespace and hyphens", () => {
    expect(normalizeRelaToken("  Step-Parent  ")).toBe("step_parent");
    expect(normalizeRelaToken("Romantic Partner")).toBe("romantic_partner");
  });

  it("maps known RELA aliases to canonical type/role", () => {
    expect(lookupTypeRoleForRela("friend")).toEqual({ typeKey: "friendship", roleKey: "friend" });
    expect(lookupTypeRoleForRela("romantic partner")).toEqual({ typeKey: "dating", roleKey: "partner" });
    expect(lookupTypeRoleForRela("slave owner")).toEqual({ typeKey: "enslavement", roleKey: "enslaver" });
    expect(lookupTypeRoleForRela("step-child")).toEqual({ typeKey: "step_parenthood", roleKey: "step_child" });
  });

  it("returns null for unknown RELA values", () => {
    expect(lookupTypeRoleForRela("guild member")).toBeNull();
  });
});

describe("DEFAULT_RELATIONSHIP_TYPE_SEEDS reciprocal structure", () => {
  it("every role's reciprocalRoleKey points to a valid sibling role key", () => {
    for (const type of DEFAULT_RELATIONSHIP_TYPE_SEEDS) {
      const roleKeys = new Set(type.roles.map((r) => r.key));
      for (const role of type.roles) {
        expect(
          roleKeys.has(role.reciprocalRoleKey),
          `${type.key}.${role.key}.reciprocalRoleKey="${role.reciprocalRoleKey}" not found in roles`,
        ).toBe(true);
      }
    }
  });

  it("symmetric types have a single role that is its own reciprocal", () => {
    for (const type of DEFAULT_RELATIONSHIP_TYPE_SEEDS) {
      if (!type.isSymmetric) continue;
      expect(type.roles).toHaveLength(1);
      expect(type.roles[0].reciprocalRoleKey).toBe(type.roles[0].key);
    }
  });

  it("asymmetric types have paired roles where reciprocals point to each other", () => {
    for (const type of DEFAULT_RELATIONSHIP_TYPE_SEEDS) {
      if (type.isSymmetric) continue;
      // For every role A → reciprocal key K, role with key K must point back to A.
      for (const role of type.roles) {
        const reciprocal = type.roles.find((r) => r.key === role.reciprocalRoleKey);
        expect(
          reciprocal?.reciprocalRoleKey,
          `${type.key}: reciprocal of "${role.key}" should point back to "${role.key}"`,
        ).toBe(role.key);
      }
    }
  });

  it("godparenthood roles resolve correctly", () => {
    const godparentType = DEFAULT_RELATIONSHIP_TYPE_SEEDS.find((t) => t.key === "godparenthood")!;
    const godparent = godparentType.roles.find((r) => r.key === "godparent")!;
    const godchild = godparentType.roles.find((r) => r.key === "godchild")!;
    expect(godparent.reciprocalRoleKey).toBe("godchild");
    expect(godchild.reciprocalRoleKey).toBe("godparent");
  });

  it("GEDCOM RELA tokens on each type are non-empty strings", () => {
    for (const type of DEFAULT_RELATIONSHIP_TYPE_SEEDS) {
      expect(type.gedcomRelaAtoB.trim(), `${type.key}.gedcomRelaAtoB is empty`).not.toBe("");
      expect(type.gedcomRelaBtoA.trim(), `${type.key}.gedcomRelaBtoA is empty`).not.toBe("");
    }
  });
});
