#!/usr/bin/env node
/**
 * Insert a standalone (top-level) GedcomNote on the admin tree's GEDCOM file,
 * attributing the AT Journey story to its original web publication.
 *
 * Usage (from the-gonsalves-family-admin):
 *   node --experimental-strip-types scripts/create-atjourney-attribution-note.ts --dry-run
 *   node --experimental-strip-types scripts/create-atjourney-attribution-note.ts --execute
 *
 * Idempotent: skips if a note with the same canonical sentence already exists for this file.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGedcomNoteWithLinks, parseNoteLinksFromBody } from "../lib/admin/admin-note-links.ts";
import { prisma } from "../lib/database/prisma.ts";
import { getAdminFileUuid } from "../lib/infra/admin-tree.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const NOTE_CONTENT =
  "This story was originally published online by Norman Peter Gonsalves at https://gonsalvesfamily.com/histories/ATJourney.html .";

/** Stable fragment used to detect an existing attribution note. */
const CONTENT_FINGERPRINT = "https://gonsalvesfamily.com/histories/ATJourney.html";

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

function parseArgs(argv: string[]) {
  let dryRun = false;
  let execute = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--execute") execute = true;
  }
  return { dryRun, execute };
}

async function main() {
  const { dryRun, execute } = parseArgs(process.argv.slice(2));
  if (!dryRun && !execute) {
    console.error("Pass --dry-run or --execute.");
    process.exit(1);
  }

  const fileUuid = await getAdminFileUuid();
  const existing = await prisma.gedcomNote.findFirst({
    where: { fileUuid, content: { contains: CONTENT_FINGERPRINT } },
    select: { id: true, xref: true, content: true, isTopLevel: true },
  });

  if (existing) {
    console.log(`Already present: note ${existing.id} xref=${existing.xref} isTopLevel=${existing.isTopLevel}`);
    console.log(existing.content.slice(0, 120) + (existing.content.length > 120 ? "…" : ""));
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log(`fileUuid=${fileUuid}`);
    console.log("Would create top-level note:");
    console.log(NOTE_CONTENT);
    await prisma.$disconnect();
    return;
  }

  const note = await createGedcomNoteWithLinks(
    fileUuid,
    { content: NOTE_CONTENT, isTopLevel: true },
    parseNoteLinksFromBody(undefined),
  );
  console.log(`Created note id=${note.id} xref=${note.xref} isTopLevel=${note.isTopLevel}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
