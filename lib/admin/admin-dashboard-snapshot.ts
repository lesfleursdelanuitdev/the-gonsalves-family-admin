import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import {
  getAdminTreeCommunityUserIds,
  messageParticipantWhere,
  treeScopedMessageWhere,
} from "@/lib/admin/admin-message-tree-scope";

export type DashboardChangelogRow = {
  batchId: string;
  summary: string | null;
  createdAt: string;
  userName: string | null;
  username: string;
};

export type DashboardMessageRow = {
  id: string;
  subject: string | null;
  content: string;
  createdAt: string;
  senderName: string | null;
  senderUsername: string;
};

export type DashboardActivityItem =
  | {
      kind: "changelog";
      id: string;
      headline: string;
      body: string;
      occurredAt: string;
      actor: string;
    }
  | {
      kind: "message";
      id: string;
      headline: string;
      body: string;
      occurredAt: string;
      actor: string;
    };

export type DashboardNeedsAttentionRow = {
  id: string;
  label: string;
  count: number;
  href: string;
  description: string;
};

export type AdminDashboardSnapshot = {
  totals: {
    individuals: number;
    families: number;
    events: number;
    media: number;
    notes: number;
    sources: number;
    stories: number;
  };
  recentUpdatesCount: number;
  activity: DashboardActivityItem[];
  needsAttention: DashboardNeedsAttentionRow[];
  needsAttentionTotal: number;
};

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function loadRecentChangelogBatches(fileUuid: string, take: number): Promise<DashboardChangelogRow[]> {
  const rows = await prisma.$queryRaw<
    {
      batch_id: string;
      summary: string | null;
      created_at: Date;
      user_id: string;
      username: string;
      user_name: string | null;
    }[]
  >(Prisma.sql`
    SELECT
      cl.batch_id,
      MAX(cl.summary) AS summary,
      MIN(cl.created_at) AS created_at,
      cl.user_id,
      u.username,
      u.name AS user_name
    FROM change_log cl
    JOIN users u ON u.id = cl.user_id
    WHERE cl.file_uuid = ${fileUuid}::uuid
      AND cl.undone_at IS NULL
    GROUP BY cl.batch_id, cl.user_id, u.username, u.name
    ORDER BY MIN(cl.created_at) DESC
    LIMIT ${take}
  `);
  return rows.map((r) => ({
    batchId: r.batch_id,
    summary: r.summary,
    createdAt: r.created_at.toISOString(),
    userName: r.user_name,
    username: r.username,
  }));
}

async function recentUpdatesBatchCount(fileUuid: string, since: Date): Promise<number> {
  const rows = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT batch_id)::bigint AS c
      FROM change_log
      WHERE file_uuid = ${fileUuid}::uuid
        AND undone_at IS NULL
        AND created_at >= ${since}
    `,
  );
  const v = rows[0]?.c;
  return v != null ? Number(v) : 0;
}

async function loadRecentMessages(userId: string, treeId: string, take: number): Promise<DashboardMessageRow[]> {
  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const scope = treeScopedMessageWhere(treeId, communityIds);
  const participant = messageParticipantWhere(userId);
  const where: Prisma.MessageWhereInput = { AND: [scope, participant] };

  const messages = await prisma.message.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      content: true,
      createdAt: true,
      sender: { select: { name: true, username: true } },
    },
  });

  return messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    senderName: m.sender.name,
    senderUsername: m.sender.username,
  }));
}

function mergeActivity(
  changelog: DashboardChangelogRow[],
  messages: DashboardMessageRow[],
  maxItems: number,
): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [];

  for (const c of changelog) {
    const actor = c.userName?.trim() || c.username;
    const headline = c.summary?.trim() || "Tree update";
    items.push({
      kind: "changelog",
      id: c.batchId,
      headline,
      body: truncate(`Changes in this tree · ${actor}`, 120),
      occurredAt: c.createdAt,
      actor,
    });
  }

  for (const m of messages) {
    const actor = m.senderName?.trim() || m.senderUsername;
    const headline = m.subject?.trim() || "Message";
    items.push({
      kind: "message",
      id: m.id,
      headline,
      body: truncate(m.content, 140),
      occurredAt: m.createdAt,
      actor,
    });
  }

  items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return items.slice(0, maxItems);
}

/**
 * Aggregates counts, recent activity, and “needs attention” rows for the admin dashboard.
 * Call only when `fileUuid` is known (tree configured).
 */
export async function buildAdminDashboardSnapshot(
  fileUuid: string,
  userId: string,
  treeId: string | null,
): Promise<AdminDashboardSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const treeRow = await prisma.tree.findFirst({
    where: { gedcomFileId: fileUuid },
    select: { id: true },
  });

  const [
    individuals,
    families,
    events,
    media,
    notes,
    sources,
    stories,
    mediaNoDates,
    eventsNoPlace,
    unlinkedMedia,
    recentUpdatesCount,
    changelogRows,
  ] = await Promise.all([
    prisma.gedcomIndividual.count({ where: { fileUuid } }),
    prisma.gedcomFamily.count({ where: { fileUuid } }),
    prisma.gedcomEvent.count({ where: { fileUuid } }),
    prisma.gedcomMedia.count({ where: { fileUuid } }),
    prisma.gedcomNote.count({ where: { fileUuid } }),
    prisma.gedcomSource.count({ where: { fileUuid } }),
    treeRow
      ? prisma.story.count({ where: { treeId: treeRow.id, deletedAt: null } })
      : Promise.resolve(0),
    prisma.gedcomMedia.count({ where: { fileUuid, dateLinks: { none: {} } } }),
    prisma.gedcomEvent.count({ where: { fileUuid, placeId: null } }),
    prisma.gedcomMedia.count({
      where: {
        fileUuid,
        individualMedia: { none: {} },
        familyMedia: { none: {} },
        eventMedia: { none: {} },
        sourceMedia: { none: {} },
      },
    }),
    recentUpdatesBatchCount(fileUuid, sevenDaysAgo),
    loadRecentChangelogBatches(fileUuid, 12),
  ]);

  const messageRows = treeId ? await loadRecentMessages(userId, treeId, 12) : [];
  const activity = mergeActivity(changelogRows, messageRows, 3);

  const needsAttention: DashboardNeedsAttentionRow[] = [
    {
      id: "media-dates",
      label: "Media without linked dates",
      count: mediaNoDates,
      href: "/admin/media",
      description: "Link dates in the media editor to improve timelines.",
    },
    {
      id: "events-places",
      label: "Events missing a place",
      count: eventsNoPlace,
      href: "/admin/events",
      description: "Add places to strengthen maps and narrative context.",
    },
    {
      id: "unlinked-media",
      label: "Media not linked to records",
      count: unlinkedMedia,
      href: "/admin/media",
      description: "Link photos and documents to people, families, or events.",
    },
  ];

  const needsAttentionTotal = needsAttention.reduce((s, r) => s + r.count, 0);

  return {
    totals: { individuals, families, events, media, notes, sources, stories },
    recentUpdatesCount,
    activity,
    needsAttention,
    needsAttentionTotal,
  };
}
