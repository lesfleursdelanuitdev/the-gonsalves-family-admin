import { describe, it, expect } from "vitest";
import { CHECK_KEYS, getCheck } from "./checks";

describe("Site health check registry", () => {
  it("CHECK_KEYS contains all registered check keys", () => {
    expect(CHECK_KEYS.length).toBeGreaterThan(0);
    // Each key should be unique
    const unique = new Set(CHECK_KEYS);
    expect(unique.size).toBe(CHECK_KEYS.length);
  });

  it("every key in CHECK_KEYS resolves via getCheck()", () => {
    for (const key of CHECK_KEYS) {
      const check = getCheck(key);
      expect(check, `getCheck('${key}') should return a check`).toBeDefined();
      expect(check!.key).toBe(key);
    }
  });

  it("every check has a non-empty label and description", () => {
    for (const key of CHECK_KEYS) {
      const check = getCheck(key)!;
      expect(check.label.trim(), `${key}.label should not be empty`).not.toBe("");
      expect(check.description.trim(), `${key}.description should not be empty`).not.toBe("");
    }
  });

  it("every check has a valid category", () => {
    const validCategories = new Set(["data_integrity", "media", "community", "user_hygiene"]);
    for (const key of CHECK_KEYS) {
      const check = getCheck(key)!;
      expect(validCategories.has(check.category), `${key}.category '${check.category}' is not valid`).toBe(true);
    }
  });

  it("checks with batchAction=delete implement batch()", async () => {
    for (const key of CHECK_KEYS) {
      const check = getCheck(key)!;
      if (check.batchAction !== "delete") continue;
      // batch() without ids should throw (not silently succeed for delete-all).
      // Checks that require explicit ids throw rather than batch-delete everything.
      // We can't actually run the DB call, so just verify the function exists.
      expect(typeof check.batch).toBe("function");
    }
  });

  it("checks without batchAction have a no-op batch()", async () => {
    for (const key of CHECK_KEYS) {
      const check = getCheck(key)!;
      if (check.batchAction !== null) continue;
      // No-op batch should return 0 without any DB interaction.
      const result = await check.batch({
        treeId: "test",
        fileUuid: "test",
        suppressed: new Map(),
      });
      expect(result).toBe(0);
    }
  });

  it("no check label uses the word 'orphaned' (use 'unlinked' instead)", () => {
    for (const key of CHECK_KEYS) {
      const check = getCheck(key)!;
      expect(
        check.label.toLowerCase().includes("orphaned"),
        `${key} label should not use 'orphaned': "${check.label}"`,
      ).toBe(false);
    }
  });

  it("getCheck() returns undefined for unknown keys", () => {
    expect(getCheck("nonexistent_key_xyz")).toBeUndefined();
    expect(getCheck("")).toBeUndefined();
  });

  describe("media_broken_files batch requires explicit ids", () => {
    it("throws when ids not provided (prevents accidental delete-all)", async () => {
      const check = getCheck("media_broken_files")!;
      await expect(
        check.batch({ treeId: "test", fileUuid: "test", suppressed: new Map() }, undefined),
      ).rejects.toThrow("ids required");
    });
  });

  describe("site_media_broken_files batch requires explicit ids", () => {
    it("throws when ids not provided", async () => {
      const check = getCheck("site_media_broken_files")!;
      await expect(
        check.batch({ treeId: "test", fileUuid: "test", suppressed: new Map() }, undefined),
      ).rejects.toThrow("ids required");
    });
  });
});
