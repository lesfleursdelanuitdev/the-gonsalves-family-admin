#!/usr/bin/env node
/**
 * Import `augStoryTimeline.json` events into the admin tree's GEDCOM file.
 *
 * - Resolves `fileUuid` via getAdminFileUuid() (same as admin API).
 * - Dates/places: find-or-create GedcomDate / GedcomPlace (hash rules match admin-event-create).
 * - Rewrites markdown links in `value`: ](local.md) → ](originalHref) using each event's `links`.
 * - Optionally creates StoryEvent rows when AUG_STORY_TIMELINE_STORY_ID or --story-id is set.
 *
 * Usage (from the-gonsalves-family-admin):
 *   node --experimental-strip-types scripts/import-aug-story-timeline.ts --dry-run
 *   node --experimental-strip-types scripts/import-aug-story-timeline.ts --execute
 *   node --experimental-strip-types scripts/import-aug-story-timeline.ts --execute --force
 *   node --experimental-strip-types scripts/import-aug-story-timeline.ts --execute --story-id=<uuid>
 *
 * Env: DATABASE_URL, ADMIN_TREE_ID or ADMIN_TREE_FILE_ID (see .env.local).
 * Default JSON path: ../augStoryTimeline.json (repo gonsalves-genealogy root).
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GedcomDateType } from "@ligneous/prisma";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parsePlaceInput,
} from "../lib/admin/admin-event-create.ts";
import { composePlaceOriginal } from "../lib/gedcom/gedcom-entity-hash.ts";
import { prisma } from "../lib/database/prisma.ts";
import { getAdminFileUuid, getAdminTreeId } from "../lib/infra/admin-tree.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultJsonPath = path.resolve(repoRoot, "..", "augStoryTimeline.json");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

type TimelineLink = { label?: string; href?: string; originalHref?: string };
type TimelinePlace = {
  city?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  inferred?: boolean;
  detail?: string | null;
};
type TimelineTypeMeta = {
  computerReadableType?: string;
  humanReadableType?: string;
  gedcomStandard?: boolean;
};
type TimelineEvent = {
  date: string;
  type: string;
  typeMeta?: TimelineTypeMeta;
  place?: TimelinePlace | null;
  value: string;
  links?: TimelineLink[];
};

const IMPORT_AGENCY_TAG = "timeline:augStoryTimeline.json";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let execute = false;
  let force = false;
  let jsonPath = defaultJsonPath;
  let storyId: string | null = process.env.AUG_STORY_TIMELINE_STORY_ID?.trim() || null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--execute") execute = true;
    else if (a === "--force") force = true;
    else if (a.startsWith("--json=")) jsonPath = path.resolve(a.slice("--json=".length));
    else if (a.startsWith("--story-id=")) storyId = a.slice("--story-id=".length).trim() || null;
  }
  return { dryRun, execute, force, jsonPath, storyId };
}

function str(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

/** Map timeline `date` string → object accepted by parseDateInput. */
export function timelineDateToRaw(dateStr: string): Record<string, unknown> | null {
  const s = dateStr.trim();
  if (!s) return null;

  const range = /^(\d{4})\s*-\s*(\d{4})$/.exec(s);
  if (range) {
    const y1 = Number(range[1]);
    const y2 = Number(range[2]);
    return {
      dateType: GedcomDateType.BETWEEN,
      original: s,
      year: y1,
      month: null,
      day: null,
      endYear: y2,
      endMonth: null,
      endDay: null,
    };
  }

  const yearOnly = /^(\d{4})$/.exec(s);
  if (yearOnly) {
    return {
      dateType: GedcomDateType.EXACT,
      original: s,
      year: Number(yearOnly[1]),
      month: null,
      day: null,
      endYear: null,
      endMonth: null,
      endDay: null,
    };
  }

  return {
    dateType: GedcomDateType.EXACT,
    original: s,
    year: null,
    month: null,
    day: null,
    endYear: null,
    endMonth: null,
    endDay: null,
  };
}

function timelinePlaceToRaw(place: TimelinePlace | null | undefined): Record<string, unknown> | null {
  if (!place || typeof place !== "object") return null;
  const city = str(place.city);
  const county = str(place.county);
  const state = str(place.state);
  const country = str(place.country);
  const detail = str(place.detail);
  if (!city && !county && !state && !country && !detail) return null;

  const composed = composePlaceOriginal({ name: city, county, state, country });
  const original = detail ? (composed ? `${detail}, ${composed}` : detail) : composed;

  return {
    name: city || null,
    county: county || null,
    state: state || null,
    country: country || null,
    original: original || composed,
  };
}

export function rewriteValueWithCanonicalLinks(value: string, links: TimelineLink[] | undefined): string {
  if (!links?.length) return value;
  let out = value;
  for (const link of links) {
    const href = typeof link.href === "string" ? link.href.trim() : "";
    const target = typeof link.originalHref === "string" ? link.originalHref.trim() : "";
    if (!href || !target) continue;
    out = out.split(`](${href})`).join(`](${target})`);
  }
  return out;
}

