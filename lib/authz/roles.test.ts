import { describe, it, expect } from "vitest";
import { toRoleKey } from "@/lib/authz/roles";

describe("toRoleKey", () => {
  it("lowercases input", () => {
    expect(toRoleKey("ADMIN")).toBe("admin");
    expect(toRoleKey("TreeOwner")).toBe("treeowner");
  });

  it("trims surrounding whitespace", () => {
    expect(toRoleKey("  admin  ")).toBe("admin");
  });

  it("replaces spaces with underscores", () => {
    expect(toRoleKey("Tree Owner")).toBe("tree_owner");
    expect(toRoleKey("Site Admin")).toBe("site_admin");
  });

  it("replaces hyphens with underscores", () => {
    expect(toRoleKey("custom-role-name")).toBe("custom_role_name");
  });

  it("replaces consecutive non-alphanumeric chars with a single underscore", () => {
    expect(toRoleKey("role  --  name")).toBe("role_name");
    expect(toRoleKey("role / with / slashes")).toBe("role_with_slashes");
  });

  it("removes leading and trailing underscores", () => {
    expect(toRoleKey("_role_")).toBe("role");
    expect(toRoleKey("__admin__")).toBe("admin");
  });

  it("handles purely non-alphanumeric input", () => {
    // After replacing all non-alphanumeric → "_", then stripping leading/trailing "_" → ""
    expect(toRoleKey("!@#$%")).toBe("");
  });

  it("preserves digits", () => {
    expect(toRoleKey("role2")).toBe("role2");
    expect(toRoleKey("role 2024")).toBe("role_2024");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(150);
    expect(toRoleKey(long)).toHaveLength(100);
  });

  it("does not truncate strings at or under 100 characters", () => {
    const exact = "a".repeat(100);
    expect(toRoleKey(exact)).toHaveLength(100);
    const short = "role";
    expect(toRoleKey(short)).toBe("role");
  });

  it("combined: mixed case, spaces, and special chars", () => {
    expect(toRoleKey("  Tree Owner / Admin  ")).toBe("tree_owner_admin");
  });
});
