import { describe, it, expect } from "vitest";
import { resolveAdminRoutePermission } from "@/lib/authz/admin-route-permissions";
import type { AdminRoutePermissionRequirement } from "@/lib/authz/admin-route-permissions";

// ── helpers ───────────────────────────────────────────────────────────────────

function check(entity: string, action: string, scope: string) {
  return { entity, action, scope };
}

// ── non-admin / unknown paths → null ─────────────────────────────────────────

describe("resolveAdminRoutePermission — null for non-admin paths", () => {
  it("returns null for empty string", () => {
    expect(resolveAdminRoutePermission("")).toBeNull();
  });

  it("returns null for root path", () => {
    expect(resolveAdminRoutePermission("/")).toBeNull();
  });

  it("returns null for non-admin path", () => {
    expect(resolveAdminRoutePermission("/individuals")).toBeNull();
    expect(resolveAdminRoutePermission("/settings")).toBeNull();
  });

  it("returns null for /admin alone (no section)", () => {
    expect(resolveAdminRoutePermission("/admin")).toBeNull();
    expect(resolveAdminRoutePermission("/admin/")).toBeNull();
  });

  it("returns null for unknown section", () => {
    expect(resolveAdminRoutePermission("/admin/unknown-section")).toBeNull();
    expect(resolveAdminRoutePermission("/admin/foobar/new")).toBeNull();
  });
});

// ── path normalisation ────────────────────────────────────────────────────────

describe("resolveAdminRoutePermission — path normalisation", () => {
  it("strips trailing slash", () => {
    const withSlash = resolveAdminRoutePermission("/admin/individuals/");
    const without = resolveAdminRoutePermission("/admin/individuals");
    expect(withSlash).toEqual(without);
  });

  it("strips query string before matching", () => {
    const withQuery = resolveAdminRoutePermission("/admin/individuals?page=2&q=smith");
    const clean = resolveAdminRoutePermission("/admin/individuals");
    expect(withQuery).toEqual(clean);
  });

  it("trims whitespace around the path", () => {
    const trimmed = resolveAdminRoutePermission("  /admin/individuals  ");
    expect(trimmed).toEqual(resolveAdminRoutePermission("/admin/individuals"));
  });
});

// ── special GEDCOM routes ─────────────────────────────────────────────────────

describe("resolveAdminRoutePermission — special GEDCOM routes", () => {
  it("/admin/gedcom/export → gedcom.export.gedcom (mode:all)", () => {
    expect(resolveAdminRoutePermission("/admin/gedcom/export")).toEqual<AdminRoutePermissionRequirement>({
      mode: "all",
      checks: [check("gedcom", "export", "gedcom")],
    });
  });

  it("/admin/merge-records → gedcom.merge_records.gedcom (mode:all)", () => {
    expect(resolveAdminRoutePermission("/admin/merge-records")).toEqual<AdminRoutePermissionRequirement>({
      mode: "all",
      checks: [check("gedcom", "merge_records", "gedcom")],
    });
  });

  it("/admin/gedcom/validator → any of validate_external or validate_tree (mode:any)", () => {
    expect(resolveAdminRoutePermission("/admin/gedcom/validator")).toEqual<AdminRoutePermissionRequirement>({
      mode: "any",
      checks: [
        check("gedcom", "validate_external", "gedcom"),
        check("gedcom", "validate_tree", "gedcom"),
      ],
    });
  });
});

// ── standard tree-scoped sections ────────────────────────────────────────────

describe("resolveAdminRoutePermission — standard tree-scoped list pages", () => {
  const cases: [string, string, string][] = [
    ["/admin/individuals", "individual", "tree"],
    ["/admin/families", "family", "tree"],
    ["/admin/events", "event", "tree"],
    ["/admin/places", "place", "tree"],
    ["/admin/notes", "note", "tree"],
    ["/admin/sources", "source", "tree"],
    ["/admin/relationship-types", "individual", "tree"],
    ["/admin/open-questions", "openQuestion", "tree"],
    ["/admin/dates", "date", "tree"],
    ["/admin/given-names", "givenName", "tree"],
    ["/admin/surnames", "lastName", "tree"],
    ["/admin/users", "user", "tree"],
    ["/admin/permissions", "permission", "tree"],
    ["/admin/changelog", "changelog", "tree"],
  ];

  for (const [path, entity, scope] of cases) {
    it(`${path} → ${entity}.read.${scope} (mode:all)`, () => {
      expect(resolveAdminRoutePermission(path)).toEqual({
        mode: "all",
        checks: [check(entity, "read", scope)],
      });
    });
  }
});

