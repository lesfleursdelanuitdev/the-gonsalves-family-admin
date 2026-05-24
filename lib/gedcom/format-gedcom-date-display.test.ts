import { describe, it, expect } from "vitest";
import {
  isAboutDateType,
  isExactDateType,
  formatGedcomDateDisplayLabel,
  type GedcomDateDisplayInput,
} from "@ligneous/gedcom-dates";

// ── isAboutDateType ───────────────────────────────────────────────────────────

describe("isAboutDateType", () => {
  it("returns true for 'ABOUT'", () => expect(isAboutDateType("ABOUT")).toBe(true));
  it("returns true for 'ABT'", () => expect(isAboutDateType("ABT")).toBe(true));
  it("returns true for lowercase 'about'", () => expect(isAboutDateType("about")).toBe(true));
  it("returns true for lowercase 'abt'", () => expect(isAboutDateType("abt")).toBe(true));
  it("returns true for whitespace-padded 'ABT'", () => expect(isAboutDateType("  ABT  ")).toBe(true));
  it("returns false for 'EXACT'", () => expect(isAboutDateType("EXACT")).toBe(false));
  it("returns false for 'BEFORE'", () => expect(isAboutDateType("BEFORE")).toBe(false));
  it("returns false for null", () => expect(isAboutDateType(null)).toBe(false));
  it("returns false for undefined", () => expect(isAboutDateType(undefined)).toBe(false));
  it("returns false for empty string", () => expect(isAboutDateType("")).toBe(false));
});

// ── isExactDateType ───────────────────────────────────────────────────────────

describe("isExactDateType", () => {
  it("returns true for 'EXACT'", () => expect(isExactDateType("EXACT")).toBe(true));
  it("returns true for empty string", () => expect(isExactDateType("")).toBe(true));
  it("returns true for null (defaults to EXACT)", () => expect(isExactDateType(null)).toBe(true));
  it("returns true for undefined", () => expect(isExactDateType(undefined)).toBe(true));
  it("returns false for 'ABOUT'", () => expect(isExactDateType("ABOUT")).toBe(false));
  it("returns false for 'BEFORE'", () => expect(isExactDateType("BEFORE")).toBe(false));
});

// ── formatGedcomDateDisplayLabel ──────────────────────────────────────────────

describe("formatGedcomDateDisplayLabel — prefers original", () => {
  it("returns original as-is when set", () => {
    const row: GedcomDateDisplayInput = { original: "  1945  " };
    expect(formatGedcomDateDisplayLabel(row)).toBe("1945");
  });

  it("original takes precedence over structured parts", () => {
    const row: GedcomDateDisplayInput = {
      original: "27 MAR 1920",
      year: 1920,
      month: 3,
      day: 27,
      dateType: "EXACT",
    };
    expect(formatGedcomDateDisplayLabel(row)).toBe("27 MAR 1920");
  });

  it("strips leading EXACT: prefix from original string", () => {
    const row: GedcomDateDisplayInput = { original: "EXACT: 27 MAR 1920" };
    expect(formatGedcomDateDisplayLabel(row)).toBe("27 MAR 1920");
  });

  it("strips EXACT: prefix case-insensitively", () => {
    const row: GedcomDateDisplayInput = { original: "exact:1945" };
    expect(formatGedcomDateDisplayLabel(row)).toBe("1945");
  });
});

describe("formatGedcomDateDisplayLabel — structured EXACT dates", () => {
  it("year only → bare value (no EXACT prefix)", () => {
    expect(formatGedcomDateDisplayLabel({ year: 1990 })).toBe("1990");
  });

  it("year+month → bare value", () => {
    expect(formatGedcomDateDisplayLabel({ year: 1990, month: 3 })).toBe("1990-3");
  });

  it("year+month+day → bare value", () => {
    expect(formatGedcomDateDisplayLabel({ year: 1990, month: 3, day: 15 })).toBe("1990-3-15");
  });

  it("no parts at all → (no structured date)", () => {
    expect(formatGedcomDateDisplayLabel({})).toBe("(no structured date)");
  });

  it("explicit dateType EXACT renders bare (no prefix)", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "EXACT", year: 1900 })).toBe("1900");
  });

  it("EXACT range renders as start … end without prefix", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "EXACT", year: 1900, endYear: 1910 })).toBe("1900 … 1910");
  });
});

describe("formatGedcomDateDisplayLabel — ABOUT / tilde", () => {
  it("ABOUT type prepends tilde instead of 'ABOUT: '", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "ABOUT", year: 1945 })).toBe("~1945");
  });

  it("ABT type also prepends tilde", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "ABT", year: 1945 })).toBe("~1945");
  });

  it("ABOUT with no parts → ~(no structured date)", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "ABOUT" })).toBe("~(no structured date)");
  });
});

describe("formatGedcomDateDisplayLabel — range dates with end parts", () => {
  it("BETWEEN: start … end", () => {
    const row: GedcomDateDisplayInput = {
      dateType: "BETWEEN",
      year: 1900,
      endYear: 1910,
    };
    expect(formatGedcomDateDisplayLabel(row)).toBe("BETWEEN: 1900 … 1910");
  });

  it("ABOUT range uses tilde prefix for start … end", () => {
    const row: GedcomDateDisplayInput = {
      dateType: "ABOUT",
      year: 1900,
      endYear: 1910,
    };
    expect(formatGedcomDateDisplayLabel(row)).toBe("~1900 … 1910");
  });

  it("includes month and day in end range", () => {
    const row: GedcomDateDisplayInput = {
      dateType: "BETWEEN",
      year: 1900, month: 1,
      endYear: 1900, endMonth: 6, endDay: 30,
    };
    expect(formatGedcomDateDisplayLabel(row)).toBe("BETWEEN: 1900-1 … 1900-6-30");
  });
});

describe("formatGedcomDateDisplayLabel — other modifier types", () => {
  it("BEFORE type renders as prefix", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "BEFORE", year: 1950 })).toBe("BEFORE: 1950");
  });

  it("AFTER type renders as prefix", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "AFTER", year: 1950 })).toBe("AFTER: 1950");
  });

  it("CALCULATED type renders as prefix", () => {
    expect(formatGedcomDateDisplayLabel({ dateType: "CALCULATED", year: 1800 })).toBe("CALCULATED: 1800");
  });
});
