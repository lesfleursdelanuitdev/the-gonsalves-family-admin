import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeTwoIndividuals } from "./gedcom-merge-individuals.ts";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { txMock, logUpdateMock, logDeleteMock, setBatchSummaryMock, newBatchIdMock } = vi.hoisted(() => {
  const makeDelegate = () => ({
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
  });

  const txMock = {
    gedcomIndividual: makeDelegate(),
    gedcomIndividualEvent: makeDelegate(),
    gedcomIndividualNote: makeDelegate(),
    gedcomIndividualSource: makeDelegate(),
    gedcomIndividualMedia: makeDelegate(),
    gedcomIndividualNameForm: makeDelegate(),
    gedcomFamily: makeDelegate(),
    gedcomFamilyChild: makeDelegate(),
    gedcomParentChild: makeDelegate(),
    gedcomSpouse: makeDelegate(),
    gedcomIndividualAssociation: makeDelegate(),
    gedcomFileObject: makeDelegate(),
  };

  return {
    txMock,
    logUpdateMock: vi.fn().mockResolvedValue(undefined),
    logDeleteMock: vi.fn().mockResolvedValue(undefined),
    setBatchSummaryMock: vi.fn().mockResolvedValue(undefined),
    newBatchIdMock: vi.fn().mockReturnValue("test-batch-id"),
  };
});

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn().mockImplementation((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

vi.mock("./changelog.ts", () => ({
  logUpdate: logUpdateMock,
  logDelete: logDeleteMock,
  setBatchSummary: setBatchSummaryMock,
  newBatchId: newBatchIdMock,
}));

vi.mock("./admin-individual-families.ts", () => ({
  recomputeIndividualFamilyFlags: vi.fn().mockResolvedValue(undefined),
  syncFamilySpouseXrefs: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILE_UUID = "file-uuid";
const PRIMARY_ID = "primary-id";
const SECONDARY_ID = "secondary-id";

function makePrimary(overrides = {}) {
  return { id: PRIMARY_ID, xref: "I1", fullName: "John /Smith/", ...overrides };
}

function makeSecondary(overrides = {}) {
  return { id: SECONDARY_ID, xref: "I2", fullName: "Jane /Doe/", ...overrides };
}

/** Set up the default "empty merge" — no associations on either individual. */
function setupEmptyMerge() {
  txMock.gedcomIndividual.findFirst
    .mockResolvedValueOnce(makePrimary())
    .mockResolvedValueOnce(makeSecondary());
  txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());
}

beforeEach(() => {
  vi.clearAllMocks();

  // Reset all tx delegates to empty-array / null defaults
  for (const delegate of Object.values(txMock) as Array<ReturnType<typeof Object.values>[0]>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = delegate as any;
    d.findFirst?.mockResolvedValue(null);
    d.findMany?.mockResolvedValue([]);
    d.findUniqueOrThrow?.mockResolvedValue(undefined);
    d.create?.mockResolvedValue({});
    d.update?.mockResolvedValue({});
    d.updateMany?.mockResolvedValue({});
    d.delete?.mockResolvedValue({});
    d.deleteMany?.mockResolvedValue({});
  }
});

// ── Error cases ───────────────────────────────────────────────────────────────

describe("mergeTwoIndividuals — error cases", () => {
  it("throws when primaryId === secondaryId", async () => {
    await expect(mergeTwoIndividuals(FILE_UUID, "user-1", "same", "same"))
      .rejects.toThrow("Primary and secondary must be different individuals");
  });

  it("throws when primary individual is not found", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(null)        // primary not found
      .mockResolvedValueOnce(makeSecondary());
    await expect(mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID))
      .rejects.toThrow(`Primary individual ${PRIMARY_ID} not found`);
  });

  it("throws when secondary individual is not found", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(null);       // secondary not found
    await expect(mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID))
      .rejects.toThrow(`Secondary individual ${SECONDARY_ID} not found`);
  });
});

// ── Batch summary ─────────────────────────────────────────────────────────────

describe("mergeTwoIndividuals — batch summary", () => {
  it("sets summary as 'Merge [secondary] into [primary]' stripping GEDCOM slashes", async () => {
    setupEmptyMerge();
    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);
    expect(setBatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      "Merge Jane Doe into John Smith",
    );
  });

  it("falls back to xref in summary when fullName is null", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce({ id: PRIMARY_ID, xref: "I1", fullName: null })
      .mockResolvedValueOnce({ id: SECONDARY_ID, xref: "I2", fullName: null });
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(
      { id: SECONDARY_ID, xref: "I2", fullName: null },
    );
    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);
    expect(setBatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      "Merge I2 into I1",
    );
  });
});

// ── logDelete for secondary (must be last log call) ───────────────────────────

