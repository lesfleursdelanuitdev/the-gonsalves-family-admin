import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  txMock,
  logLinkMock,
  logUnlinkMock,
  setBatchSummaryMock,
  newBatchIdMock,
  syncSuggestionStatusMock,
  prismaMock,
} = vi.hoisted(() => {
  const txMock = {
    resolvedPlaceLink: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    changeLog: { create: vi.fn().mockResolvedValue({}) },
  };

  const prismaMock = {
    gedcomPlace: { findFirst: vi.fn() },
    resolvedPlace: { findFirst: vi.fn() },
    resolvedPlaceLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };

  return {
    txMock,
    logLinkMock: vi.fn().mockResolvedValue(undefined),
    logUnlinkMock: vi.fn().mockResolvedValue(undefined),
    setBatchSummaryMock: vi.fn().mockResolvedValue(undefined),
    newBatchIdMock: vi.fn().mockReturnValue("batch-uuid"),
    syncSuggestionStatusMock: vi.fn().mockResolvedValue(undefined),
    prismaMock,
  };
});

vi.mock("../database/prisma.ts", () => ({ prisma: prismaMock }));
vi.mock("./changelog.ts", () => ({
  logLink: logLinkMock,
  logUnlink: logUnlinkMock,
  setBatchSummary: setBatchSummaryMock,
  newBatchId: newBatchIdMock,
}));
vi.mock("./place-resolution-sync.ts", () => ({
  syncSuggestionStatus: syncSuggestionStatusMock,
}));

import { createPlaceLink, deletePlaceLink, batchMovePlaceLinks } from "./place-resolution-links.ts";

const FILE_UUID = "file-uuid-1";
const USER_ID = "user-1";
const GEDCOM_PLACE_ID = "gp-1";
const RESOLVED_PLACE_ID = "rp-1";
const LINK_ID = "link-1";

const GEDCOM_PLACE = { id: GEDCOM_PLACE_ID, original: "London, England" };
const RESOLVED_PLACE = { id: RESOLVED_PLACE_ID, displayName: "London" };

beforeEach(() => {
  vi.clearAllMocks();
  newBatchIdMock.mockReturnValue("batch-uuid");
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
  txMock.resolvedPlaceLink.create.mockResolvedValue({ id: LINK_ID });
  txMock.resolvedPlaceLink.delete.mockResolvedValue({});
  txMock.resolvedPlaceLink.deleteMany.mockResolvedValue({});
});

// ── createPlaceLink ──────────────────────────────────────────────────────────

describe("createPlaceLink", () => {
  function setupFound() {
    prismaMock.gedcomPlace.findFirst.mockResolvedValue(GEDCOM_PLACE);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(RESOLVED_PLACE);
    prismaMock.resolvedPlaceLink.findUnique.mockResolvedValue(null);
  }

  it("throws 404 when gedcomPlace not found", async () => {
    prismaMock.gedcomPlace.findFirst.mockResolvedValue(null);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(RESOLVED_PLACE);
    const err = await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" }).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/GedcomPlace not found/);
  });

  it("throws 404 when resolvedPlace not found", async () => {
    prismaMock.gedcomPlace.findFirst.mockResolvedValue(GEDCOM_PLACE);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(null);
    const err = await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" }).catch(e => e);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/ResolvedPlace not found/);
  });

  it("throws 409 when gedcomPlace is already linked", async () => {
    prismaMock.gedcomPlace.findFirst.mockResolvedValue(GEDCOM_PLACE);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(RESOLVED_PLACE);
    prismaMock.resolvedPlaceLink.findUnique.mockResolvedValue({ id: "existing-link" });
    const err = await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" }).catch(e => e);
    expect((err as { status: number }).status).toBe(409);
    expect(err.message).toMatch(/already linked/);
  });

  it("creates the link in a transaction", async () => {
    setupFound();
    await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual", confidence: 90 });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(txMock.resolvedPlaceLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual", confidence: 90 }),
      }),
    );
  });

  it("defaults confidence to 100 when not provided", async () => {
    setupFound();
    await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" });
    expect(txMock.resolvedPlaceLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ confidence: 100 }) }),
    );
  });

  it("calls logLink inside the transaction", async () => {
    setupFound();
    const created = { id: LINK_ID, gedcomPlaceId: GEDCOM_PLACE_ID };
    txMock.resolvedPlaceLink.create.mockResolvedValue(created);
    await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" });
    expect(logLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "batch-uuid", fileUuid: FILE_UUID, userId: USER_ID }),
      "resolved_place_link",
      LINK_ID,
      null,
      expect.objectContaining({ id: LINK_ID }),
    );
  });

  it("sets batch summary with place names", async () => {
    setupFound();
    await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" });
    expect(setBatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      `Link "London, England" → "London"`,
    );
  });

  it("calls syncSuggestionStatus after the transaction", async () => {
    setupFound();
    await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" });
    expect(syncSuggestionStatusMock).toHaveBeenCalledWith(GEDCOM_PLACE_ID);
    expect(syncSuggestionStatusMock).toHaveBeenCalledAfter(prismaMock.$transaction as ReturnType<typeof vi.fn>);
  });

  it("returns the created link", async () => {
    setupFound();
    const created = { id: LINK_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID };
    txMock.resolvedPlaceLink.create.mockResolvedValue(created);
    const result = await createPlaceLink({ fileUuid: FILE_UUID, userId: USER_ID, gedcomPlaceId: GEDCOM_PLACE_ID, resolvedPlaceId: RESOLVED_PLACE_ID, matchMethod: "manual" });
    expect(result).toEqual(created);
  });
});

