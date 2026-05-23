import { describe, it, expect } from "vitest";
import {
  parseSexParam,
  parseLivingParam,
  hasStructuredFilters,
  adminIndividualsFilterConditions,
  adminIndividualsWhereSql,
  type AdminIndividualsStructuredFilters,
} from "@/lib/admin/admin-individuals-filter-sql";

// ── parseSexParam ─────────────────────────────────────────────────────────────

describe("parseSexParam", () => {
  it("returns null for null", () => expect(parseSexParam(null)).toBeNull());
  it("returns null for empty string", () => expect(parseSexParam("")).toBeNull());
  it("returns null for unrecognised sex", () => expect(parseSexParam("Z")).toBeNull());

  it("accepts M", () => expect(parseSexParam("M")).toBe("M"));
  it("accepts F", () => expect(parseSexParam("F")).toBe("F"));
  it("accepts U", () => expect(parseSexParam("U")).toBe("U"));
  it("accepts X", () => expect(parseSexParam("X")).toBe("X"));

  it("uppercases lowercase input", () => {
    expect(parseSexParam("m")).toBe("M");
    expect(parseSexParam("f")).toBe("F");
  });
});

// ── parseLivingParam ──────────────────────────────────────────────────────────

describe("parseLivingParam", () => {
  it("returns null when param is absent", () => {
    expect(parseLivingParam(new URLSearchParams())).toBeNull();
  });

  it("returns true for value 'true'", () => {
    expect(parseLivingParam(new URLSearchParams("living=true"))).toBe(true);
  });

  it("returns false for value 'false'", () => {
    expect(parseLivingParam(new URLSearchParams("living=false"))).toBe(false);
  });

  it("returns null for ambiguous value", () => {
    expect(parseLivingParam(new URLSearchParams("living=maybe"))).toBeNull();
    expect(parseLivingParam(new URLSearchParams("living="))).toBeNull();
  });
});

// ── hasStructuredFilters ──────────────────────────────────────────────────────

const emptyFilters: AdminIndividualsStructuredFilters = {
  sex: null,
  isLiving: null,
  givenContains: null,
  lastNamePrefix: null,
  birthYearMin: null,
  birthYearMax: null,
  deathYearMin: null,
  deathYearMax: null,
};

describe("hasStructuredFilters", () => {
  it("returns false for all-null filters", () => {
    expect(hasStructuredFilters(emptyFilters)).toBe(false);
  });

  it("returns true when sex is set", () => {
    expect(hasStructuredFilters({ ...emptyFilters, sex: "M" })).toBe(true);
  });

  it("returns true when isLiving is set (false counts)", () => {
    expect(hasStructuredFilters({ ...emptyFilters, isLiving: false })).toBe(true);
  });

  it("returns true when givenContains is set", () => {
    expect(hasStructuredFilters({ ...emptyFilters, givenContains: "maria" })).toBe(true);
  });

  it("returns true when lastNamePrefix is set", () => {
    expect(hasStructuredFilters({ ...emptyFilters, lastNamePrefix: "gons" })).toBe(true);
  });

  it("returns true when any year bound is set", () => {
    expect(hasStructuredFilters({ ...emptyFilters, birthYearMin: 1900 })).toBe(true);
    expect(hasStructuredFilters({ ...emptyFilters, birthYearMax: 2000 })).toBe(true);
    expect(hasStructuredFilters({ ...emptyFilters, deathYearMin: 1950 })).toBe(true);
    expect(hasStructuredFilters({ ...emptyFilters, deathYearMax: 2020 })).toBe(true);
  });
});

// ── adminIndividualsFilterConditions ─────────────────────────────────────────
//
// Strategy: serialise each Prisma.Sql fragment via .sql (parameterised template)
// and .values (bound params array). This avoids running SQL but gives precise
// assertions about what will be sent to the database.

const FILE_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function conditions(
  filters: Partial<AdminIndividualsStructuredFilters> = {},
  q: string | null = null
) {
  return adminIndividualsFilterConditions(FILE_UUID, { ...emptyFilters, ...filters }, q);
}

describe("adminIndividualsFilterConditions — always includes file_uuid", () => {
  it("first condition is the file_uuid guard", () => {
    const [first] = conditions();
    expect(first.sql).toContain("file_uuid");
    expect(first.values).toContain(FILE_UUID);
  });

  it("empty filters produce exactly one condition (file_uuid only)", () => {
    expect(conditions()).toHaveLength(1);
  });
});

