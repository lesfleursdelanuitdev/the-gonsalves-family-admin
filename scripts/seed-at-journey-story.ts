#!/usr/bin/env node
/**
 * Seed the "AT Journey" biography story into the database from
 * data/stories/at-gonsalves-journey.json.
 *
 * - Idempotent: if a story with the same slug already exists in the tree, exits early.
 * - Inlines the chapter/section mapping logic (avoids @/ path alias issues in Node.js).
 * - Requires at least one user in the database; picks an author from an existing story.
 *
 * Usage (from the-gonsalves-family-admin):
 *   node --experimental-strip-types scripts/seed-at-journey-story.ts --dry-run
 *   node --experimental-strip-types scripts/seed-at-journey-story.ts --execute
 *
 * Env: DATABASE_URL, ADMIN_TREE_ID (see .env.local).
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { Prisma, StoryKind, StoryStatus } from "@ligneous/prisma";
import { prisma } from "../lib/database/prisma.ts";
import { getAdminTreeId } from "../lib/infra/admin-tree.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const JSON_PATH = path.resolve(repoRoot, "data/stories/at-gonsalves-journey.json");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

// ── Inline types (avoids @/ imports) ────────────────────────────────────────

type StorySection = {
  id: string;
  title: string;
  subtitle?: string;
  hideTitle?: boolean;
  hideSubtitle?: boolean;
  isChapter?: boolean;
  isPage?: boolean;
  blocks: unknown[];
  children?: StorySection[];
};

type StoryAuthorCredit = {
  id: string;
  name: string;
  authorPrefixMode?: string;
  authorPrefixCustom?: string;
};

type StoryDocument = {
  version: 1;
  id: string;
  title: string;
  slug?: string;
  authors?: StoryAuthorCredit[];
  excerpt?: string;
  status: "draft" | "published";
  kind?: "story" | "article" | "post" | "folklore";
  tags?: string[];
  sections: StorySection[];
  updatedAt: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function docKindToPrisma(kind: string | undefined): StoryKind {
  if (kind === "article") return StoryKind.article;
  if (kind === "post") return StoryKind.post;
  if (kind === "folklore") return StoryKind.folklore;
  return StoryKind.story;
}

function docStatusToPrisma(status: string): StoryStatus {
  return status === "published" ? StoryStatus.published : StoryStatus.draft;
}

function serializeBodyMeta(authors: StoryAuthorCredit[] | undefined): string {
  const credits = (authors ?? []).filter((a) => a.name.trim().length > 0);
  return JSON.stringify({
    v: "ligneous-story-meta/1",
    authors: credits.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      authorPrefixMode: c.authorPrefixMode ?? null,
      authorPrefixCustom: c.authorPrefixCustom ?? null,
    })),
    author: null,
    authorPrefixMode: null,
    authorPrefixCustom: null,
  });
}

type ChapterPayload = {
  title: string;
  sortOrder: number;
  sections: Array<{
    title: string;
    subtitle: string | null;
    hideTitle: boolean;
    hideSubtitle: boolean;
    sortOrder: number;
    isChapter: boolean;
    isPage: boolean;
    contentJson: { blocks: unknown[] };
  }>;
};

function buildChapters(sections: StorySection[]): ChapterPayload[] {
  const chapters: ChapterPayload[] = [];
  for (let i = 0; i < sections.length; i++) {
    const root = sections[i];
    const childList = root.children?.length ? root.children : null;
    if (childList) {
      chapters.push({
        title: root.title,
        sortOrder: i,
        sections: childList.map((ch, j) => ({
          title: ch.title,
          subtitle: ch.subtitle?.trim() || null,
          hideTitle: ch.hideTitle ?? false,
          hideSubtitle: ch.hideSubtitle ?? false,
          sortOrder: j,
          isChapter: j === 0 ? (root.isChapter ?? false) : false,
          isPage: j === 0 ? (root.isPage ?? false) : false,
          contentJson: { blocks: ch.blocks ?? [] },
        })),
      });
    } else {
      chapters.push({
        title: root.title,
        sortOrder: i,
        sections: [
          {
            title: root.title,
            subtitle: root.subtitle?.trim() || null,
            hideTitle: root.hideTitle ?? false,
            hideSubtitle: root.hideSubtitle ?? false,
            sortOrder: 0,
            isChapter: root.isChapter ?? false,
            isPage: root.isPage ?? false,
            contentJson: { blocks: root.blocks ?? [] },
          },
        ],
      });
    }
  }
  return chapters;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  let dryRun = false;
  let execute = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--execute") execute = true;
  }
  return { dryRun, execute };
}

async function resolveAuthorId(): Promise<string> {
  // Prefer the Site Admin role holder.
  const adminRole = await prisma.role.findFirst({
    where: { name: { equals: "Site Admin", mode: "insensitive" } },
    select: { id: true },
  });
  if (adminRole) {
    const adminMember = await prisma.userRole.findFirst({
      where: { roleId: adminRole.id },
      select: { userId: true },
      orderBy: { createdAt: "asc" },
    });
    if (adminMember) return adminMember.userId;
  }

  // Fall back to first user in the system.
  const user = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  if (user) return user.id;
  throw new Error("No users found. Create at least one user first.");
}

async function main() {
  const { dryRun, execute } = parseArgs(process.argv.slice(2));

  if (!dryRun && !execute) {
    console.error("Pass --dry-run to preview, or --execute to write to the database.");
    process.exit(1);
  }

  const raw = await readFile(JSON_PATH, "utf8");
  const doc = JSON.parse(raw) as StoryDocument;

  const treeId = await getAdminTreeId();
  console.log(`treeId=${treeId}`);

  const slug = doc.slug ?? null;
  if (slug) {
    const existing = await prisma.story.findFirst({
      where: { treeId, slug, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
    if (existing) {
      console.log(`Story already exists: "${existing.title}" (id=${existing.id}, status=${existing.status})`);
      console.log("Nothing to do. To re-seed, delete the existing story first.");
      await prisma.$disconnect();
      return;
    }
  }

  const authorId = await resolveAuthorId();
  console.log(`authorId=${authorId}`);
  console.log(`slug=${slug}`);
  console.log(`sections=${doc.sections?.length ?? 0}`);

  const storyId = randomUUID();
  const chapters = buildChapters(doc.sections ?? []);
  const tags = [...new Set((doc.tags ?? []).map((t) => t.trim()).filter(Boolean))];
  const totalSections = chapters.reduce((n, ch) => n + ch.sections.length, 0);

  console.log(`\nPayload summary:`);
  console.log(`  title:    "${doc.title}"`);
  console.log(`  kind:     ${doc.kind ?? "story"} | status: ${doc.status}`);
  console.log(`  chapters: ${chapters.length}`);
  console.log(`  sections: ${totalSections}`);
  console.log(`  tags:     ${tags.join(", ") || "(none)"}`);

  if (dryRun) {
    console.log("\nDry run — no writes.");
    for (const ch of chapters) {
      console.log(`  [chapter] "${ch.title}" (${ch.sections.length} section(s))`);
      for (const sec of ch.sections) {
        const blockCount = (sec.contentJson.blocks as unknown[])?.length ?? 0;
        console.log(`    [section] "${sec.title}" isChapter=${sec.isChapter} blocks=${blockCount}`);
      }
    }
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.story.create({
      data: {
        id: storyId,
        treeId,
        authorId,
        title: doc.title.trim() || "Untitled story",
        slug,
        excerpt: doc.excerpt?.trim().slice(0, 500) || null,
        kind: docKindToPrisma(doc.kind),
        status: docStatusToPrisma(doc.status),
        isPublished: doc.status === "published",
        tags,
        body: serializeBodyMeta(doc.authors),
        coverMediaId: null,
        coverMediaKind: null,
        profileMediaId: null,
        profileMediaKind: null,
        contentVersion: 1,
      },
    });

    for (const ch of chapters) {
      const createdCh = await tx.storyChapter.create({
        data: {
          storyId,
          title: ch.title,
          sortOrder: ch.sortOrder,
        },
      });
      for (const sec of ch.sections) {
        await tx.storySection.create({
          data: {
            chapterId: createdCh.id,
            title: sec.title,
            subtitle: sec.subtitle,
            hideTitle: sec.hideTitle,
            hideSubtitle: sec.hideSubtitle,
            sortOrder: sec.sortOrder,
            isChapter: sec.isChapter,
            isPage: sec.isPage,
            contentJson: sec.contentJson as Prisma.InputJsonValue,
          },
        });
      }
    }
  });

  console.log(`\nCreated story id=${storyId}`);
  console.log(`Open in StoryCreator: /admin/stories/${storyId}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
