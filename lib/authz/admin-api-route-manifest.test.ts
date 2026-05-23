import { describe, it, expect } from "vitest";
import { ADMIN_API_ROUTE_MANIFEST, type RouteManifestEntry } from "./admin-api-route-manifest";

describe("ADMIN_API_ROUTE_MANIFEST", () => {
  it("has no duplicate route patterns", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of ADMIN_API_ROUTE_MANIFEST) {
      if (seen.has(entry.pattern)) {
        duplicates.push(entry.pattern);
      }
      seen.add(entry.pattern);
    }
    expect(duplicates).toEqual([]);
  });

  it("every entry has at least one method", () => {
    const bad = ADMIN_API_ROUTE_MANIFEST.filter((e) => !e.methods.length);
    expect(bad.map((e) => e.pattern)).toEqual([]);
  });

  it("every requireCan entry has entity, action, and scope", () => {
    const bad: string[] = [];
    for (const entry of ADMIN_API_ROUTE_MANIFEST) {
      if (entry.permission.kind !== "requireCan") continue;
      const { entity, action, scope } = entry.permission;
      if (!entity || !action || !scope) {
        bad.push(entry.pattern);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every authOnly entry has a documented reason", () => {
    const bad = ADMIN_API_ROUTE_MANIFEST.filter(
      (e) => e.permission.kind === "authOnly" && !(e.permission as { reason?: string }).reason?.trim(),
    );
    expect(bad.map((e) => e.pattern)).toEqual([]);
  });

  it("destructive endpoints (batch, delete, discard) do not use authOnly", () => {
    const destructivePatterns = ADMIN_API_ROUTE_MANIFEST.filter((e) => {
      const hasDestructiveMethod = e.methods.includes("DELETE") || e.methods.includes("POST");
      const isDestructivePattern = e.pattern.includes("batch") || e.pattern.includes("discard");
      return hasDestructiveMethod && isDestructivePattern;
    });

    const authOnly = destructivePatterns.filter((e) => e.permission.kind === "authOnly");
    expect(authOnly.map((e) => e.pattern)).toEqual([]);
  });

  it("site-health batch route requires delete permission", () => {
    const batchEntry = ADMIN_API_ROUTE_MANIFEST.find(
      (e) => e.pattern === "site-health/checks/:checkKey/batch",
    );
    expect(batchEntry).toBeDefined();
    expect(batchEntry!.permission.kind).toBe("requireCan");
    if (batchEntry!.permission.kind === "requireCan") {
      expect(batchEntry!.permission.action).toBe("delete");
    }
  });

  it("export/bundle route requires export permission", () => {
    const entry = ADMIN_API_ROUTE_MANIFEST.find((e) => e.pattern === "export/bundle");
    expect(entry).toBeDefined();
    expect(entry!.permission.kind).toBe("requireCan");
    if (entry!.permission.kind === "requireCan") {
      expect(entry!.permission.action).toBe("export");
      expect(entry!.permission.scope).toBe("gedcom");
    }
  });

  it("merge-records routes require merge_records permission", () => {
    const mergePatterns = ADMIN_API_ROUTE_MANIFEST.filter((e) =>
      e.pattern.startsWith("merge-records/"),
    );
    expect(mergePatterns.length).toBeGreaterThan(0);
    for (const entry of mergePatterns) {
      expect(entry.permission.kind).toBe("requireCan");
      if (entry.permission.kind === "requireCan") {
        expect(entry.permission.action).toBe("merge_records");
      }
    }
  });

  it("setup route requires website owner", () => {
    const entry = ADMIN_API_ROUTE_MANIFEST.find((e) => e.pattern === "setup");
    expect(entry).toBeDefined();
    expect(entry!.permission.kind).toBe("requireWebsiteOwner");
  });

  it("user-links route requires user read permission", () => {
    const entry = ADMIN_API_ROUTE_MANIFEST.find((e) => e.pattern === "individuals/:id/user-links");
    expect(entry).toBeDefined();
    expect(entry!.permission.kind).toBe("requireCan");
    if (entry!.permission.kind === "requireCan") {
      expect(entry!.permission.entity).toBe("user");
    }
  });
});
