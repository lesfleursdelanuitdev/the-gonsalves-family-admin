import { describe, it, expect } from "vitest";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";

describe("routeDynamicId", () => {
  it("returns the string id when params.id is a string", () => {
    expect(routeDynamicId({ id: "abc-123" })).toBe("abc-123");
  });

  it("trims whitespace from string id", () => {
    expect(routeDynamicId({ id: "  abc  " })).toBe("abc");
  });

  it("returns the first element when params.id is an array", () => {
    expect(routeDynamicId({ id: ["first", "second"] })).toBe("first");
  });

  it("trims whitespace from array id", () => {
    expect(routeDynamicId({ id: ["  abc  "] })).toBe("abc");
  });

  it("returns empty string for null params", () => {
    expect(routeDynamicId(null)).toBe("");
  });

  it("returns empty string for undefined params", () => {
    expect(routeDynamicId(undefined)).toBe("");
  });

  it("returns empty string when id is missing from params", () => {
    expect(routeDynamicId({})).toBe("");
  });

  it("returns empty string for an empty string id", () => {
    expect(routeDynamicId({ id: "" })).toBe("");
    expect(routeDynamicId({ id: "   " })).toBe("");
  });

  it("returns empty string for an empty array id", () => {
    expect(routeDynamicId({ id: [] })).toBe("");
  });
});
