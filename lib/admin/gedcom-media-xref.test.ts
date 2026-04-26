import { describe, expect, it } from "vitest";

import { nextMediaXrefsAfterOccupied, parseMediaXrefNumber } from "./gedcom-media-xref";

describe("parseMediaXrefNumber", () => {
  it("parses canonical @Mn@", () => {
    expect(parseMediaXrefNumber("@M1@")).toBe(1);
    expect(parseMediaXrefNumber("@M18@")).toBe(18);
    expect(parseMediaXrefNumber("  @M42@  ")).toBe(42);
  });

  it("returns null for non-matching xrefs", () => {
    expect(parseMediaXrefNumber(null)).toBe(null);
    expect(parseMediaXrefNumber("")).toBe(null);
    expect(parseMediaXrefNumber("M1")).toBe(null);
    expect(parseMediaXrefNumber("@X1@")).toBe(null);
    expect(parseMediaXrefNumber("@M1")).toBe(null);
    expect(parseMediaXrefNumber("@Mab@")).toBe(null);
  });
});

describe("nextMediaXrefsAfterOccupied", () => {
  it("starts at @M1@ when nothing occupied", () => {
    expect(nextMediaXrefsAfterOccupied([], 3)).toEqual(["@M1@", "@M2@", "@M3@"]);
  });

  it("continues after max numeric @M…@", () => {
    expect(nextMediaXrefsAfterOccupied(["@M2@", "@M5@", "other"], 2)).toEqual(["@M6@", "@M7@"]);
  });

  it("skips integers already used (gaps)", () => {
    expect(nextMediaXrefsAfterOccupied(["@M1@", "@M3@"], 2)).toEqual(["@M4@", "@M5@"]);
  });
});
