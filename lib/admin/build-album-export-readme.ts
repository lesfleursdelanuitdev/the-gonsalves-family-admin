export type AlbumReadmeMediaLine =
  | { kind: "included"; zipPath: string; title: string; fileRef: string }
  | { kind: "missing"; title: string; fileRef: string }
  | { kind: "external"; title: string; fileRef: string }
  | { kind: "unresolved"; title: string; fileRef: string };

export function buildAlbumExportReadme(opts: {
  albumName: string;
  generatedAtIso: string;
  mediaLines: AlbumReadmeMediaLine[];
}): string {
  const { albumName, generatedAtIso, mediaLines } = opts;
  const included = mediaLines.filter((l) => l.kind === "included");
  const missing = mediaLines.filter((l) => l.kind === "missing");
  const external = mediaLines.filter((l) => l.kind === "external");
  const unresolved = mediaLines.filter((l) => l.kind === "unresolved");

  const lines: string[] = [
    "Album export (ZIP)",
    "===================",
    "",
    `Album: ${albumName}`,
    `Generated (UTC): ${generatedAtIso}`,
    "",
    "What this is",
    "-------------",
    "",
    "This archive was produced by The Gonsalves Family Admin. It is an offline snapshot of ONE album:",
    "multimedia files that belong to that album in the current GEDCOM tree, plus metadata.",
    "",
    "It is NOT a full tree backup. For a complete tree + GEDCOM + JSON + CSV + media bundle, use the",
    "admin Export page (full bundle) instead.",
    "",
    "Contents",
    "--------",
    "",
    "- manifest.json",
    "    Machine-readable description: album fields, producer, UTC export time, and every media row with",
    "    bundle status (included in media/ vs external URL vs missing vs path not under gedcom-admin).",
    "",
    "- README.txt",
    "    This file.",
    "",
    "- media/",
    "    Files copied from the server when the OBJE file reference points under /uploads/gedcom-admin/",
    "    and the file existed on disk at export time.",
    "",
    "Notes",
    "-----",
    "",
    `Bundled files: ${included.length}`,
    `External URLs (not copied): ${external.length}`,
    `Missing on disk: ${missing.length}`,
    `Unresolved / outside gedcom-admin path: ${unresolved.length}`,
    "",
  ];

  if (included.length) {
    lines.push("Bundled media paths", "-------------------", "");
    for (const l of included) {
      lines.push(`- ${l.zipPath}`);
      lines.push(`    ${l.title}`);
      lines.push(`    Original file ref: ${l.fileRef}`);
      lines.push("");
    }
  }

  if (external.length) {
    lines.push("External URLs (see manifest.json)", "---------------------------------", "");
    for (const l of external) {
      lines.push(`- ${l.title}: ${l.fileRef}`);
    }
    lines.push("");
  }

  if (missing.length) {
    lines.push("Missing on disk", "---------------", "");
    for (const l of missing) {
      lines.push(`- ${l.title}: ${l.fileRef}`);
    }
    lines.push("");
  }

  if (unresolved.length) {
    lines.push("Unresolved paths", "----------------", "");
    for (const l of unresolved) {
      lines.push(`- ${l.title}: ${l.fileRef}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