describe("mergeTwoIndividuals — secondary deletion", () => {
  it("calls logDelete for the secondary individual", async () => {
    const snapshot = makeSecondary();
    setupEmptyMerge();
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(snapshot);
    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logDeleteMock).toHaveBeenCalledWith(
      expect.anything(),
      "individual",
      SECONDARY_ID,
      "I2",
      snapshot,
    );
  });

  it("logDelete for secondary is the final logDelete call before setBatchSummary", async () => {
    setupEmptyMerge();
    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    const logDeleteCalls = logDeleteMock.mock.calls;
    const setSummaryCalls = setBatchSummaryMock.mock.invocationCallOrder[0];
    const lastLogDeleteOrder = logDeleteMock.mock.invocationCallOrder.at(-1)!;

    // setBatchSummary must fire after the last logDelete
    expect(setSummaryCalls).toBeGreaterThan(lastLogDeleteOrder);

    // The last logDelete entity type is "individual"
    expect(logDeleteCalls.at(-1)?.[1]).toBe("individual");
  });

  it("actually deletes the secondary individual row", async () => {
    setupEmptyMerge();
    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);
    expect(txMock.gedcomIndividual.delete).toHaveBeenCalledWith({ where: { id: SECONDARY_ID } });
  });
});

// ── Note transfer ─────────────────────────────────────────────────────────────

describe("mergeTwoIndividuals — note transfer", () => {
  it("calls logUpdate for a transferred note junction", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(makeSecondary());
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());

    txMock.gedcomIndividualNote.findMany
      .mockResolvedValueOnce([])  // primary notes — none
      .mockResolvedValueOnce([
        { id: "sn-1", noteId: "note-unique", fileUuid: FILE_UUID, individualId: SECONDARY_ID },
      ]);

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(),
      "individual_note",
      "sn-1",
      null,
      { individualId: SECONDARY_ID },
      { individualId: PRIMARY_ID },
    );
    expect(txMock.gedcomIndividualNote.update).toHaveBeenCalledWith({
      where: { id: "sn-1" },
      data: { individualId: PRIMARY_ID },
    });
  });

  it("calls logDelete (not logUpdate) for a duplicate note junction", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(makeSecondary());
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());

    const dupRow = { id: "sn-dup", noteId: "shared-note", fileUuid: FILE_UUID, individualId: SECONDARY_ID };
    txMock.gedcomIndividualNote.findMany
      .mockResolvedValueOnce([{ noteId: "shared-note" }])  // primary already has it
      .mockResolvedValueOnce([dupRow]);

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logDeleteMock).toHaveBeenCalledWith(
      expect.anything(), "individual_note", "sn-dup", null, dupRow,
    );
    expect(txMock.gedcomIndividualNote.delete).toHaveBeenCalledWith({ where: { id: "sn-dup" } });
    expect(logUpdateMock).not.toHaveBeenCalledWith(
      expect.anything(), "individual_note", expect.anything(), expect.anything(), expect.anything(), expect.anything(),
    );
  });

  it("handles a mix: deletes duplicate, updates unique", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(makeSecondary());
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());

    txMock.gedcomIndividualNote.findMany
      .mockResolvedValueOnce([{ noteId: "shared-note" }])
      .mockResolvedValueOnce([
        { id: "sn-dup", noteId: "shared-note", fileUuid: FILE_UUID, individualId: SECONDARY_ID },
        { id: "sn-new", noteId: "unique-note", fileUuid: FILE_UUID, individualId: SECONDARY_ID },
      ]);

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logDeleteMock).toHaveBeenCalledWith(
      expect.anything(), "individual_note", "sn-dup", null,
      expect.objectContaining({ id: "sn-dup" }),
    );
    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "individual_note", "sn-new", null,
      { individualId: SECONDARY_ID }, { individualId: PRIMARY_ID },
    );
  });
});

// ── Event cascade sweep ───────────────────────────────────────────────────────

describe("mergeTwoIndividuals — event cascade sweep", () => {
  it("logDeletes remaining secondary event junctions before deleting secondary", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(makeSecondary());
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());

    const dupEventRow = {
      id: "iev-dup",
      fileUuid: FILE_UUID,
      individualId: SECONDARY_ID,
      eventId: "ev-1",
    };

    // Call 1: primary events (for dedup key building) — empty
    // Call 2: secondary event links (with include) — has a duplicate (same key as primary)
    // Call 3: pre-delete sweep of remaining secondary events (without include)
    txMock.gedcomIndividualEvent.findMany
      .mockResolvedValueOnce([{
        id: "iev-primary",
        event: { eventType: "BIRT", dateId: null, placeId: null },
      }])
      .mockResolvedValueOnce([{
        id: "iev-dup-raw",
        event: { eventType: "BIRT", dateId: null, placeId: null }, // duplicate key → skipped
      }])
      .mockResolvedValueOnce([dupEventRow]); // sweep finds it still on secondary

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logDeleteMock).toHaveBeenCalledWith(
      expect.anything(), "individual_event", "iev-dup", null, dupEventRow,
    );
    // logUpdate should NOT have been called for the duplicate event junction
    const updateCallsForEvent = logUpdateMock.mock.calls.filter((c) => c[1] === "individual_event");
    expect(updateCallsForEvent).toHaveLength(0);
  });

  it("does not call logDelete for event sweep when no duplicates remain", async () => {
    setupEmptyMerge();
    // All three findMany calls for events return []
    txMock.gedcomIndividualEvent.findMany.mockResolvedValue([]);

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    const sweepCalls = logDeleteMock.mock.calls.filter((c) => c[1] === "individual_event");
    expect(sweepCalls).toHaveLength(0);
  });
});