async function main() {
  const { dryRun, execute, force, jsonPath, storyId } = parseArgs(process.argv.slice(2));

  const raw = await readFile(jsonPath, "utf8");
  const doc = JSON.parse(raw) as { events?: TimelineEvent[] };
  const events = doc.events;
  if (!Array.isArray(events) || events.length === 0) {
    console.error("No events[] in JSON:", jsonPath);
    process.exit(1);
  }

  const fileUuid = await getAdminFileUuid();
  const treeId = await getAdminTreeId();

  if (storyId) {
    const story = await prisma.story.findFirst({
      where: { id: storyId, treeId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!story) {
      console.error(`Story not found or wrong tree: storyId=${storyId} treeId=${treeId}`);
      process.exit(1);
    }
    console.log(`Story link: ${story.title} (${story.id})`);
  }

  console.log(`fileUuid=${fileUuid}`);
  console.log(`treeId=${treeId}`);
  console.log(`json=${jsonPath}`);
  console.log(`events=${events.length} dryRun=${dryRun} execute=${execute} force=${force}`);

  if (!dryRun && !execute) {
    console.error(
      "Pass --dry-run to preview, or --execute to write. Re-run with --execute --force to replace a prior import (same agency tag)."
    );
    process.exit(1);
  }

  if (dryRun) {
    for (let i = 0; i < Math.min(3, events.length); i++) {
      const e = events[i];
      const dRaw = timelineDateToRaw(e.date);
      const dParsed = dRaw ? parseDateInput(dRaw) : null;
      const pRaw = timelinePlaceToRaw(e.place ?? null);
      const pParsed = pRaw ? parsePlaceInput(pRaw) : null;
      const value = rewriteValueWithCanonicalLinks(e.value, e.links);
      console.log("\n--- sample", i, "---");
      console.log("date in →", dParsed);
      console.log("place in →", pParsed?.original, pParsed);
      console.log("value →", value.slice(0, 120) + (value.length > 120 ? "…" : ""));
    }
    console.log("\nDry run only; no writes.");
    await prisma.$disconnect();
    return;
  }

  const prior = await prisma.gedcomEvent.count({
    where: { fileUuid, agency: IMPORT_AGENCY_TAG },
  });
  if (prior > 0 && !force) {
    console.error(
      `Refusing import: ${prior} event(s) already have agency="${IMPORT_AGENCY_TAG}". Use --execute --force to delete them (and linked story_events) and re-import.`
    );
    process.exit(1);
  }

  let sortOrder = 0;
  await prisma.$transaction(async (tx) => {
    if (prior > 0 && force) {
      await tx.storyEvent.deleteMany({
        where: { event: { fileUuid, agency: IMPORT_AGENCY_TAG } },
      });
      await tx.gedcomEvent.deleteMany({
        where: { fileUuid, agency: IMPORT_AGENCY_TAG },
      });
    }

    for (const e of events) {
      const dRaw = timelineDateToRaw(e.date);
      const dateParsed = dRaw ? parseDateInput(dRaw) : null;
      if (!dateParsed) {
        throw new Error(`Unparseable date: ${JSON.stringify(e.date)}`);
      }
      const dateId = await findOrCreateGedcomDate(tx, fileUuid, dateParsed);

      const pRaw = timelinePlaceToRaw(e.place ?? null);
      const placeParsed = pRaw ? parsePlaceInput(pRaw) : null;
      const placeId = placeParsed ? await findOrCreateGedcomPlace(tx, fileUuid, placeParsed) : null;

      const value = rewriteValueWithCanonicalLinks(e.value, e.links).trim();
      const eventType = (e.type || "EVEN").trim();
      const meta = e.typeMeta;
      const customType =
        meta && meta.gedcomStandard === false && str(meta.computerReadableType)
          ? str(meta.computerReadableType)
          : null;

      const created = await tx.gedcomEvent.create({
        data: {
          fileUuid,
          eventType,
          customType,
          value: value || null,
          agency: IMPORT_AGENCY_TAG,
          dateId,
          placeId,
          sortOrder: sortOrder++,
        },
      });

      if (storyId) {
        await tx.storyEvent.create({
          data: {
            storyId,
            eventId: created.id,
            sortOrder: sortOrder - 1,
          },
        });
      }
    }
  });

  console.log(`Inserted ${events.length} GedcomEvent rows${storyId ? ` + StoryEvent for story ${storyId}` : ""}.`);
  if (prior > 0 && force) {
    console.log(
      "Reminder: deleting timeline events removes GedcomEventNote rows (onDelete: Cascade). Re-link the AT Journey attribution note with:\n  npm run link-timeline-events-to-attribution-note -- --execute"
    );
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
