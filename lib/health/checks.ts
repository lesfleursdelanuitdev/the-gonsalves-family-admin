import fs from "node:fs";
import { prisma } from "@/lib/database/prisma";
import {
  resolveFileRefToGedcomAdminDiskPath,
  resolveFileRefToSiteMediaDiskPath,
} from "@/lib/admin/resolve-file-ref-to-gedcom-disk-path";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { CheckCategory, BatchAction, CheckResult, HealthRecord } from "./types";

const STALE_DAYS = 30;
const INACTIVE_DAYS = 90;

export type CheckContext = {
  treeId: string;
  fileUuid: string;
  suppressed: Map<string, Set<string>>;
};

function suppressedFor(ctx: CheckContext, key: string): string[] {
  return Array.from(ctx.suppressed.get(key) ?? []);
}

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

function gedcomFileExists(fileRef: string): boolean {
  const diskPath = resolveFileRefToGedcomAdminDiskPath(fileRef);
  return diskPath != null && fs.existsSync(diskPath);
}

function siteMediaFileExists(fileRef: string): boolean {
  const diskPath = resolveFileRefToSiteMediaDiskPath(fileRef);
  return diskPath != null && fs.existsSync(diskPath);
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
      const sup = new Set(suppressedFor(ctx, "media_broken_files"));
      const rows = await prisma.gedcomMedia.findMany({
        where: { fileUuid: ctx.fileUuid, fileRef: { not: null } },
        select: { id: true, fileRef: true },
      });
      return rows.filter((r) => !gedcomFileExists(r.fileRef!) && !sup.has(r.id)).length;
    },
    async records(ctx, offset, limit) {
      const sup = new Set(suppressedFor(ctx, "media_broken_files"));
      const rows = await prisma.gedcomMedia.findMany({
        where: { fileUuid: ctx.fileUuid, fileRef: { not: null } },
        select: { id: true, fileRef: true, title: true },
      });
      const broken = rows.filter((r) => !gedcomFileExists(r.fileRef!) && !sup.has(r.id));
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
    key: "site_media_broken_files",
    label: "Site media with missing files",
    description: "Uploaded site media records whose file no longer exists on disk.",
    category: "media",
    batchAction: "delete",
    async count(ctx) {
      const sup = new Set(suppressedFor(ctx, "site_media_broken_files"));
      const rows = await prisma.siteMedia.findMany({
        where: { treeId: ctx.treeId, deletedAt: null, fileRef: { not: null } },
        select: { id: true, fileRef: true },
      });
      return rows.filter((r) => !siteMediaFileExists(r.fileRef!) && !sup.has(r.id)).length;
    },
    async records(ctx, offset, limit) {
      const sup = new Set(suppressedFor(ctx, "site_media_broken_files"));
      const rows = await prisma.siteMedia.findMany({
        where: { treeId: ctx.treeId, deletedAt: null, fileRef: { not: null } },
        select: { id: true, fileRef: true, title: true, mimeType: true },
      });
      const broken = rows.filter((r) => !siteMediaFileExists(r.fileRef!) && !sup.has(r.id));
      return broken.slice(offset, offset + limit).map((r) => ({
        id: r.id,
        label: r.title ?? r.fileRef!,
        sublabel: r.fileRef ?? undefined,
        meta: r.mimeType ?? undefined,
      }));
    },
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : (() => {
            throw new Error("ids required for site_media_broken_files batch");
          })();
      const { count } = await prisma.siteMedia.deleteMany({ where });
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
          id: { notIn: suppressedFor(ctx, "gedcom_media_no_entity") },
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
          id: { notIn: suppressedFor(ctx, "gedcom_media_no_entity") },
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
          id: { notIn: suppressedFor(ctx, "gedcom_notes_no_entity") },
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
          id: { notIn: suppressedFor(ctx, "gedcom_notes_no_entity") },
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
          id: { notIn: suppressedFor(ctx, "gedcom_sources_no_citations") },
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
          id: { notIn: suppressedFor(ctx, "gedcom_sources_no_citations") },
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
    async count(ctx) {
      return prisma.tag.count({
        where: {
          id: { notIn: suppressedFor(ctx, "tags_no_entities") },
          items: { none: {} },
          gedcomMediaAppTags: { none: {} },
          siteMediaTags: { none: {} },
          userMediaTags: { none: {} },
          storyTags: { none: {} },
          profileMediaRows: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.tag.findMany({
        where: {
          id: { notIn: suppressedFor(ctx, "tags_no_entities") },
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
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : {
            id: { notIn: suppressedFor(ctx, "tags_no_entities") },
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
    description: "Individuals with no parents, no children, no spouse, and no associate relationships — possible import artifacts.",
    category: "data_integrity",
    batchAction: null,
    async count(ctx) {
      return prisma.gedcomIndividual.count({
        where: {
          fileUuid: ctx.fileUuid,
          id: { notIn: suppressedFor(ctx, "individuals_no_family_links") },
          hasParents: false,
          hasChildren: false,
          hasSpouse: false,
          associationsAsSubject: { none: {} },
          associationsWhereAssociate: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomIndividual.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          id: { notIn: suppressedFor(ctx, "individuals_no_family_links") },
          hasParents: false,
          hasChildren: false,
          hasSpouse: false,
          associationsAsSubject: { none: {} },
          associationsWhereAssociate: { none: {} },
        },
        select: { id: true, xref: true, fullName: true, birthDateDisplay: true, deathDateDisplay: true },
        skip: offset,
        take: limit,
        orderBy: { fullName: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: stripSlashesFromName(r.fullName) || r.xref,
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
    description: "Events not linked to any individual, family, story, open question, or note.",
    category: "data_integrity",
    batchAction: "delete",
    async count(ctx) {
      return prisma.gedcomEvent.count({
        where: {
          fileUuid: ctx.fileUuid,
          id: { notIn: suppressedFor(ctx, "events_no_individuals") },
          individualEvents: { none: {} },
          familyEvents: { none: {} },
          storyEvents: { none: {} },
          openQuestionEvents: { none: {} },
          eventNotes: { none: {} },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.gedcomEvent.findMany({
        where: {
          fileUuid: ctx.fileUuid,
          id: { notIn: suppressedFor(ctx, "events_no_individuals") },
          individualEvents: { none: {} },
          familyEvents: { none: {} },
          storyEvents: { none: {} },
          openQuestionEvents: { none: {} },
          eventNotes: { none: {} },
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
            storyEvents: { none: {} },
            openQuestionEvents: { none: {} },
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
          id: { notIn: suppressedFor(ctx, "stories_no_subjects") },
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
          id: { notIn: suppressedFor(ctx, "stories_no_subjects") },
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
          id: { notIn: suppressedFor(ctx, "albums_no_media") },
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
          id: { notIn: suppressedFor(ctx, "albums_no_media") },
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
    async count(ctx) {
      return prisma.registrationRequest.count({
        where: { id: { notIn: suppressedFor(ctx, "pending_registrations_old") }, status: "pending", createdAt: { lt: staleCutoff() } },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.registrationRequest.findMany({
        where: { id: { notIn: suppressedFor(ctx, "pending_registrations_old") }, status: "pending", createdAt: { lt: staleCutoff() } },
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
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { id: { notIn: suppressedFor(ctx, "pending_registrations_old") }, status: "pending" as const, createdAt: { lt: staleCutoff() } };
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
    async count(ctx) {
      return prisma.accessRequest.count({
        where: { id: { notIn: suppressedFor(ctx, "pending_access_requests_old") }, status: "pending", requestedAt: { lt: staleCutoff() } },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.accessRequest.findMany({
        where: { id: { notIn: suppressedFor(ctx, "pending_access_requests_old") }, status: "pending", requestedAt: { lt: staleCutoff() } },
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
    async batch(ctx, ids) {
      const where = ids?.length
        ? { id: { in: ids } }
        : { id: { notIn: suppressedFor(ctx, "pending_access_requests_old") }, status: "pending" as const, requestedAt: { lt: staleCutoff() } };
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
          id: { notIn: suppressedFor(ctx, "contact_messages_unanswered") },
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
          id: { notIn: suppressedFor(ctx, "contact_messages_unanswered") },
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
        : { treeId: ctx.treeId, id: { notIn: suppressedFor(ctx, "contact_messages_unanswered") }, status: { in: ["pending" as const, "reviewed" as const] }, createdAt: { lt: staleCutoff() }, replies: { none: {} } };
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
        where: { treeId: ctx.treeId, id: { notIn: suppressedFor(ctx, "pending_contributions_old") }, status: "pending", createdAt: { lt: staleCutoff() } },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.contribution.findMany({
        where: { treeId: ctx.treeId, id: { notIn: suppressedFor(ctx, "pending_contributions_old") }, status: "pending", createdAt: { lt: staleCutoff() } },
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
        : { treeId: ctx.treeId, id: { notIn: suppressedFor(ctx, "pending_contributions_old") }, status: "pending" as const, createdAt: { lt: staleCutoff() } };
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
    async count(ctx) {
      return prisma.user.count({
        where: { id: { notIn: suppressedFor(ctx, "users_no_role") }, isActive: true, userRoles: { none: {} } },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.user.findMany({
        where: { id: { notIn: suppressedFor(ctx, "users_no_role") }, isActive: true, userRoles: { none: {} } },
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
    async count(ctx) {
      return prisma.user.count({
        where: {
          id: { notIn: suppressedFor(ctx, "users_never_logged_in") },
          isActive: true,
          lastLoginAt: null,
          createdAt: { lt: inactiveCutoff() },
        },
      });
    },
    async records(ctx, offset, limit) {
      const rows = await prisma.user.findMany({
        where: {
          id: { notIn: suppressedFor(ctx, "users_never_logged_in") },
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
  const [treeId, fileUuid, suppressionRows] = await Promise.all([
    getAdminTreeId(),
    getAdminFileUuid(),
    prisma.siteHealthSuppression.findMany({ select: { checkKey: true, recordId: true } }),
  ]);
  const suppressed = new Map<string, Set<string>>();
  for (const { checkKey, recordId } of suppressionRows) {
    if (!suppressed.has(checkKey)) suppressed.set(checkKey, new Set());
    suppressed.get(checkKey)!.add(recordId);
  }
  return { treeId, fileUuid, suppressed };
}
