import { describe, expect, it } from "vitest";

import { buildExportBundleManifest } from "@/lib/admin/build-export-bundle-manifest";

describe("buildExportBundleManifest", () => {
  it("includes counts, tree id, and stable hashes for buffers", async () => {
    const { manifest, json } = await buildExportBundleManifest({
      enriched: {
        Individuals: [{}, {}],
        Families: [{}],
        Media: [],
        Notes: [{}, {}, {}],
      },
      basename: "tree",
      treeId: "11111111-1111-1111-1111-111111111111",
      exportedAtIso: "2026-04-26T12:00:00.000Z",
      readmeUtf8: "readme\n",
      gedPortableUtf8: "0 HEAD\n",
      jsonBytes: new TextEncoder().encode("{}").buffer,
      csvBytes: new TextEncoder().encode("a,b\n").buffer,
      mediaFiles: [],
      appVersion: "0.1.0-test",
      schemaVersion: "test-schema",
    });

    expect(manifest.treeId).toBe("11111111-1111-1111-1111-111111111111");
    expect(manifest.counts).toEqual({
      individuals: 2,
      families: 1,
      media: 0,
      notes: 3,
    });
    expect(manifest.files).toHaveLength(4);
    expect(manifest.files.map((f) => f.path)).toEqual([
      "README.txt",
      "tree.ged",
      "tree.json",
      "tree.csv",
    ]);
    expect(manifest.files[0].sha256).toHaveLength(64);
    expect(JSON.parse(json).manifestVersion).toBe("1.0");
  });
});
