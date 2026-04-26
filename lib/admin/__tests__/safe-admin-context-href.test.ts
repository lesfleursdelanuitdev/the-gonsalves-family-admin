import { describe, expect, it } from "vitest";
import { safeAdminContextHref } from "@/lib/admin/safe-admin-context-href";

describe("safeAdminContextHref", () => {
  it("accepts trimmed admin-relative href", () => {
    expect(safeAdminContextHref("  /admin/media/new  ")).toBe("/admin/media/new");
  });

  it("rejects empty values", () => {
    expect(safeAdminContextHref(undefined)).toBeUndefined();
    expect(safeAdminContextHref("   ")).toBeUndefined();
  });

  it("rejects non-admin routes", () => {
    expect(safeAdminContextHref("/profile")).toBeUndefined();
  });

  it("rejects protocol-based urls", () => {
    expect(safeAdminContextHref("https://example.com/admin/media")).toBeUndefined();
    expect(safeAdminContextHref("/admin/https://evil.test")).toBeUndefined();
  });
});
