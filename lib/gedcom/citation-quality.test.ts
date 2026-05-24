import { describe, it, expect } from "vitest";
import { quayLabel, quayBadgeClass, parseQuay, QUAY_OPTIONS, QUAY_LABELS } from "@/lib/gedcom/citation-quality";

describe("quayLabel", () => {
  it("returns correct label for each GEDCOM QUAY value", () => {
    expect(quayLabel(0)).toBe("Unreliable");
    expect(quayLabel(1)).toBe("Questionable");
    expect(quayLabel(2)).toBe("Secondary");
    expect(quayLabel(3)).toBe("Primary");
  });

  it("rounds float values to the nearest integer", () => {
    expect(quayLabel(2.6)).toBe("Primary");
    expect(quayLabel(1.4)).toBe("Questionable");
  });

  it("returns null for null or undefined", () => {
    expect(quayLabel(null)).toBeNull();
    expect(quayLabel(undefined)).toBeNull();
  });

  it("returns null for out-of-range values that have no label", () => {
    expect(quayLabel(99)).toBeNull();
    expect(quayLabel(-1)).toBeNull();
  });
});

describe("quayBadgeClass", () => {
  it("returns a non-empty class string for valid QUAY values", () => {
    for (const v of [0, 1, 2, 3] as const) {
      const cls = quayBadgeClass(v);
      expect(cls).toBeTruthy();
      expect(typeof cls).toBe("string");
    }
  });

  it("returns the muted fallback for null", () => {
    expect(quayBadgeClass(null)).toBe("bg-muted text-muted-foreground");
  });

  it("primary (3) gets a green-ish class", () => {
    expect(quayBadgeClass(3)).toContain("emerald");
  });

  it("unreliable (0) gets a red-ish class", () => {
    expect(quayBadgeClass(0)).toContain("red");
  });
});

describe("parseQuay", () => {
  it("parses valid integers 0–3", () => {
    expect(parseQuay(0)).toBe(0);
    expect(parseQuay(1)).toBe(1);
    expect(parseQuay(2)).toBe(2);
    expect(parseQuay(3)).toBe(3);
  });

  it("parses string representations", () => {
    expect(parseQuay("2")).toBe(2);
    expect(parseQuay("0")).toBe(0);
  });

  it("rounds floats to nearest valid integer", () => {
    expect(parseQuay(2.4)).toBe(2);
    expect(parseQuay(2.6)).toBe(3);
  });

  it("returns null for empty string", () => {
    expect(parseQuay("")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(parseQuay(null)).toBeNull();
    expect(parseQuay(undefined)).toBeNull();
  });

  it("returns null for values outside 0–3", () => {
    expect(parseQuay(4)).toBeNull();
    expect(parseQuay(-1)).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseQuay("high")).toBeNull();
  });
});

describe("QUAY_OPTIONS", () => {
  it("covers all four GEDCOM QUAY values", () => {
    const values = QUAY_OPTIONS.map((o) => o.value).sort();
    expect(values).toEqual([0, 1, 2, 3]);
  });

  it("highest quality is listed first", () => {
    expect(QUAY_OPTIONS[0].value).toBe(3);
  });

  it("each option label matches QUAY_LABELS", () => {
    for (const opt of QUAY_OPTIONS) {
      expect(opt.label).toBe(QUAY_LABELS[opt.value]);
    }
  });
});