// ── deletePlaceLink ──────────────────────────────────────────────────────────

describe("deletePlaceLink", () => {
  const LINK_ROW = {
    id: LINK_ID,
    gedcomPlaceId: GEDCOM_PLACE_ID,
    resolvedPlaceId: RESOLVED_PLACE_ID,
    gedcomPlace: { id: GEDCOM_PLACE_ID, fileUuid: FILE_UUID, original: "London, England" },
  };

  beforeEach(() => {
    prismaMock.resolvedPlaceLink.findUnique.mockResolvedValue(LINK_ROW);
  });

  it("throws 404 when link not found", async () => {
    prismaMock.resolvedPlaceLink.findUnique.mockResolvedValue(null);
    const err = await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID).catch(e => e);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/Link not found/);
  });

  it("throws 404 when link belongs to different file", async () => {
    prismaMock.resolvedPlaceLink.findUnique.mockResolvedValue({
      ...LINK_ROW,
      gedcomPlace: { ...LINK_ROW.gedcomPlace, fileUuid: "other-file" },
    });
    const err = await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID).catch(e => e);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/Link not found/);
  });

  it("deletes the link inside a transaction", async () => {
    await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(txMock.resolvedPlaceLink.delete).toHaveBeenCalledWith({ where: { id: LINK_ID } });
  });

  it("calls logUnlink inside the transaction", async () => {
    await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID);
    expect(logUnlinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "batch-uuid", fileUuid: FILE_UUID, userId: USER_ID }),
      "resolved_place_link",
      LINK_ID,
      null,
      expect.objectContaining({ id: LINK_ID, gedcomPlaceId: GEDCOM_PLACE_ID }),
    );
  });

  it("logUnlink snapshot does not include gedcomPlace join", async () => {
    await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID);
    const snapshot = logUnlinkMock.mock.calls[0][4] as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty("gedcomPlace");
  });

  it("sets batch summary with original place name", async () => {
    await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID);
    expect(setBatchSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      `Unlink "London, England"`,
    );
  });

  it("calls syncSuggestionStatus after the transaction", async () => {
    await deletePlaceLink(LINK_ID, FILE_UUID, USER_ID);
    expect(syncSuggestionStatusMock).toHaveBeenCalledWith(GEDCOM_PLACE_ID);
    expect(syncSuggestionStatusMock).toHaveBeenCalledAfter(prismaMock.$transaction as ReturnType<typeof vi.fn>);
  });
});

// ── batchMovePlaceLinks ──────────────────────────────────────────────────────

