import { describe, it, expect, vi } from "vitest";
import { GedcomDateType } from "@ligneous/prisma";
import {
  parseGedcomDateType,
  parseDateInput,
  parsePlaceInput,
  parseLinkIds,
  parseMediaIds,
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
} from "@/lib/admin/admin-event-create";

// ── parseGedcomDateType ───────────────────────────────────────────────────────

describe("parseGedcomDateType", () => {
  it("returns EXACT for non-string input", () => {
    expect(parseGedcomDateType(null)).toBe(GedcomDateType.EXACT);
    expect(parseGedcomDateType(42)).toBe(GedcomDateType.EXACT);
    expect(parseGedcomDateType(undefined)).toBe(GedcomDateType.EXACT);
  });

  it("returns EXACT for empty string", () => {
    expect(parseGedcomDateType("")).toBe(GedcomDateType.EXACT);
    expect(parseGedcomDateType("  ")).toBe(GedcomDateType.EXACT);
  });

  it("maps GEDCOM legacy tags to enum values", () => {
    expect(parseGedcomDateType("ABT")).toBe(GedcomDateType.ABOUT);
    expect(parseGedcomDateType("BEF")).toBe(GedcomDateType.BEFORE);
    expect(parseGedcomDateType("AFT")).toBe(GedcomDateType.AFTER);
    expect(parseGedcomDateType("BET")).toBe(GedcomDateType.BETWEEN);
    expect(parseGedcomDateType("CAL")).toBe(GedcomDateType.CALCULATED);
    expect(parseGedcomDateType("EST")).toBe(GedcomDateType.ESTIMATED);
  });

  it("maps legacy tags case-insensitively", () => {
    expect(parseGedcomDateType("abt")).toBe(GedcomDateType.ABOUT);
    expect(parseGedcomDateType("Bef")).toBe(GedcomDateType.BEFORE);
  });

  it("accepts direct enum string values", () => {
    expect(parseGedcomDateType("EXACT")).toBe(GedcomDateType.EXACT);
    expect(parseGedcomDateType("ABOUT")).toBe(GedcomDateType.ABOUT);
    expect(parseGedcomDateType("BEFORE")).toBe(GedcomDateType.BEFORE);
    expect(parseGedcomDateType("AFTER")).toBe(GedcomDateType.AFTER);
    expect(parseGedcomDateType("BETWEEN")).toBe(GedcomDateType.BETWEEN);
    expect(parseGedcomDateType("FROM_TO")).toBe(GedcomDateType.FROM_TO);
    expect(parseGedcomDateType("UNKNOWN")).toBe(GedcomDateType.UNKNOWN);
  });

  it("falls back to EXACT for unrecognised strings", () => {
    expect(parseGedcomDateType("GARBAGE")).toBe(GedcomDateType.EXACT);
    expect(parseGedcomDateType("circa")).toBe(GedcomDateType.EXACT);
  });
});

// ── parseDateInput ────────────────────────────────────────────────────────────