describe("adminIndividualsFilterConditions — sex filter", () => {
  it("adds a sex condition when sex is set", () => {
    const parts = conditions({ sex: "M" });
    expect(parts).toHaveLength(2);
    const sexPart = parts[1];
    expect(sexPart.sql).toContain("sex");
    expect(sexPart.values).toContain("M");
  });

  it("does not add sex condition when sex is null", () => {
    expect(conditions({ sex: null })).toHaveLength(1);
  });
});

describe("adminIndividualsFilterConditions — living filter", () => {
  it("adds an is_living condition when isLiving=true", () => {
    const parts = conditions({ isLiving: true });
    expect(parts).toHaveLength(2);
    const part = parts[1];
    expect(part.sql).toContain("is_living");
    expect(part.values).toContain(true);
  });

  it("adds an is_living condition when isLiving=false", () => {
    const parts = conditions({ isLiving: false });
    const part = parts[1];
    expect(part.sql).toContain("is_living");
    expect(part.values).toContain(false);
  });

  it("does not add is_living condition when isLiving=null", () => {
    expect(conditions({ isLiving: null })).toHaveLength(1);
  });
});

describe("adminIndividualsFilterConditions — year range filters", () => {
  it("adds birth_year >= condition for birthYearMin", () => {
    const parts = conditions({ birthYearMin: 1900 });
    const part = parts[1];
    expect(part.sql).toContain("birth_year");
    expect(part.sql).toContain(">=");
    expect(part.values).toContain(1900);
  });

  it("adds birth_year <= condition for birthYearMax", () => {
    const parts = conditions({ birthYearMax: 1980 });
    const part = parts[1];
    expect(part.sql).toContain("birth_year");
    expect(part.sql).toContain("<=");
    expect(part.values).toContain(1980);
  });

  it("adds death_year >= condition for deathYearMin", () => {
    const parts = conditions({ deathYearMin: 1950 });
    const part = parts[1];
    expect(part.sql).toContain("death_year");
    expect(part.sql).toContain(">=");
    expect(part.values).toContain(1950);
  });

  it("adds death_year <= condition for deathYearMax", () => {
    const parts = conditions({ deathYearMax: 2020 });
    const part = parts[1];
    expect(part.sql).toContain("death_year");
    expect(part.sql).toContain("<=");
    expect(part.values).toContain(2020);
  });

  it("adding both min and max produces two extra conditions", () => {
    const parts = conditions({ birthYearMin: 1900, birthYearMax: 1980 });
    expect(parts).toHaveLength(3);
  });
});

describe("adminIndividualsFilterConditions — name filters", () => {
  it("adds a condition when givenContains is set", () => {
    const parts = conditions({ givenContains: "maria" });
    expect(parts.length).toBeGreaterThan(1);
  });

  it("adds a condition when lastNamePrefix is set", () => {
    const parts = conditions({ lastNamePrefix: "gons" });
    expect(parts.length).toBeGreaterThan(1);
  });
});

describe("adminIndividualsFilterConditions — legacy q query", () => {
  it("adds conditions when q is a single token", () => {
    const parts = conditions({}, "Maria");
    expect(parts.length).toBeGreaterThan(1);
  });

  it("adds conditions when q has two tokens (given + surname)", () => {
    const parts = conditions({}, "Maria Gonsalves");
    // Should produce at least two extra conditions: given prefix LIKE + surname regex
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });

  it("does not add conditions when q is empty", () => {
    const parts = conditions({}, "");
    expect(parts).toHaveLength(1);
  });

  it("does not add conditions when q is whitespace only", () => {
    const parts = conditions({}, "   ");
    expect(parts).toHaveLength(1);
  });
});

describe("adminIndividualsFilterConditions — combinations", () => {
  it("sex + isLiving + birthYearMin produces four conditions total", () => {
    const parts = conditions({ sex: "F", isLiving: true, birthYearMin: 1950 });
    expect(parts).toHaveLength(4); // file_uuid + sex + isLiving + birthYearMin
  });
});

// ── adminIndividualsWhereSql ──────────────────────────────────────────────────

describe("adminIndividualsWhereSql", () => {
  it("returns an object with sql and values properties", () => {
    const sql = adminIndividualsWhereSql(conditions());
    expect(sql).toHaveProperty("sql");
    expect(sql).toHaveProperty("values");
  });

  it("joins multiple conditions with AND", () => {
    const parts = conditions({ sex: "M", isLiving: true });
    const sql = adminIndividualsWhereSql(parts);
    expect(sql.sql).toContain("AND");
  });
});
