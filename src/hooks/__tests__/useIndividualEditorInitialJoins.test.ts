import { describe, expect, it } from "vitest";
import { deriveIndividualEditorInitialJoins } from "@/hooks/useIndividualEditorInitialJoins";

describe("deriveIndividualEditorInitialJoins", () => {
  it("returns empty joins in create mode", () => {
    const result = deriveIndividualEditorInitialJoins({
      mode: "create",
      initialIndividual: {
        individualNotes: [{ id: "n1" }],
      },
    });
    expect(result.individualNotes).toEqual([]);
    expect(result.individualMedia).toEqual([]);
    expect(result.individualSources).toEqual([]);
    expect([...result.linkedMediaIds]).toEqual([]);
  });

  it("derives edit-mode joins and deduped media ids", () => {
    const result = deriveIndividualEditorInitialJoins({
      mode: "edit",
      initialIndividual: {
        individualNotes: [{ id: "n1" }, { id: "n2" }],
        individualMedia: [
          { media: { id: "m-1" } },
          { media: { id: " m-2 " } },
          { media: { id: "m-1" } },
          { media: { id: "" } },
          {},
        ],
        individualSources: [{ id: "s1" }],
      },
    });

    expect(result.individualNotes).toHaveLength(2);
    expect(result.individualMedia).toHaveLength(5);
    expect(result.individualSources).toHaveLength(1);
    expect([...result.linkedMediaIds]).toEqual(["m-1", "m-2"]);
  });
});
