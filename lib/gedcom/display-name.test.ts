import { describe, it, expect } from "vitest";
import {
  stripSlashesFromName,
  formatDisplayNameFromNameForms,
  initialsFromPersonLabel,
  type NameFormForDisplay,
} from "@/lib/gedcom/display-name";

// ── stripSlashesFromName ──────────────────────────────────────────────────────

describe("stripSlashesFromName", () => {
  it("removes surrounding GEDCOM slashes from a surname", () => {
    expect(stripSlashesFromName("John /Gonsalves/")).toBe("John Gonsalves");
  });

  it("removes internal slashes", () => {
    expect(stripSlashesFromName("/Smith/")).toBe("Smith");
    expect(stripSlashesFromName("Mary /O'Brien/ Jones")).toBe("Mary O'Brien Jones");
  });

  it("collapses internal whitespace produced by slash removal", () => {
    // "/Smith/" → "Smith" after removing slashes; leading/trailing trimmed
    expect(stripSlashesFromName("  /  Smith  /  ")).toBe("Smith");
  });

  it("returns empty string for null", () => {
    expect(stripSlashesFromName(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(stripSlashesFromName(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(stripSlashesFromName("")).toBe("");
  });

  it("passes through a name with no slashes unchanged", () => {
    expect(stripSlashesFromName("Alice Ferreira")).toBe("Alice Ferreira");
  });
});

// ── formatDisplayNameFromNameForms ────────────────────────────────────────────

function makeForm(
  opts: {
    isPrimary?: boolean;
    sortOrder?: number;
    givenNames?: string[];
    surnames?: string[];
  } = {},
): NameFormForDisplay {
  return {
    isPrimary: opts.isPrimary ?? null,
    sortOrder: opts.sortOrder ?? null,
    givenNames: (opts.givenNames ?? []).map((g) => ({
      givenName: { givenName: g },
    })),
    surnames: (opts.surnames ?? []).map((s) => ({
      surname: { surname: s },
    })),
  };
}

describe("formatDisplayNameFromNameForms — null/empty forms", () => {
  it("falls back to stripped fullName when forms is null", () => {
    expect(formatDisplayNameFromNameForms(null, "John /Smith/")).toBe("John Smith");
  });

  it("falls back to stripped fullName when forms is empty array", () => {
    expect(formatDisplayNameFromNameForms([], "/Gonsalves/ Maria")).toBe("Gonsalves Maria");
  });

  it("returns empty string when forms is null and fullName is null", () => {
    expect(formatDisplayNameFromNameForms(null, null)).toBe("");
  });
});

describe("formatDisplayNameFromNameForms — primary form", () => {
  it("uses the isPrimary form when present", () => {
    const forms = [
      makeForm({ isPrimary: false, sortOrder: 0, givenNames: ["Wrong"], surnames: [] }),
      makeForm({ isPrimary: true, givenNames: ["Alice"], surnames: ["/Ferreira/"] }),
    ];
    expect(formatDisplayNameFromNameForms(forms, null)).toBe("Alice Ferreira");
  });

  it("falls back to lowest sortOrder when no isPrimary", () => {
    const forms = [
      makeForm({ sortOrder: 2, givenNames: ["Second"], surnames: [] }),
      makeForm({ sortOrder: 0, givenNames: ["First"], surnames: ["/Last/"] }),
    ];
    expect(formatDisplayNameFromNameForms(forms, null)).toBe("First Last");
  });

  it("joins multiple given names", () => {
    const form = makeForm({ isPrimary: true, givenNames: ["Maria", "José"], surnames: ["/Silva/"] });
    expect(formatDisplayNameFromNameForms([form], null)).toBe("Maria José Silva");
  });

  it("joins multiple surnames", () => {
    const form = makeForm({ isPrimary: true, givenNames: ["Ana"], surnames: ["/Gonsalves/", "/Ferreira/"] });
    expect(formatDisplayNameFromNameForms([form], null)).toBe("Ana Gonsalves Ferreira");
  });

  it("strips GEDCOM slashes from surname values", () => {
    const form = makeForm({ isPrimary: true, givenNames: ["Pedro"], surnames: ["/Santos/"] });
    expect(formatDisplayNameFromNameForms([form], null)).toBe("Pedro Santos");
  });

  it("falls back to stripped fullName when composed name is empty", () => {
    const form = makeForm({ isPrimary: true, givenNames: [], surnames: [] });
    expect(formatDisplayNameFromNameForms([form], "Fallback /Name/")).toBe("Fallback Name");
  });
});

// ── initialsFromPersonLabel ───────────────────────────────────────────────────

describe("initialsFromPersonLabel", () => {
  it("returns first + last token initials for a two-word name", () => {
    expect(initialsFromPersonLabel("Alice Smith")).toBe("AS");
  });

  it("uses first + last token for a three-word name", () => {
    expect(initialsFromPersonLabel("Maria José Gonsalves")).toBe("MG");
  });

  it("returns doubled first letter for a single word name", () => {
    expect(initialsFromPersonLabel("Cher")).toBe("CH");
  });

  it("returns ? for empty string (treated as unknown)", () => {
    expect(initialsFromPersonLabel("")).toBe("?");
  });

  it("returns ? for dash placeholder", () => {
    expect(initialsFromPersonLabel("—")).toBe("?");
  });

  it("uppercases the initials", () => {
    expect(initialsFromPersonLabel("alice smith")).toBe("AS");
  });
});
