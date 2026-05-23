import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/database/prisma";
import type { CheckCategory, BatchAction, CheckResult, HealthRecord } from "./types";

const STALE_DAYS = 30;
const INACTIVE_DAYS = 90;

export type CheckContext = {
  treeId: string;
  fileUuid: string;
  mediaRoot: string;
};

type CheckDef = {
  key: string;
  label: string;
  description: string;
  category: CheckCategory;
  batchAction: BatchAction | null;
  count(ctx: CheckContext): Promise<number>;
  records(ctx: CheckContext, offset: number, limit: number): Promise<HealthRecord[]>;
  batch(ctx: CheckContext, ids?: string[]): Promise<number>;
};

function fileExists(mediaRoot: string, fileRef: string): boolean {
  const rel = fileRef.replace(/^\/+/, "");
  return fs.existsSync(path.join(mediaRoot, rel));
}

function staleCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - STALE_DAYS);
  return d;
}

function inactiveCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - INACTIVE_DAYS);
  return d;
}

// ─── Individual checks ────────────────────────────────────────────────────────

const CHECKS: CheckDef[] = [

  // ── Media ────────────────────────────────────────────────────────────────────

  {
    key: "media_broken_files",
    label: "Media with missing files",
    description: "Media records whose file no longer exists on disk.",
    category: "media",
    batchAction: "delete",
    async count(ctx) {
      const rows = await prisma.gedcomMedia.findMany({
        where: { fileUuid: ctx.fileUuid, fileRef: { not: null } },
        select: { id: true, fileRef: true },
      });
      return rows.filter((r) => !fileExists(ctx.mediaRoot, r.fileRef!)).length;
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomMedia.findMany({
        where: { fileUuid: ctx.fileUuid, fileRef: { not: null } },
        select: { id: true, fileRef: true, title: true },
      });
      const broken = rows.filter((r) => !fileExists(ctx.mediaRoot, r.fileRef!));
      return broken.slice(offset, offset + limit).map((r) => ({
        id: r.id,
        label: r.title ?? r.fileRef!,
        sublabel: r.fileRef ?? undefined,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : (() => {
            throw new Error("ids required for media_broken_files batch");
          })();
      const { count } = await prisma.gedcomMedia.deleteMany({ where });
      return count;
    },
  },

  {
    key: "gedcom_media_no_entity",
    label: "Orphaned GEDCOM media",
    description: "GEDCOM media objects not linked to any individual, family, event, source, story, or album.",
    category: "media",
    batchAction: "delete",
    async count(ctx) {
      return prisma.gedcomMedia.count({
        where: {
          fileUuid: ctx.fileUuid,
          individualMedia: { none: {} },
          individualProfileFor: { none: {} },
          familyMedia: { none: {} },
          familyProfileFor: { none: {} },
          sourceMedia: { none: {} },
          eventMedia: { none: {} },
          eventProfileFor: { none: {} },
          placeLinks: { none: {} },
          dateLinks: { none: {} },
          albumLinks: { none: {} },
          appTags: { none: {} },
          tagProfileFor: { none: {} },
          compoundMedia: { none: {} },
          storyGedcomMedia: { none: {} },
          openQuestionMedia: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomMedia.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          individualMedia: { none: {} },
          individualProfileFor: { none: {} },
          familyMedia: { none: {} },
          familyProfileFor: { none: {} },
          sourceMedia: { none: {} },
          eventMedia: { none: {} },
          eventProfileFor: { none: {} },
          placeLinks: { none: {} },
          dateLinks: { none: {} },
          albumLinks: { none: {} },
          appTags: { none: {} },
          tagProfileFor: { none: {} },
          compoundMedia: { none: {} },
          storyGedcomMedia: { none: {} },
          openQuestionMedia: { none: {} },
        },
        select: { id: true, title: true, fileRef: true, form: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title ?? r.fileRef ?? r.id,
        meta: r.form ?? undefined,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            fileUuid: ctx.fileUuid,
            individualMedia: { none: {} },
            individualProfileFor: { none: {} },
            familyMedia: { none: {} },
            familyProfileFor: { none: {} },
            sourceMedia: { none: {} },
            eventMedia: { none: {} },
            eventProfileFor: { none: {} },
            placeLinks: { none: {} },
            dateLinks: { none: {} },
            albumLinks: { none: {} },
            appTags: { none: {} },
            tagProfileFor: { none: {} },
            compoundMedia: { none: {} },
            storyGedcomMedia: { none: {} },
            openQuestionMedia: { none: {} },
          };
      const { count } = await prisma.gedcomMedia.deleteMany({ where });
      return count;
    },
  },

  {
    key: "site_media_no_entity",
    label: "Orphaned site media",
    description: "Uploaded site media not linked to any story or album.",
    category: "media",
    batchAction: "delete",
    async count(ctx) {
      return prisma.siteMedia.count({
        where: {
          treeId: ctx.treeId,
          deletedAt: null,
          storySiteMedia: { none: {} },
          albums: { none: {} },
          compound: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.siteMedia.findMany({
        where: {
          treeId: ctx.treeId,
          deletedAt: null,
          storySiteMedia: { none: {} },
          albums: { none: {} },
          compound: { none: {} },
        },
        select: { id: true, title: true, fileRef: true, mimeType: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title ?? r.fileRef ?? r.id,
        sublabel: r.mimeType ?? undefined,
        meta: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            treeId: ctx.treeId,
            deletedAt: null,
            storySiteMedia: { none: {} },
            albums: { none: {} },
            compound: { none: {} },
          };
      const { count } = await prisma.siteMedia.deleteMany({ where });
      return count;
    },
  },

  // ── Data integrity ───────────────────────────────────────────────────────────

  {
    key: "gedcom_notes_no_entity",
    label: "Orphaned notes",
    description: "GEDCOM notes not attached to any individual, family, event, source, story, or open question.",
    category: "data_integrity",
    batchAction: "delete",
    async count(ctx) {
      return prisma.gedcomNote.count({
        where: {
          fileUuid: ctx.fileUuid,
          individualNotes: { none: {} },
          familyNotes: { none: {} },
          eventNotes: { none: {} },
          sourceNotes: { none: {} },
          storyLinks: { none: {} },
          openQuestionNotes: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomNote.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          individualNotes: { none: {} },
          familyNotes: { none: {} },
          eventNotes: { none: {} },
          sourceNotes: { none: {} },
          storyLinks: { none: {} },
          openQuestionNotes: { none: {} },
        },
        select: { id: true, xref: true, content: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.xref ?? `Note ${r.id.slice(0, 8)}`,
        sublabel: r.content.slice(0, 100) + (r.content.length > 100 ? "…" : ""),
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            fileUuid: ctx.fileUuid,
            individualNotes: { none: {} },
            familyNotes: { none: {} },
            eventNotes: { none: {} },
            sourceNotes: { none: {} },
            storyLinks: { none: {} },
            openQuestionNotes: { none: {} },
          };
      const { count } = await prisma.gedcomNote.deleteMany({ where });
      return count;
    },
  },

  {
    key: "gedcom_sources_no_citations",
    label: "Uncited sources",
    description: "GEDCOM sources with no citations on any individual, family, event, story, or open question.",
    category: "data_integrity",
    batchAction: "delete",
    async count(ctx) {
      return prisma.gedcomSource.count({
        where: {
          fileUuid: ctx.fileUuid,
          individualSources: { none: {} },
          familySources: { none: {} },
          eventSources: { none: {} },
          storySources: { none: {} },
          openQuestionSources: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomSource.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          individualSources: { none: {} },
          familySources: { none: {} },
          eventSources: { none: {} },
          storySources: { none: {} },
          openQuestionSources: { none: {} },
        },
        select: { id: true, xref: true, title: true, author: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title ?? r.xref,
        sublabel: r.author ?? undefined,
        meta: r.xref,
        href: `/admin/sources`,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            fileUuid: ctx.fileUuid,
            individualSources: { none: {} },
            familySources: { none: {} },
            eventSources: { none: {} },
            storySources: { none: {} },
            openQuestionSources: { none: {} },
          };
      const { count } = await prisma.gedcomSource.deleteMany({ where });
      return count;
    },
  },

  {
    key: "tags_no_entities",
    label: "Unused tags",
    description: "Tags not applied to any entity.",
    category: "data_integrity",
    batchAction: "delete",
    async count(_ctx) {
      return prisma.tag.count({
        where: {
          items: { none: {} },
          gedcomMediaAppTags: { none: {} },
          siteMediaTags: { none: {} },
          userMediaTags: { none: {} },
          storyTags: { none: {} },
          profileMediaRows: { none: {} },
        },
      });
    },
    async records(_ctx, offset, limit) {
      const rows = await prisma.tag.findMany({
        where: {
          items: { none: {} },
          gedcomMediaAppTags: { none: {} },
          siteMediaTags: { none: {} },
          userMediaTags: { none: {} },
          storyTags: { none: {} },
          profileMediaRows: { none: {} },
        },
        select: { id: true, name: true, isGlobal: true, color: true },
        skip: offset,
        take: limit,
        orderBy: { name: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        meta: r.isGlobal ? "global" : "user",
        href: `/admin/tags`,
      }));
    },
    async batch(_ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            items: { none: {} },
            gedcomMediaAppTags: { none: {} },
            siteMediaTags: { none: {} },
            userMediaTags: { none: {} },
            storyTags: { none: {} },
            profileMediaRows: { none: {} },
          };
      const { count } = await prisma.tag.deleteMany({ where });
      return count;
    },
  },

  {
    key: "individuals_no_family_links",
    label: "Isolated individuals",
    description: "Individuals with no parents, no children, and no spouse — possible import artifacts.",
    category: "data_integrity",
    batchAction: null,
    async count(ctx) {
      return prisma.gedcomIndividual.count({
        where: {
          fileUuid: ctx.fileUuid,
          hasParents: false,
          hasChildren: false,
          hasSpouse: false,
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomIndividual.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          hasParents: false,
          hasChildren: false,
          hasSpouse: false,
        },
        select: { id: true, xref: true, fullName: true, birthDateDisplay: true, deathDateDisplay: true },
        skip: offset,
        take: limit,
        orderBy: { fullName: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.fullName ?? r.xref,
        sublabel: r.xref,
        meta: [r.birthDateDisplay, r.deathDateDisplay].filter(Boolean).join(" – ") || undefined,
        href: `/admin/individuals/${r.id}/edit`,
      }));
    },
    async batch() { return 0; },
  },

  {
    key: "events_no_individuals",
    label: "Orphaned events",
    description: "Events not linked to any individual or family.",
    category: "data_integrity",
    batchAction: "delete",
    async count(ctx) {
      return prisma.gedcomEvent.count({
        where: {
          fileUuid: ctx.fileUuid,
          individualEvents: { none: {} },
          familyEvents: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomEvent.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          individualEvents: { none: {} },
          familyEvents: { none: {} },
        },
        select: { id: true, eventType: true, customType: true, value: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.customType ?? r.eventType,
        sublabel: r.value ?? undefined,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            fileUuid: ctx.fileUuid,
            individualEvents: { none: {} },
            familyEvents: { none: {} },
          };
      const { count } = await prisma.gedcomEvent.deleteMany({ where });
      return count;
    },
  },

  {
    key: "stories_no_subjects",
    label: "Stories without subjects",
    description: "Published stories not linked to any individual, family, place, or event.",
    category: "data_integrity",
    batchAction: null,
    async count(ctx) {
      return prisma.story.count({
        where: {
          treeId: ctx.treeId,
          isPublished: true,
          deletedAt: null,
          subjects: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.story.findMany({
        where: {
          treeId: ctx.treeId,
          isPublished: true,
          deletedAt: null,
          subjects: { none: {} },
        },
        select: { id: true, title: true, kind: true, publishedAt: true },
        skip: offset,
        take: limit,
        orderBy: { publishedAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title,
        meta: r.kind,
        href: `/admin/stories/${r.id}`,
      }));
    },
    async batch() { return 0; },
  },

  {
    key: "albums_no_media",
    label: "Empty albums",
    description: "Albums with no media items.",
    category: "data_integrity",
    batchAction: "delete",
    async count(ctx) {
      return prisma.album.count({
        where: {
          treeId: ctx.treeId,
          albumGedcomMedia: { none: {} },
          siteMedia: { none: {} },
          userMedia: { none: {} },
          albumMedia: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.album.findMany({
        where: {
          treeId: ctx.treeId,
          albumGedcomMedia: { none: {} },
          siteMedia: { none: {} },
          userMedia: { none: {} },
          albumMedia: { none: {} },
        },
        select: { id: true, name: true, scope: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        meta: r.scope,
        href: `/admin/albums/${r.id}`,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            treeId: ctx.treeId,
            albumGedcomMedia: { none: {} },
            siteMedia: { none: {} },
            userMedia: { none: {} },
            albumMedia: { none: {} },
          };
      const { count } = await prisma.album.deleteMany({ where });
      return count;
    },
  },

  // ── Community ────────────────────────────────────────────────────────────────

  {
    key: "pending_registrations_old",
    label: `Stale registration requests (>${STALE_DAYS}d)`,
    description: `Registration requests that have been pending for more than ${STALE_DAYS} days.`,
    category: "community",
    batchAction: "archive",
    async count(_ctx) {
      return prisma.registrationRequest.count({
        where: { status: "pending", createdAt: { lt: staleCutoff() } },
      });
    },
    async records(_ctx, offset, limit) {
      const rows = await prisma.registrationRequest.findMany({
        where: { status: "pending", createdAt: { lt: staleCutoff() } },
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: `${r.firstName} ${r.lastName}`,
        sublabel: r.email,
        meta: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        href: `/admin/registration-requests/${r.id}`,
      }));
    },
    async batch(_ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { status: "pending" as const, createdAt: { lt: staleCutoff() } };
      const { count } = await prisma.registrationRequest.updateMany({
        where,
        data: { status: "archived" },
      });
      return count;
    },
  },

  {
    key: "pending_access_requests_old",
    label: `Stale access requests (>${STALE_DAYS}d)`,
    description: `Access requests that have been pending for more than ${STALE_DAYS} days.`,
    category: "community",
    batchAction: "archive",
    async count(_ctx) {
      return prisma.accessRequest.count({
        where: { status: "pending", requestedAt: { lt: staleCutoff() } },
      });
    },
    async records(_ctx, offset, limit) {
      const rows = await prisma.accessRequest.findMany({
        where: { status: "pending", requestedAt: { lt: staleCutoff() } },
        select: { id: true, requestType: true, requestedAt: true, user: { select: { name: true, username: true, email: true } } },
        skip: offset,
        take: limit,
        orderBy: { requestedAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.user.name?.trim() || r.user.username,
        sublabel: r.user.email,
        meta: r.requestedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        href: `/admin/access-requests/${r.id}`,
      }));
    },
    async batch(_ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { status: "pending" as const, requestedAt: { lt: staleCutoff() } };
      const { count } = await prisma.accessRequest.updateMany({
        where,
        data: { status: "cancelled" },
      });
      return count;
    },
  },

  {
    key: "contact_messages_unanswered",
    label: `Unanswered site messages (>${STALE_DAYS}d)`,
    description: `Contact messages with no reply and no status update after ${STALE_DAYS} days.`,
    category: "community",
    batchAction: "archive",
    async count(ctx) {
      return prisma.contactMessage.count({
        where: {
          treeId: ctx.treeId,
          status: { in: ["pending", "reviewed"] },
          createdAt: { lt: staleCutoff() },
          replies: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.contactMessage.findMany({
        where: {
          treeId: ctx.treeId,
          status: { in: ["pending", "reviewed"] },
          createdAt: { lt: staleCutoff() },
          replies: { none: {} },
        },
        select: { id: true, subject: true, firstName: true, lastName: true, email: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.subject ?? "(no subject)",
        sublabel: `${[r.firstName, r.lastName].filter(Boolean).join(" ")} <${r.email}>`,
        meta: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        href: `/admin/contact-inbox/${r.id}`,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { treeId: ctx.treeId, status: { in: ["pending" as const, "reviewed" as const] }, createdAt: { lt: staleCutoff() }, replies: { none: {} } };
      const { count } = await prisma.contactMessage.updateMany({
        where,
        data: { status: "archived" },
      });
      return count;
    },
  },

  {
    key: "pending_contributions_old",
    label: `Stale contributions (>${STALE_DAYS}d)`,
    description: `Contributions that have been pending for more than ${STALE_DAYS} days.`,
    category: "community",
    batchAction: "archive",
    async count(ctx) {
      return prisma.contribution.count({
        where: { treeId: ctx.treeId, status: "pending", createdAt: { lt: staleCutoff() } },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.contribution.findMany({
        where: { treeId: ctx.treeId, status: "pending", createdAt: { lt: staleCutoff() } },
        select: { id: true, type: true, contributorFirstName: true, contributorLastName: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: `${r.contributorFirstName} ${r.contributorLastName}`,
        meta: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        href: `/admin/contributions/${r.id}`,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { treeId: ctx.treeId, status: "pending" as const, createdAt: { lt: staleCutoff() } };
      const { count } = await prisma.contribution.updateMany({
        where,
        data: { status: "archived" },
      });
      return count;
    },
  },

  // ── User hygiene ─────────────────────────────────────────────────────────────

  {
    key: "users_no_role",
    label: "Users with no role",
    description: "Registered users with no role assignment.",
    category: "user_hygiene",
    batchAction: null,
    async count(_ctx) {
      return prisma.user.count({
        where: { isActive: true, userRoles: { none: {} } },
      });
    },
    async records(_ctx, offset, limit) {
      const rows = await prisma.user.findMany({
        where: { isActive: true, userRoles: { none: {} } },
        select: { id: true, username: true, name: true, email: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name?.trim() || r.username,
        sublabel: r.email,
        meta: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        href: `/admin/users/${r.id}`,
      }));
    },
    async batch() { return 0; },
  },

  {
    key: "users_never_logged_in",
    label: `Users never logged in (>${INACTIVE_DAYS}d)`,
    description: `Accounts created more than ${INACTIVE_DAYS} days ago that have never logged in.`,
    category: "user_hygiene",
    batchAction: null,
    async count(_ctx) {
      return prisma.user.count({
        where: {
          isActive: true,
          lastLoginAt: null,
          createdAt: { lt: inactiveCutoff() },
        },
      });
    },
    async records(_ctx, offset, limit) {
      const rows = await prisma.user.findMany({
        where: {
          isActive: true,
          lastLoginAt: null,
          createdAt: { lt: inactiveCutoff() },
        },
        select: { id: true, username: true, name: true, email: true, createdAt: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name?.trim() || r.username,
        sublabel: r.email,
        meta: `Created ${r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        href: `/admin/users/${r.id}`,
      }));
    },
    async batch() { return 0; },
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export const CHECK_KEYS = CHECKS.map((c) => c.key);

export function getCheck(key: string): CheckDef | undefined {
  return CHECKS.find((c) => c.key === key);
}

export async function runAllChecks(ctx: CheckContext): Promise<CheckResult[]> {
  return Promise.all(
    CHECKS.map(async (c) => ({
      checkKey: c.key,
      label: c.label,
      description: c.description,
      category: c.category,
      batchAction: c.batchAction,
      count: await c.count(ctx).catch(() => -1),
    })),
  );
}

export async function buildCheckContext(): Promise<CheckContext> {
  const { getAdminFileUuid, getAdminTreeId } = await import("../infra/admin-tree.ts");
  const [treeId, fileUuid] = await Promise.all([getAdminTreeId(), getAdminFileUuid()]);
  const mediaRoot = process.env.ADMIN_MEDIA_FILES_ROOT ?? "/mnt/storage/uploads";
  return { treeId, fileUuid, mediaRoot };
}