describe("parseDateInput", () => {
  it("returns null for null / undefined", () => {
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(parseDateInput("1950")).toBeNull();
    expect(parseDateInput(1950)).toBeNull();
  });

  it("returns null when EXACT type and no fields set (meaningless date)", () => {
    expect(parseDateInput({ dateType: "EXACT" })).toBeNull();
    expect(parseDateInput({})).toBeNull();
  });

  it("returns null when all numeric fields are empty strings", () => {
    expect(parseDateInput({ dateType: "EXACT", year: "", month: "", day: "" })).toBeNull();
  });

  it("parses a date with year", () => {
    const result = parseDateInput({ year: 1950 });
    expect(result).not.toBeNull();
    expect(result!.year).toBe(1950);
    expect(result!.dateType).toBe(GedcomDateType.EXACT);
  });

  it("parses a year given as a numeric string", () => {
    const result = parseDateInput({ year: "1950" });
    expect(result!.year).toBe(1950);
  });

  it("truncates decimal year values", () => {
    const result = parseDateInput({ year: 1950.9 });
    expect(result!.year).toBe(1950);
  });

  it("normalises legacy ABT to ABOUT", () => {
    const result = parseDateInput({ dateType: "ABT", year: 1900 });
    expect(result!.dateType).toBe(GedcomDateType.ABOUT);
  });

  it("non-EXACT type counts as meaningful even without numeric fields", () => {
    const result = parseDateInput({ dateType: "ABOUT" });
    expect(result).not.toBeNull();
    expect(result!.dateType).toBe(GedcomDateType.ABOUT);
  });

  it("original text counts as meaningful", () => {
    const result = parseDateInput({ original: "circa 1850" });
    expect(result).not.toBeNull();
    expect(result!.original).toBe("circa 1850");
  });

  it("defaults calendar to GREGORIAN when absent", () => {
    const result = parseDateInput({ year: 1800 });
    expect(result!.calendar).toBe("GREGORIAN");
  });

  it("preserves an explicit calendar value", () => {
    const result = parseDateInput({ year: 1800, calendar: "JULIAN" });
    expect(result!.calendar).toBe("JULIAN");
  });

  it("parses year+month+day correctly", () => {
    const result = parseDateInput({ year: 1950, month: 6, day: 15 });
    expect(result!.year).toBe(1950);
    expect(result!.month).toBe(6);
    expect(result!.day).toBe(15);
  });

  it("parses BETWEEN end-date fields", () => {
    const result = parseDateInput({ dateType: "BETWEEN", year: 1900, endYear: 1910 });
    expect(result!.endYear).toBe(1910);
  });

  it("null values for missing numeric fields", () => {
    const result = parseDateInput({ year: 1900 });
    expect(result!.month).toBeNull();
    expect(result!.day).toBeNull();
  });
});

// ── parsePlaceInput ───────────────────────────────────────────────────────────

