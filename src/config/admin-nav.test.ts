import { describe, it, expect } from "vitest";
import { isAdminNavActive } from "./admin-nav";

describe("isAdminNavActive", () => {
  // ── Dashboard (/admin) is exact-match only ──────────────────────────────────

  it("activates /admin when pathname is exactly /admin", () => {
    expect(isAdminNavActive("/admin", "/admin")).toBe(true);
  });

  it("does NOT activate /admin when pathname is a sub-route", () => {
    expect(isAdminNavActive("/admin", "/admin/individuals")).toBe(false);
  });

  it("does NOT activate /admin when pathname is /admin/settings", () => {
    expect(isAdminNavActive("/admin", "/admin/settings")).toBe(false);
  });

  // ── Exact match ─────────────────────────────────────────────────────────────

  it("activates on exact pathname match", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/individuals")).toBe(true);
  });

  it("activates on exact match for a deeply nested href", () => {
    expect(isAdminNavActive("/admin/gedcom/export", "/admin/gedcom/export")).toBe(true);
  });

  // ── Prefix match (sub-routes) ────────────────────────────────────────────────

  it("activates when pathname is a direct child of href", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/individuals/123")).toBe(true);
  });

  it("activates when pathname is a deeply nested child of href", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/individuals/123/edit")).toBe(true);
  });

  it("activates /admin/cron for a sub-path", () => {
    expect(isAdminNavActive("/admin/cron", "/admin/cron/branch-detection")).toBe(true);
  });

  // ── Near-prefix must NOT match ───────────────────────────────────────────────

  it("does NOT activate when pathname shares a prefix but lacks a slash separator", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/individuals-extra")).toBe(false);
  });

  it("does NOT activate /admin/settings for /admin/site-settings", () => {
    expect(isAdminNavActive("/admin/settings", "/admin/site-settings")).toBe(false);
  });

  it("does NOT activate /admin/cron for /admin/cron-test", () => {
    expect(isAdminNavActive("/admin/cron", "/admin/cron-test")).toBe(false);
  });

  // ── Unrelated paths ──────────────────────────────────────────────────────────

  it("does NOT activate when pathname is completely unrelated", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/families")).toBe(false);
  });

  it("does NOT activate when pathname is a sibling route", () => {
    expect(isAdminNavActive("/admin/media", "/admin/timelines")).toBe(false);
  });

  // ── Trailing slash normalisation ─────────────────────────────────────────────

  it("strips trailing slash from href before comparing", () => {
    expect(isAdminNavActive("/admin/individuals/", "/admin/individuals")).toBe(true);
  });

  it("strips trailing slash from pathname before comparing", () => {
    expect(isAdminNavActive("/admin/individuals", "/admin/individuals/")).toBe(true);
  });

  it("handles both having trailing slashes", () => {
    expect(isAdminNavActive("/admin/individuals/", "/admin/individuals/")).toBe(true);
  });

  it("dashboard with trailing slash on pathname still matches exactly", () => {
    expect(isAdminNavActive("/admin", "/admin/")).toBe(true);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it("handles root / href and pathname", () => {
    expect(isAdminNavActive("/", "/")).toBe(true);
  });

  it("does NOT activate root / for a non-root pathname", () => {
    expect(isAdminNavActive("/", "/admin")).toBe(false);
  });
});
