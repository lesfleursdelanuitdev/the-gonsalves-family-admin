import { describe, it, expect } from "vitest";
import {
  hasAdminIndividualsFilterQueryKeys,
  parseAdminIndividualsFiltersFromSearchParams,
  mergeAdminIndividualsFilterDefaults,
  adminIndividualsFiltersToSearchParams,
  adminIndividualsPathWithFilters,
  adminIndividualsHrefForGivenName,
  adminIndividualsHrefForSurname,
  ADMIN_INDIVIDUALS_FILTER_DEFAULTS,
  type AdminIndividualsUrlFilterState,
} from "@/lib/admin/admin-individuals-url-filters";

// ── hasAdminIndividualsFilterQueryKeys ────────────────────────────────────────

describe("hasAdminIndividualsFilterQueryKeys", () => {
  it("returns false for empty search params", () => {
    expect(hasAdminIndividualsFilterQueryKeys(new URLSearchParams())).toBe(false);
  });

  it("returns true when 'q' is present", () => {
    expect(hasAdminIndividualsFilterQueryKeys(new URLSearchParams("q=maria"))).toBe(true);
  });

  it("returns true when 'sex' is present", () => {
    expect(hasAdminIndividualsFilterQueryKeys(new URLSearchParams("sex=F"))).toBe(true);
  });

  it("returns true when 'living' is present", () => {
    expect(hasAdminIndividualsFilterQueryKeys(new URLSearchParams("living=true"))).toBe(true);
  });

  it("returns false for unrelated query params", () => {
    expect(hasAdminIndividualsFilterQueryKeys(new URLSearchParams("page=2&sort=asc"))).toBe(false);
  });
});

// ── parseAdminIndividualsFiltersFromSearchParams ───────────────────────────────

describe("parseAdminIndividualsFiltersFromSearchParams — q", () => {
  it("passes through q value", () => {
    const result = parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("q=gonsalves"));
    expect(result.q).toBe("gonsalves");
  });

  it("does not include q when absent", () => {
    const result = parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams());
    expect(result).not.toHaveProperty("q");
  });
});

describe("parseAdminIndividualsFiltersFromSearchParams — sex", () => {
  it("uppercases valid GEDCOM sex codes", () => {
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("sex=f")).sex).toBe("F");
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("sex=m")).sex).toBe("M");
  });

  it("accepts M, F, U, X", () => {
    for (const sex of ["M", "F", "U", "X"]) {
      expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams(`sex=${sex}`)).sex).toBe(sex);
    }
  });

  it("ignores invalid sex values", () => {
    const result = parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("sex=Z"));
    expect(result).not.toHaveProperty("sex");
  });
});

describe("parseAdminIndividualsFiltersFromSearchParams — living", () => {
  it("accepts 'true'", () => {
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("living=true")).living).toBe("true");
  });

  it("accepts 'false'", () => {
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("living=false")).living).toBe("false");
  });

  it("ignores ambiguous values", () => {
    const result = parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("living=maybe"));
    expect(result).not.toHaveProperty("living");
  });

  it("does not include living when absent", () => {
    const result = parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams());
    expect(result).not.toHaveProperty("living");
  });
});

describe("parseAdminIndividualsFiltersFromSearchParams — year bounds", () => {
  it("parses birthYearMin", () => {
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("birthYearMin=1900")).birthYearMin).toBe("1900");
  });

  it("parses birthYearMax", () => {
    expect(parseAdminIndividualsFiltersFromSearchParams(new URLSearchParams("birthYearMax=1980")).birthYearMax).toBe("1980");
  });

  it("parses deathYearMin and deathYearMax", () => {
    const sp = new URLSearchParams("deathYearMin=1950&deathYearMax=2020");
    const r = parseAdminIndividualsFiltersFromSearchParams(sp);
    expect(r.deathYearMin).toBe("1950");
    expect(r.deathYearMax).toBe("2020");
  });
});

// ── mergeAdminIndividualsFilterDefaults ───────────────────────────────────────

