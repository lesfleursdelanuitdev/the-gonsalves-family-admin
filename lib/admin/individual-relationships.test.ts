import { describe, expect, it } from "vitest";
import { lookupTypeRoleForRela, normalizeRelaToken } from "./individual-relationships";

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
