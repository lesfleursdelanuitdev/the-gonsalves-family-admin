import { describe, it, expect } from "vitest";
import { parseListParams } from "@/lib/admin/admin-list-params";

const MAX = 10_000; // ADMIN_LIST_MAX_LIMIT

describe("parseListParams — limit", () => {
  it("uses ADMIN_LIST_MAX_LIMIT when limit is absent", () => {
    expect(parseListParams(new URLSearchParams())).toMatchObject({ limit: MAX });
  });

  it("parses a valid limit", () => {
    expect(parseListParams(new URLSearchParams("limit=50"))).toMatchObject({ limit: 50 });
  });

  it("clamps negative limit at 1 minimum", () => {
    expect(parseListParams(new URLSearchParams("limit=-99"))).toMatchObject({ limit: 1 });
  });

  it("treats limit=0 as ADMIN_LIST_MAX_LIMIT (0 is falsy, falls through to default)", () => {
    expect(parseListParams(new URLSearchParams("limit=0"))).toMatchObject({ limit: MAX });
  });

  it("clamps limit at ADMIN_LIST_MAX_LIMIT maximum", () => {
    expect(parseListParams(new URLSearchParams("limit=99999"))).toMatchObject({ limit: MAX });
  });

  it("treats non-numeric limit as ADMIN_LIST_MAX_LIMIT", () => {
    expect(parseListParams(new URLSearchParams("limit=abc"))).toMatchObject({ limit: MAX });
  });

  it("treats empty limit as ADMIN_LIST_MAX_LIMIT", () => {
    expect(parseListParams(new URLSearchParams("limit="))).toMatchObject({ limit: MAX });
  });
});

describe("parseListParams — offset", () => {
  it("defaults offset to 0 when absent", () => {
    expect(parseListParams(new URLSearchParams())).toMatchObject({ offset: 0 });
  });

  it("parses a valid offset", () => {
    expect(parseListParams(new URLSearchParams("offset=100"))).toMatchObject({ offset: 100 });
  });

  it("clamps offset at 0 minimum", () => {
    expect(parseListParams(new URLSearchParams("offset=-5"))).toMatchObject({ offset: 0 });
  });

  it("treats non-numeric offset as 0", () => {
    expect(parseListParams(new URLSearchParams("offset=abc"))).toMatchObject({ offset: 0 });
  });
});

describe("parseListParams — combined", () => {
  it("parses limit and offset together", () => {
    const result = parseListParams(new URLSearchParams("limit=25&offset=50"));
    expect(result).toEqual({ limit: 25, offset: 50 });
  });
});