describe("parsePlaceInput", () => {
  it("returns null for null / undefined", () => {
    expect(parsePlaceInput(null)).toBeNull();
    expect(parsePlaceInput(undefined)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(parsePlaceInput("Lisbon")).toBeNull();
  });

  it("returns null when all fields are empty", () => {
    expect(parsePlaceInput({})).toBeNull();
    expect(parsePlaceInput({ name: "", county: "", state: "", country: "" })).toBeNull();
  });

  it("parses when only name is provided", () => {
    const result = parsePlaceInput({ name: "Lisbon" });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Lisbon");
  });

  it("uses provided original text", () => {
    const result = parsePlaceInput({ original: "Lisbon, Portugal" });
    expect(result!.original).toBe("Lisbon, Portugal");
  });

  it("reconstructs original from parts when original is absent", () => {
    const result = parsePlaceInput({ name: "Lisbon", country: "Portugal" });
    expect(result!.original).toContain("Lisbon");
    expect(result!.original).toContain("Portugal");
  });

  it("parses coordinates into Decimal-compatible values", () => {
    const result = parsePlaceInput({ name: "Lisbon", latitude: "38.7169", longitude: "-9.1399" });
    expect(result).not.toBeNull();
    expect(result!.latitude).not.toBeNull();
    expect(result!.longitude).not.toBeNull();
  });

  it("returns null when only empty strings provided", () => {
    expect(parsePlaceInput({ name: "   " })).toBeNull();
  });

  it("parses state and country", () => {
    const result = parsePlaceInput({ state: "California", country: "USA" });
    expect(result!.state).toBe("California");
    expect(result!.country).toBe("USA");
  });
});

// ── parseLinkIds ──────────────────────────────────────────────────────────────

describe("parseLinkIds", () => {
  it("returns empty arrays for empty body", () => {
    expect(parseLinkIds({})).toEqual({ individualIds: [], familyIds: [] });
  });

  it("extracts links.individualIds array", () => {
    const result = parseLinkIds({ links: { individualIds: ["i1", "i2"] } });
    expect(result.individualIds).toEqual(["i1", "i2"]);
  });

  it("extracts links.familyIds array", () => {
    const result = parseLinkIds({ links: { familyIds: ["f1"] } });
    expect(result.familyIds).toEqual(["f1"]);
  });

  it("extracts legacy linkedIndividualId field", () => {
    const result = parseLinkIds({ linkedIndividualId: "i9" });
    expect(result.individualIds).toContain("i9");
  });

  it("extracts legacy linkedFamilyId field", () => {
    const result = parseLinkIds({ linkedFamilyId: "f9" });
    expect(result.familyIds).toContain("f9");
  });

  it("deduplicates ids from both sources", () => {
    const result = parseLinkIds({
      links: { individualIds: ["i1", "i1"] },
      linkedIndividualId: "i1",
    });
    expect(result.individualIds).toEqual(["i1"]);
  });

  it("filters out empty strings", () => {
    const result = parseLinkIds({ links: { individualIds: ["", "i1"] } });
    expect(result.individualIds).toEqual(["i1"]);
  });
});

// ── parseMediaIds ─────────────────────────────────────────────────────────────

describe("parseMediaIds", () => {
  it("returns empty array when mediaIds is absent", () => {
    expect(parseMediaIds({})).toEqual([]);
  });

  it("returns empty array when mediaIds is not an array", () => {
    expect(parseMediaIds({ mediaIds: "m1" })).toEqual([]);
  });

  it("returns media ids from array", () => {
    expect(parseMediaIds({ mediaIds: ["m1", "m2"] })).toEqual(["m1", "m2"]);
  });

  it("filters out empty strings and trims", () => {
    expect(parseMediaIds({ mediaIds: ["", "  ", "m1"] })).toEqual(["m1"]);
  });

  it("deduplicates ids", () => {
    expect(parseMediaIds({ mediaIds: ["m1", "m1", "m2"] })).toEqual(["m1", "m2"]);
  });
});

// ── findOrCreateGedcomDate ────────────────────────────────────────────────────

describe("findOrCreateGedcomDate", () => {
  function makeTx(findFirstResult: unknown) {
    return {
      gedcomDate: {
        findFirst: vi.fn().mockResolvedValue(findFirstResult),
        create: vi.fn().mockResolvedValue({ id: "new-date-id" }),
      },
    } as any;
  }

  const baseInput = {
    dateType: GedcomDateType.EXACT,
    original: null,
    calendar: "GREGORIAN",
    year: 1950,
    month: null,
    day: null,
    endYear: null,
    endMonth: null,
    endDay: null,
  };

  it("returns existing id when record found by hash", async () => {
    const tx = makeTx({ id: "existing-date-id" });
    const id = await findOrCreateGedcomDate(tx, "file-uuid", baseInput);
    expect(id).toBe("existing-date-id");
    expect(tx.gedcomDate.create).not.toHaveBeenCalled();
  });

  it("creates and returns new id when no record found", async () => {
    const tx = makeTx(null);
    const id = await findOrCreateGedcomDate(tx, "file-uuid", baseInput);
    expect(id).toBe("new-date-id");
    expect(tx.gedcomDate.create).toHaveBeenCalledOnce();
  });

  it("passes fileUuid to the findFirst query", async () => {
    const tx = makeTx({ id: "x" });
    await findOrCreateGedcomDate(tx, "my-file-uuid", baseInput);
    expect(tx.gedcomDate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fileUuid: "my-file-uuid" }) })
    );
  });
});

// ── findOrCreateGedcomPlace ───────────────────────────────────────────────────

describe("findOrCreateGedcomPlace", () => {
  function makeTx(findFirstResult: unknown) {
    return {
      gedcomPlace: {
        findFirst: vi.fn().mockResolvedValue(findFirstResult),
        create: vi.fn().mockResolvedValue({ id: "new-place-id" }),
      },
    } as any;
  }

  const baseInput = {
    original: "Lisbon, Portugal",
    name: "Lisbon",
    county: null,
    state: null,
    country: "Portugal",
    latitude: null,
    longitude: null,
  };

  it("returns existing id when found by hash", async () => {
    const tx = makeTx({ id: "existing-place-id" });
    const id = await findOrCreateGedcomPlace(tx, "file-uuid", baseInput);
    expect(id).toBe("existing-place-id");
    expect(tx.gedcomPlace.create).not.toHaveBeenCalled();
  });

  it("creates and returns new id when not found", async () => {
    const tx = makeTx(null);
    const id = await findOrCreateGedcomPlace(tx, "file-uuid", baseInput);
    expect(id).toBe("new-place-id");
    expect(tx.gedcomPlace.create).toHaveBeenCalledOnce();
  });

  it("passes fileUuid to findFirst", async () => {
    const tx = makeTx({ id: "x" });
    await findOrCreateGedcomPlace(tx, "my-file-uuid", baseInput);
    expect(tx.gedcomPlace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fileUuid: "my-file-uuid" }) })
    );
  });
});