describe("mergeAdminIndividualsFilterDefaults", () => {
  it("returns full state with defaults for empty partial", () => {
    const result = mergeAdminIndividualsFilterDefaults({});
    expect(result).toEqual(ADMIN_INDIVIDUALS_FILTER_DEFAULTS);
  });

  it("overrides specific fields", () => {
    const result = mergeAdminIndividualsFilterDefaults({ q: "alice", sex: "F" });
    expect(result.q).toBe("alice");
    expect(result.sex).toBe("F");
    expect(result.living).toBe("");
  });
});

// ── adminIndividualsFiltersToSearchParams ─────────────────────────────────────

describe("adminIndividualsFiltersToSearchParams", () => {
  const full: AdminIndividualsUrlFilterState = {
    q: "maria", sex: "F", living: "true",
    givenName: "Maria", lastName: "Gonsalves",
    birthYearMin: "1900", birthYearMax: "1950",
    deathYearMin: "1970", deathYearMax: "2000",
  };

  it("serializes all non-empty fields", () => {
    const sp = adminIndividualsFiltersToSearchParams(full);
    expect(sp.get("q")).toBe("maria");
    expect(sp.get("sex")).toBe("F");
    expect(sp.get("living")).toBe("true");
    expect(sp.get("givenName")).toBe("Maria");
    expect(sp.get("lastName")).toBe("Gonsalves");
    expect(sp.get("birthYearMin")).toBe("1900");
    expect(sp.get("birthYearMax")).toBe("1950");
    expect(sp.get("deathYearMin")).toBe("1970");
    expect(sp.get("deathYearMax")).toBe("2000");
  });

  it("omits empty fields", () => {
    const sp = adminIndividualsFiltersToSearchParams(ADMIN_INDIVIDUALS_FILTER_DEFAULTS);
    expect(sp.toString()).toBe("");
  });

  it("uppercases sex in output", () => {
    const sp = adminIndividualsFiltersToSearchParams({ ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS, sex: "f" });
    expect(sp.get("sex")).toBe("F");
  });

  it("trims whitespace from string fields", () => {
    const sp = adminIndividualsFiltersToSearchParams({ ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS, q: "  alice  " });
    expect(sp.get("q")).toBe("alice");
  });

  it("omits invalid living values", () => {
    const sp = adminIndividualsFiltersToSearchParams({ ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS, living: "maybe" });
    expect(sp.has("living")).toBe(false);
  });
});

// ── adminIndividualsPathWithFilters ───────────────────────────────────────────

describe("adminIndividualsPathWithFilters", () => {
  it("returns /admin/individuals for all-default filters", () => {
    expect(adminIndividualsPathWithFilters(ADMIN_INDIVIDUALS_FILTER_DEFAULTS)).toBe("/admin/individuals");
  });

  it("appends query string for non-default filters", () => {
    const path = adminIndividualsPathWithFilters({ ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS, sex: "M" });
    expect(path).toContain("/admin/individuals?");
    expect(path).toContain("sex=M");
  });
});

// ── deep links ────────────────────────────────────────────────────────────────

describe("adminIndividualsHrefForGivenName", () => {
  it("produces a link with givenName filter set", () => {
    const href = adminIndividualsHrefForGivenName("João");
    expect(href).toContain("givenName=Jo%C3%A3o");
  });

  it("only sets givenName (all other fields are defaults)", () => {
    const href = adminIndividualsHrefForGivenName("Ana");
    expect(href).not.toContain("sex=");
    expect(href).not.toContain("living=");
  });
});

describe("adminIndividualsHrefForSurname", () => {
  it("strips GEDCOM slashes from surname before encoding", () => {
    const href = adminIndividualsHrefForSurname("/Gonsalves/");
    expect(href).toContain("lastName=Gonsalves");
  });

  it("produces a link with lastName filter set", () => {
    const href = adminIndividualsHrefForSurname("Ferreira");
    expect(href).toContain("lastName=Ferreira");
  });
});
