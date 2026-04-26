export type BundleMediaLine =
  | { kind: "included"; zipPath: string; fileRef: string; xref: string }
  | { kind: "missing"; fileRef: string; xref: string }
  | { kind: "external"; fileRef: string; xref: string }
  | { kind: "unresolved"; fileRef: string; xref: string };

export function buildExportBundleReadme(opts: {
  basename: string;
  mediaLines: BundleMediaLine[];
  generatedAtIso: string;
}): string {
  const { basename, mediaLines, generatedAtIso } = opts;
  const included = mediaLines.filter((l) => l.kind === "included");
  const missing = mediaLines.filter((l) => l.kind === "missing");
  const external = mediaLines.filter((l) => l.kind === "external");
  const unresolved = mediaLines.filter((l) => l.kind === "unresolved");

  const lines: string[] = [
    "Tree export bundle",
    "===================",
    "",
    `Generated (UTC): ${generatedAtIso}`,
    "",
    "Contents",
    "--------",
    "",
    `- ${basename}.ged`,
    "    GEDCOM 5.5 export of the tree (via ligneous-gedcom-lib).",
    "",
    `- ${basename}.json`,
    "    Same tree as structured JSON (intermediate / interchange format).",
    "",
    `- ${basename}.csv`,
    "    Tabular CSV export from the same enriched snapshot.",
    "",
    "- media/",
    "    Binary files referenced by multimedia records in this export, when they live under",
    "    /uploads/gedcom-admin/ on the server and the file was found on disk.",
    "",
    "- README.txt",
    "    This file.",
    "",
    "Notes",
    "-----",
    "",
    "- OBJE / multimedia in GEDCOM point at FILE paths; this bundle embeds copies of site-relative",
    "  uploads under media/ so the archive is self-contained for local archives.",
    "- External http(s) URLs are not downloaded; they are listed below under \"External references\".",
    "- Paths that are not under /uploads/gedcom-admin/ are listed under \"Other references\".",
    "",
  ];

  if (missing.length > 0) {
    lines.push("Missing files (database path but not on disk)", "---------------------------------------------", "");
    for (const m of missing) {
      lines.push(`- xref ${m.xref || "(none)"}: ${m.fileRef}`);
    }
    lines.push("");
  }

  if (external.length > 0) {
    lines.push("External references (not bundled)", "--------------------------------", "");
    for (const e of external) {
      lines.push(`- xref ${e.xref || "(none)"}: ${e.fileRef}`);
    }
    lines.push("");
  }

  if (unresolved.length > 0) {
    lines.push("Other references (path not under gedcom-admin uploads)", "-------------------------------------------------------", "");
    for (const u of unresolved) {
      lines.push(`- xref ${u.xref || "(none)"}: ${u.fileRef}`);
    }
    lines.push("");
  }

  if (included.length > 0) {
    lines.push("Media files included in this zip", "--------------------------------", "");
    for (const i of included) {
      lines.push(`- ${i.zipPath}  <=  ${i.fileRef}`);
    }
    lines.push("");
  }

  lines.push(
    "Software",
    "--------",
    "",
    "GEDCOM / JSON / CSV generation: ligneous-gedcom-lib-api (POST /api/v1/export).",
    "",
  );

  return lines.join("\n");
}
