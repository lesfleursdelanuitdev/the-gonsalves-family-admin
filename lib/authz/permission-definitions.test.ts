import { describe, it, expect } from "vitest";
import {
  normalizePermissionAction,
  isAllowedPermissionDefinitionAction,
  permissionDescription,
  uiCreatePermissionActions,
} from "@/lib/authz/permissionDefinitions";

// ── normalizePermissionAction ─────────────────────────────────────────────────

describe("normalizePermissionAction", () => {
  it("passes through standard actions unchanged", () => {
    expect(normalizePermissionAction("read")).toBe("read");
    expect(normalizePermissionAction("create")).toBe("create");
    expect(normalizePermissionAction("update")).toBe("update");
    expect(normalizePermissionAction("delete")).toBe("delete");
    expect(normalizePermissionAction("manage")).toBe("manage");
    expect(normalizePermissionAction("reply")).toBe("reply");
  });

  it("normalises 'edit' alias to 'update'", () => {
    expect(normalizePermissionAction("edit")).toBe("update");
  });

  it("lowercases input before normalising", () => {
    expect(normalizePermissionAction("EDIT")).toBe("update");
    expect(normalizePermissionAction("READ")).toBe("read");
    expect(normalizePermissionAction("MANAGE")).toBe("manage");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizePermissionAction("  edit  ")).toBe("update");
    expect(normalizePermissionAction("  read  ")).toBe("read");
  });
});

// ── isAllowedPermissionDefinitionAction ──────────────────────────────────────

describe("isAllowedPermissionDefinitionAction", () => {
  it("allows all standard definition actions", () => {
    expect(isAllowedPermissionDefinitionAction("read")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("create")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("update")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("delete")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("manage")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("reply")).toBe(true);
  });

  it("allows 'edit' because it normalises to 'update'", () => {
    expect(isAllowedPermissionDefinitionAction("edit")).toBe(true);
  });

  it("allows uppercase variants", () => {
    expect(isAllowedPermissionDefinitionAction("READ")).toBe(true);
    expect(isAllowedPermissionDefinitionAction("DELETE")).toBe(true);
  });

  it("rejects unrecognised actions", () => {
    expect(isAllowedPermissionDefinitionAction("garbage")).toBe(false);
    expect(isAllowedPermissionDefinitionAction("merge_records")).toBe(false);
    expect(isAllowedPermissionDefinitionAction("export")).toBe(false);
    expect(isAllowedPermissionDefinitionAction("")).toBe(false);
    expect(isAllowedPermissionDefinitionAction("admin")).toBe(false);
  });
});

// ── permissionDescription ─────────────────────────────────────────────────────

describe("permissionDescription", () => {
  it("formats a simple tree-scope description", () => {
    expect(permissionDescription("individual", "read", "tree")).toBe(
      "Read individual records at tree scope."
    );
  });

  it("formats a create action", () => {
    expect(permissionDescription("family", "create", "tree")).toBe(
      "Create family records at tree scope."
    );
  });

  it("formats an update action as 'Edit'", () => {
    expect(permissionDescription("event", "update", "tree")).toBe(
      "Edit event records at tree scope."
    );
  });

  it("formats a delete action", () => {
    expect(permissionDescription("note", "delete", "tree")).toBe(
      "Delete note records at tree scope."
    );
  });

  it("humanizes camelCase entity names", () => {
    expect(permissionDescription("openQuestion", "read", "tree")).toBe(
      "Read open question records at tree scope."
    );
  });

  it("humanizes snake_case / kebab-case entity names", () => {
    expect(permissionDescription("given_name", "read", "tree")).toBe(
      "Read given name records at tree scope."
    );
  });

  it("replaces 'other_users' scope with 'other users' in description", () => {
    expect(permissionDescription("media", "read", "other_users")).toBe(
      "Read media records at other users scope."
    );
  });

  it("handles site scope", () => {
    expect(permissionDescription("role", "delete", "site")).toBe(
      "Delete role records at site scope."
    );
  });

  it("formats gedcom special action merge_records", () => {
    expect(permissionDescription("gedcom", "merge_records", "gedcom")).toBe(
      "Merge records gedcom records at gedcom scope."
    );
  });

  it("formats gedcom export action", () => {
    expect(permissionDescription("gedcom", "export", "gedcom")).toBe(
      "Export gedcom records at gedcom scope."
    );
  });

  it("falls back gracefully for empty entity", () => {
    const result = permissionDescription("", "read", "tree");
    expect(result).toContain("resource");
  });
});

// ── uiCreatePermissionActions ─────────────────────────────────────────────────

describe("uiCreatePermissionActions", () => {
  it("returns exactly 4 actions", () => {
    expect(uiCreatePermissionActions()).toHaveLength(4);
  });

  it("contains read, create, update (as Edit), delete", () => {
    const actions = uiCreatePermissionActions();
    const values = actions.map((a) => a.value);
    expect(values).toContain("read");
    expect(values).toContain("create");
    expect(values).toContain("update");
    expect(values).toContain("delete");
  });

  it("labels 'update' as 'Edit'", () => {
    const actions = uiCreatePermissionActions();
    const updateEntry = actions.find((a) => a.value === "update");
    expect(updateEntry?.label).toBe("Edit");
  });

  it("capitalises other labels", () => {
    const actions = uiCreatePermissionActions();
    for (const { value, label } of actions) {
      if (value !== "update") {
        expect(label[0]).toBe(label[0]?.toUpperCase());
      }
    }
  });
});
