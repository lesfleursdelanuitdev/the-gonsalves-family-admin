#!/usr/bin/env node
/**
 * Find all notes connected to "Mary Mias Gonsalves" or "Mary Mias Gracis"
 */
// Run with: node --env-file=.env.local scripts/find-mary-notes.mjs
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEARCH_NAMES = ["mary mias"];

async function main() {
  // Find individuals matching the names (case-insensitive)
  const individuals = await prisma.gedcomIndividual.findMany({
    where: {
      OR: SEARCH_NAMES.map((n) => ({
        fullName: { contains: n.replace(/\//g, "").trim(), mode: "insensitive" },
      })),
    },
    select: {
      id: true,
      xref: true,
      fullName: true,
      fileUuid: true,
      individualNotes: {
        include: {
          note: { select: { id: true, xref: true, content: true } },
        },
      },
    },
  });

  if (individuals.length === 0) {
    console.log("No individuals found matching 'Mary Mias Gonsalves' or 'Mary Mias Gracis'");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${individuals.length} individual(s):\n`);

  const allNotes = [];
  for (const indi of individuals) {
    console.log(`--- ${indi.fullName} (${indi.xref}) ---`);
    for (const junction of indi.individualNotes) {
      const n = junction.note;
      console.log(`\nNote ${n.xref || n.id}:`);
      console.log(n.content);
      console.log("");
      allNotes.push({ individual: indi.fullName, xref: indi.xref, note: n });
    }
    if (indi.individualNotes.length === 0) {
      console.log("  (no direct notes)");
    }
    console.log("");
  }

  // Also check family notes where Mary is spouse
  const indiIds = individuals.map((i) => i.id);
  const familiesAsWife = await prisma.gedcomFamily.findMany({
    where: { wifeId: { in: indiIds } },
    include: {
      familyNotes: { include: { note: { select: { id: true, xref: true, content: true } } } },
    },
  });
  const familiesAsHusband = await prisma.gedcomFamily.findMany({
    where: { husbandId: { in: indiIds } },
    include: {
      familyNotes: { include: { note: { select: { id: true, xref: true, content: true } } } },
    },
  });

  const allFamilies = [...familiesAsWife, ...familiesAsHusband];
  if (allFamilies.length > 0) {
    console.log("\n--- Family notes (Mary as spouse) ---\n");
    for (const fam of allFamilies) {
      const role = fam.wifeId ? "wife" : "husband";
      const indi = individuals.find((i) => i.id === (fam.wifeId || fam.husbandId));
      for (const fn of fam.familyNotes) {
        console.log(`Family ${fam.xref} (Mary as ${role}):`);
        console.log(`Note ${fn.note.xref || fn.note.id}:`);
        console.log(fn.note.content);
        console.log("");
        allNotes.push({
          individual: indi?.fullName,
          context: `Family ${fam.xref} (${role})`,
          note: fn.note,
        });
      }
    }
  }

  // Event notes (notes on events linked to the individual)
  const eventNotes = await prisma.gedcomIndividualEvent.findMany({
    where: { individualId: { in: indiIds } },
    include: {
      event: {
        include: {
          eventNotes: { include: { note: { select: { id: true, xref: true, content: true } } } },
        },
      },
    },
  });

  for (const ie of eventNotes) {
    for (const en of ie.event.eventNotes) {
      const indi = individuals.find((i) => i.id === ie.individualId);
      console.log(`\n--- Event note (${ie.event.eventType}, ${indi?.fullName}) ---\n`);
      console.log(`Note ${en.note.xref || en.note.id}:`);
      console.log(en.note.content);
      console.log("");
      allNotes.push({
        individual: indi?.fullName,
        context: `Event: ${ie.event.eventType}`,
        note: en.note,
      });
    }
  }

  console.log(`\nTotal notes found: ${allNotes.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
