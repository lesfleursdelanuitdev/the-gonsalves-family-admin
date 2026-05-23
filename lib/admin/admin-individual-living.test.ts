import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeIsLiving,
  deathKnownFromIndividualSnapshot,
} from "@/lib/admin/admin-individual-living";

// ── deathKnownFromIndividualSnapshot ─────────────────────────────────────────

describe("deathKnownFromIndividualSnapshot", () => {
  it("returns true when deathDateId is set", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: "date-1", deathYear: null })).toBe(true);
  });

  it("returns true when deathYear is a finite number", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: null, deathYear: 1980 })).toBe(true);
  });

  it("returns true when both are set", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: "date-1", deathYear: 1980 })).toBe(true);
  });

  it("returns false when both are null", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: null, deathYear: null })).toBe(false);
  });

  it("returns false when deathYear is undefined", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: undefined, deathYear: undefined })).toBe(false);
  });

  it("returns false when deathYear is NaN", () => {
    expect(deathKnownFromIndividualSnapshot({ deathDateId: null, deathYear: NaN })).toBe(false);
  });
});

// ── computeIsLiving: explicit modes ──────────────────────────────────────────

describe("computeIsLiving — explicit modes", () => {
  it("mode=living returns true regardless of death signal", () => {
    expect(
      computeIsLiving({ livingMode: "living", deathKnown: true, birthYear: 1900, birthMonth: 1, birthDay: 1 })
    ).toBe(true);
  });

  it("mode=living returns true with no birth data", () => {
    expect(
      computeIsLiving({ livingMode: "living", deathKnown: false, birthYear: null, birthMonth: null, birthDay: null })
    ).toBe(true);
  });

  it("mode=deceased returns false regardless of birth data", () => {
    expect(
      computeIsLiving({ livingMode: "deceased", deathKnown: false, birthYear: 2010, birthMonth: null, birthDay: null })
    ).toBe(false);
  });

  it("mode=deceased returns false regardless of death signal", () => {
    expect(
      computeIsLiving({ livingMode: "deceased", deathKnown: true, birthYear: null, birthMonth: null, birthDay: null })
    ).toBe(false);
  });
});

// ── computeIsLiving: auto mode ────────────────────────────────────────────────

describe("computeIsLiving — auto mode, death signal", () => {
  it("deathKnown=true → false", () => {
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: true, birthYear: 1990, birthMonth: null, birthDay: null })
    ).toBe(false);
  });
});

describe("computeIsLiving — auto mode, no death, no birth", () => {
  it("no birth data → true (assume living)", () => {
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: null, birthMonth: null, birthDay: null })
    ).toBe(true);
  });

  it("non-finite birthYear → true", () => {
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: NaN, birthMonth: null, birthDay: null })
    ).toBe(true);
  });
});

// ── computeIsLiving: auto mode, year-only birth ───────────────────────────────

describe("computeIsLiving — auto mode, birth year only", () => {
  // Pin today so tests don't drift. Use vi.setSystemTime.
  const REF_YEAR = 2025;

  afterEach(() => vi.useRealTimers());

  function withYear(y: number): boolean {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${REF_YEAR}-06-15`));
    return computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: y, birthMonth: null, birthDay: null });
  }

  it("birth year 119 years ago → living", () => {
    expect(withYear(REF_YEAR - 119)).toBe(true);
  });

  it("birth year exactly 120 years ago → not living", () => {
    expect(withYear(REF_YEAR - 120)).toBe(false);
  });

  it("birth year 150 years ago → not living", () => {
    expect(withYear(REF_YEAR - 150)).toBe(false);
  });

  it("birth year in the future → living (age < 120)", () => {
    expect(withYear(REF_YEAR + 1)).toBe(true);
  });
});

// ── computeIsLiving: auto mode, year+month birth ─────────────────────────────

describe("computeIsLiving — auto mode, birth year+month", () => {
  afterEach(() => vi.useRealTimers());

  it("born 119 years and 1 month ago → living", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15"));
    // born May 2025 - 119 years = May 1906
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: 1906, birthMonth: 5, birthDay: null })
    ).toBe(true);
  });

  it("born exactly 120 years ago (year+month boundary) → not living", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15"));
    // born June 1905 → 120 years completed this month → not living
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: 1905, birthMonth: 6, birthDay: null })
    ).toBe(false);
  });
});

// ── computeIsLiving: auto mode, exact birth date ──────────────────────────────

describe("computeIsLiving — auto mode, exact birth date", () => {
  afterEach(() => vi.useRealTimers());

  it("birthday is today (120th) → not living (age has been reached)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15"));
    // Born exactly 120 years ago today → ageCompletedYears = 120 → not living
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: 1905, birthMonth: 6, birthDay: 15 })
    ).toBe(false);
  });

  it("birthday is tomorrow (still 119) → living", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-14"));
    // Born June 15 1905 — birthday hasn't come yet today, so age is 119
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: 1905, birthMonth: 6, birthDay: 15 })
    ).toBe(true);
  });

  it("born 50 years ago → living", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01"));
    expect(
      computeIsLiving({ livingMode: "auto", deathKnown: false, birthYear: 1975, birthMonth: 1, birthDay: 1 })
    ).toBe(true);
  });
});