describe("resolveAdminRoutePermission — standard sections: /new and /edit suffixes", () => {
  it("/admin/individuals/new → individual.create.tree", () => {
    expect(resolveAdminRoutePermission("/admin/individuals/new")).toEqual({
      mode: "all",
      checks: [check("individual", "create", "tree")],
    });
  });

  it("/admin/individuals/[id]/edit → individual.update.tree", () => {
    expect(resolveAdminRoutePermission("/admin/individuals/i-123/edit")).toEqual({
      mode: "all",
      checks: [check("individual", "update", "tree")],
    });
  });

  it("/admin/families/new → family.create.tree", () => {
    expect(resolveAdminRoutePermission("/admin/families/new")).toEqual({
      mode: "all",
      checks: [check("family", "create", "tree")],
    });
  });

  it("/admin/events/[id]/edit → event.update.tree", () => {
    expect(resolveAdminRoutePermission("/admin/events/e-456/edit")).toEqual({
      mode: "all",
      checks: [check("event", "update", "tree")],
    });
  });
});

// ── roles: special /[id] edit route (no /edit suffix) ───────────────────────

describe("resolveAdminRoutePermission — roles section", () => {
  it("/admin/roles → role.read.tree", () => {
    expect(resolveAdminRoutePermission("/admin/roles")).toEqual({
      mode: "all",
      checks: [check("role", "read", "tree")],
    });
  });

  it("/admin/roles/new → role.create.tree", () => {
    expect(resolveAdminRoutePermission("/admin/roles/new")).toEqual({
      mode: "all",
      checks: [check("role", "create", "tree")],
    });
  });

  it("/admin/roles/[id] (no /edit) → role.update.tree", () => {
    expect(resolveAdminRoutePermission("/admin/roles/role-id-123")).toEqual({
      mode: "all",
      checks: [check("role", "update", "tree")],
    });
  });
});

// ── messages: user-scoped but NOT other-user-scoped ──────────────────────────

describe("resolveAdminRoutePermission — messages (user scope, mode:all)", () => {
  it("/admin/messages → message.read.user (mode:all)", () => {
    expect(resolveAdminRoutePermission("/admin/messages")).toEqual({
      mode: "all",
      checks: [check("message", "read", "user")],
    });
  });

  it("/admin/messages/new → message.create.user", () => {
    expect(resolveAdminRoutePermission("/admin/messages/new")).toEqual({
      mode: "all",
      checks: [check("message", "create", "user")],
    });
  });
});

// ── other-user-scoped entities: media, tag, album, story ────────────────────

describe("resolveAdminRoutePermission — other-user-scoped entities (mode:any, multi-scope)", () => {
  const entities = [
    { section: "media", entity: "media" },
    { section: "tags", entity: "tag" },
    { section: "albums", entity: "album" },
    { section: "stories", entity: "story" },
  ];

  for (const { section, entity } of entities) {
    describe(`/admin/${section}`, () => {
      it(`list page → any of [tree, user, other_users].read`, () => {
        expect(resolveAdminRoutePermission(`/admin/${section}`)).toEqual({
          mode: "any",
          checks: [
            check(entity, "read", "tree"),
            check(entity, "read", "user"),
            check(entity, "read", "other_users"),
          ],
        });
      });

      it(`/new → any of [tree, user].create`, () => {
        expect(resolveAdminRoutePermission(`/admin/${section}/new`)).toEqual({
          mode: "any",
          checks: [
            check(entity, "create", "tree"),
            check(entity, "create", "user"),
          ],
        });
      });

      it(`/[id]/edit → any of [tree, user, other_users].update`, () => {
        expect(resolveAdminRoutePermission(`/admin/${section}/item-123/edit`)).toEqual({
          mode: "any",
          checks: [
            check(entity, "update", "tree"),
            check(entity, "update", "user"),
            check(entity, "update", "other_users"),
          ],
        });
      });
    });
  }
});

// ── deeply nested paths use last segment for action detection ────────────────

describe("resolveAdminRoutePermission — deeply nested paths", () => {
  it("deep path ending in /edit is treated as update", () => {
    expect(resolveAdminRoutePermission("/admin/individuals/i-1/names/n-1/edit")).toEqual({
      mode: "all",
      checks: [check("individual", "update", "tree")],
    });
  });

  it("deep path NOT ending in /new or /edit is treated as read", () => {
    expect(resolveAdminRoutePermission("/admin/individuals/i-1/detail")).toEqual({
      mode: "all",
      checks: [check("individual", "read", "tree")],
    });
  });
});