// ── Family spouse / child slots ───────────────────────────────────────────────

describe("mergeTwoIndividuals — family slots", () => {
  it("calls logUpdate on the family row when secondary is husband", async () => {
    setupEmptyMerge();
    const fam = { id: "fam-1", xref: "F1" };
    txMock.gedcomFamily.findMany
      .mockResolvedValueOnce([fam]) // as husband
      .mockResolvedValueOnce([]);   // as wife

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "family", "fam-1", "F1",
      { husbandId: SECONDARY_ID },
      { husbandId: PRIMARY_ID },
    );
    expect(txMock.gedcomFamily.update).toHaveBeenCalledWith({
      where: { id: "fam-1" },
      data: { husbandId: PRIMARY_ID },
    });
  });

  it("calls logUpdate when secondary is wife", async () => {
    setupEmptyMerge();
    txMock.gedcomFamily.findMany
      .mockResolvedValueOnce([])                     // as husband
      .mockResolvedValueOnce([{ id: "fam-2", xref: "F2" }]); // as wife

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "family", "fam-2", "F2",
      { wifeId: SECONDARY_ID },
      { wifeId: PRIMARY_ID },
    );
  });
});

// ── ParentChild & Spouse (formerly updateMany) ────────────────────────────────

describe("mergeTwoIndividuals — per-row operations converted from updateMany", () => {
  it("calls logUpdate for each parentId row (converted from updateMany)", async () => {
    setupEmptyMerge();
    txMock.gedcomParentChild.findMany
      .mockResolvedValueOnce([{ id: "pc-1" }, { id: "pc-2" }]) // as parent
      .mockResolvedValueOnce([]);                               // as child

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "parent_child", "pc-1", null,
      { parentId: SECONDARY_ID }, { parentId: PRIMARY_ID },
    );
    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "parent_child", "pc-2", null,
      { parentId: SECONDARY_ID }, { parentId: PRIMARY_ID },
    );
  });

  it("calls logUpdate for each spouse individualId row", async () => {
    setupEmptyMerge();
    txMock.gedcomSpouse.findMany
      .mockResolvedValueOnce([{ id: "sp-1" }]) // as individualId
      .mockResolvedValueOnce([]);              // as spouseId

    await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);

    expect(logUpdateMock).toHaveBeenCalledWith(
      expect.anything(), "spouse", "sp-1", null,
      { individualId: SECONDARY_ID }, { individualId: PRIMARY_ID },
    );
    expect(txMock.gedcomSpouse.update).toHaveBeenCalledWith({
      where: { id: "sp-1" },
      data: { individualId: PRIMARY_ID },
    });
  });
});

// ── Return value ──────────────────────────────────────────────────────────────

describe("mergeTwoIndividuals — return value", () => {
  it("returns primaryId, secondaryId, and transfer counts", async () => {
    setupEmptyMerge();
    const result = await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);
    expect(result).toMatchObject({
      primaryId: PRIMARY_ID,
      secondaryId: SECONDARY_ID,
      eventsTransferred: 0,
      notesTransferred: 0,
      sourcesTransferred: 0,
      familiesUpdated: 0,
    });
  });

  it("increments notesTransferred for each transferred (non-duplicate) note", async () => {
    txMock.gedcomIndividual.findFirst
      .mockResolvedValueOnce(makePrimary())
      .mockResolvedValueOnce(makeSecondary());
    txMock.gedcomIndividual.findUniqueOrThrow.mockResolvedValue(makeSecondary());
    txMock.gedcomIndividualNote.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "sn-a", noteId: "n-a", fileUuid: FILE_UUID, individualId: SECONDARY_ID },
        { id: "sn-b", noteId: "n-b", fileUuid: FILE_UUID, individualId: SECONDARY_ID },
      ]);

    const result = await mergeTwoIndividuals(FILE_UUID, "user-1", PRIMARY_ID, SECONDARY_ID);
    expect(result.notesTransferred).toBe(2);
  });
});