describe("batchMovePlaceLinks", () => {
  const TARGET_PLACE_ID = "rp-target";
  const TARGET_PLACE = { id: TARGET_PLACE_ID, displayName: "Paris" };

  const LINK_A = { id: "link-a", gedcomPlaceId: "gp-a", resolvedPlaceId: RESOLVED_PLACE_ID, gedcomPlace: { id: "gp-a", fileUuid: FILE_UUID } };
  const LINK_B = { id: "link-b", gedcomPlaceId: "gp-b", resolvedPlaceId: RESOLVED_PLACE_ID, gedcomPlace: { id: "gp-b", fileUuid: FILE_UUID } };

  function setupValid() {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([LINK_A, LINK_B]);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(TARGET_PLACE);
    txMock.resolvedPlaceLink.create
      .mockResolvedValueOnce({ id: "new-link-a", gedcomPlaceId: "gp-a", resolvedPlaceId: TARGET_PLACE_ID })
      .mockResolvedValueOnce({ id: "new-link-b", gedcomPlaceId: "gp-b", resolvedPlaceId: TARGET_PLACE_ID });
  }

  it("throws 404 when one or more links not found", async () => {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([LINK_A]); // only 1 of 2 requested
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(TARGET_PLACE);
    const err = await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID }).catch(e => e);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/not found/i);
  });

  it("throws 403 when a link belongs to different file", async () => {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([
      LINK_A,
      { ...LINK_B, gedcomPlace: { id: "gp-b", fileUuid: "other-file" } },
    ]);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(TARGET_PLACE);
    const err = await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID }).catch(e => e);
    expect((err as { status: number }).status).toBe(403);
    expect(err.message).toMatch(/different file/);
  });

  it("throws 404 when target resolved place not found", async () => {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([LINK_A, LINK_B]);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(null);
    const err = await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID }).catch(e => e);
    expect((err as { status: number }).status).toBe(404);
    expect(err.message).toMatch(/Target ResolvedPlace not found/);
  });

  it("throws 409 when any link is already assigned to the target place", async () => {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([
      { ...LINK_A, resolvedPlaceId: TARGET_PLACE_ID },
      LINK_B,
    ]);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(TARGET_PLACE);
    const err = await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID }).catch(e => e);
    expect((err as { status: number }).status).toBe(409);
    expect(err.message).toMatch(/already assigned/);
  });

  it("logUnlinks each old link inside the transaction", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(logUnlinkMock).toHaveBeenCalledTimes(2);
    expect(logUnlinkMock).toHaveBeenCalledWith(expect.anything(), "resolved_place_link", "link-a", null, expect.objectContaining({ id: "link-a" }));
    expect(logUnlinkMock).toHaveBeenCalledWith(expect.anything(), "resolved_place_link", "link-b", null, expect.objectContaining({ id: "link-b" }));
  });

  it("deleteMany old links then creates new ones", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(txMock.resolvedPlaceLink.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["link-a", "link-b"] } } });
    expect(txMock.resolvedPlaceLink.create).toHaveBeenCalledTimes(2);
    expect(txMock.resolvedPlaceLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gedcomPlaceId: "gp-a", resolvedPlaceId: TARGET_PLACE_ID, matchMethod: "manual" }) }),
    );
  });

  it("logLinks each new link inside the transaction", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(logLinkMock).toHaveBeenCalledTimes(2);
    expect(logLinkMock).toHaveBeenCalledWith(expect.anything(), "resolved_place_link", "new-link-a", null, expect.objectContaining({ gedcomPlaceId: "gp-a" }));
    expect(logLinkMock).toHaveBeenCalledWith(expect.anything(), "resolved_place_link", "new-link-b", null, expect.objectContaining({ gedcomPlaceId: "gp-b" }));
  });

  it("sets batch summary with count and target display name", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(setBatchSummaryMock).toHaveBeenCalledWith(expect.anything(), `Move 2 links → "Paris"`);
  });

  it("uses singular 'link' in summary for one link", async () => {
    prismaMock.resolvedPlaceLink.findMany.mockResolvedValue([LINK_A]);
    prismaMock.resolvedPlace.findFirst.mockResolvedValue(TARGET_PLACE);
    txMock.resolvedPlaceLink.create.mockResolvedValueOnce({ id: "new-link-a", gedcomPlaceId: "gp-a", resolvedPlaceId: TARGET_PLACE_ID });
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(setBatchSummaryMock).toHaveBeenCalledWith(expect.anything(), `Move 1 link → "Paris"`);
  });

  it("calls syncSuggestionStatus for each gedcomPlaceId after the transaction", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(syncSuggestionStatusMock).toHaveBeenCalledTimes(2);
    expect(syncSuggestionStatusMock).toHaveBeenCalledWith("gp-a");
    expect(syncSuggestionStatusMock).toHaveBeenCalledWith("gp-b");
    expect(syncSuggestionStatusMock).toHaveBeenCalledAfter(prismaMock.$transaction as ReturnType<typeof vi.fn>);
  });

  it("returns moved count", async () => {
    setupValid();
    const result = await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    expect(result).toEqual({ moved: 2 });
  });

  it("unlink snapshots do not include gedcomPlace join", async () => {
    setupValid();
    await batchMovePlaceLinks({ fileUuid: FILE_UUID, userId: USER_ID, linkIds: ["link-a", "link-b"], targetResolvedPlaceId: TARGET_PLACE_ID });
    const snapshot = logUnlinkMock.mock.calls[0][4] as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty("gedcomPlace");
  });
});
