#!/usr/bin/env node
/**
 * Link every timeline-import GedcomEvent (agency timeline:augStoryTimeline.json) to the
 * AT Journey attribution GedcomNote via **GedcomEventNote** → `gedcom_event_notes_v2`.
 *
 * Usage (from the-gonsalves-family-admin):
 *   node --experimental-strip-types scripts/link-timeline-events-to-attribution-note.ts --dry-run
 *   node --experimental-strip-types scripts/link-timeline-events-to-attribution-note.ts --execute
 *
 * Re-run after `import-aug-story-timeline --execute --force`: deleting events CASCADE-deletes
 * GedcomEventNote rows for those event ids.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../lib/database/prisma.ts";
import { getAdminFileUuid } from "../lib/infra/admin-tree.ts";

const IMPORT_AGENCY_TAG = "timeline:augStoryTimeline.json";
const NOTE_CONTENT_FINGERPRINT = "https://gonsalvesfamily.com/histories/ATJourney.html";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

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

  const note = await prisma.gedcomNote.findFirst({
    where: { fileUuid, content: { contains: NOTE_CONTENT_FINGERPRINT } },
    select: { id: true, xref: true },
  });
  if (!note) {
    console.error(`No attribution note found (content contains ${NOTE_CONTENT_FINGERPRINT}). Run create-atjourney-attribution-note first.`);
    process.exit(1);
  }

  const events = await prisma.gedcomEvent.findMany({
    where: { fileUuid, agency: IMPORT_AGENCY_TAG },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  if (events.length === 0) {
    console.error(`No events with agency="${IMPORT_AGENCY_TAG}".`);
    process.exit(1);
  }

  const existingLinks = await prisma.gedcomEventNote.count({
    where: { fileUuid, noteId: note.id, eventId: { in: events.map((e) => e.id) } },
  });

  console.log(`fileUuid=${fileUuid}`);
  console.log(`noteId=${note.id} xref=${note.xref}`);
  console.log(`timeline events=${events.length} existing event-note links (subset)=${existingLinks}`);

  if (dryRun) {
    console.log("Dry run: would create GedcomEventNote rows (gedcom_event_notes_v2) for any missing pairs.");
    await prisma.$disconnect();
    return;
  }

  const { count } = await prisma.gedcomEventNote.createMany({
    data: events.map((e) => ({
      fileUuid,
      eventId: e.id,
      noteId: note.id,
    })),
    skipDuplicates: true,
  });

  console.log(`GedcomEventNote.createMany inserted (new rows): ${count} (duplicates skipped by @@unique([fileUuid, eventId, noteId]))`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
