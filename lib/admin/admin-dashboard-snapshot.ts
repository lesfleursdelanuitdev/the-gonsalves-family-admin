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

export type DashboardHeatmapDay = {
  /** UTC calendar date `YYYY-MM-DD`. */
  date: string;
  count: number;
};

export type DashboardArchiveHealth = {
  /** Rounded mean of the six completeness percentages (0–100). */
  score: number;
  linkedMediaPct: number;
  datedEventsPct: number;
  geocodedPlacesPct: number;
  sourcedFactsPct: number;
  peopleWithPhotosPct: number;
  peopleWithStoriesPct: number;
};

export type DashboardNewThisWeek = {
  individuals: number;
  media: number;
  events: number;
};

export type DashboardInsightsPayload = {
  topSurnames: { name: string; count: number }[];
  birthsByDecade: { decade: number; count: number }[];
  branchSlices: { label: string; count: number }[];
  topBirthPlaces: { label: string; count: number }[];
  mediaCoverage: { label: string; pct: number; countLabel?: string }[];
  /**
   * Always `[]` — generation coverage was removed from the UI.
   * Kept on the payload so older cached dashboard bundles do not call `.map` on `undefined`.
   */
  generationCoverage: { generation: number; pct: number; total: number }[];
};

export type DashboardDiscoveryItem = {
  id: string;
  kind: "media" | "changelog" | "open_question" | "place" | "merge";
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  imageFileRef: string | null;
  imageForm: string | null;
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
  /** When the GEDCOM was last parsed, else file metadata fallback. */
  lastImportAt: string | null;
  newThisWeek: DashboardNewThisWeek;
  archiveHealth: DashboardArchiveHealth;
  heatmap: DashboardHeatmapDay[];
  insights: DashboardInsightsPayload;
  discoveries: DashboardDiscoveryItem[];
  pendingPlaceGroups: number;
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

function pctRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return denominator <= 0 && numerator <= 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((100 * numerator) / denominator));
}

function buildHeatmapSeries(
  rows: ReadonlyArray<{ d: Date; c: bigint }>,
): DashboardHeatmapDay[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = r.d.toISOString().slice(0, 10);
    byDay.set(key, Number(r.c));
  }
  const out: DashboardHeatmapDay[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    dt.setUTCDate(dt.getUTCDate() - i);
    const date = dt.toISOString().slice(0, 10);
    out.push({ date, count: byDay.get(date) ?? 0 });
  }
  return out;
}

function meanRounded(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return 0;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
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
    gedcomFile,
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
    eventsWithDate,
    placesTotal,
    placesGeocoded,
    individualsSourced,
    individualsNoPhoto,
    disconnectedPeople,
    draftStoriesCount,
    newIndividualsWeek,
    newMediaWeek,
    newEventsWeek,
    topSurnameRows,
    birthsByDecadeRows,
    topBirthPlaceRows,
    heatmapRows,
    duplicateCandidates,
    peopleInStoriesRow,
    pendingPlaceGroups,
  ] = await Promise.all([
    prisma.gedcomFile.findUnique({
      where: { id: fileUuid },
      select: { parsedAt: true, updatedAt: true, createdAt: true },
    }),
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
    loadRecentChangelogBatches(fileUuid, 14),
    prisma.gedcomEvent.count({ where: { fileUuid, dateId: { not: null } } }),
    prisma.gedcomPlace.count({ where: { fileUuid } }),
    prisma.gedcomPlace.count({ where: { fileUuid, latitude: { not: null } } }),
    prisma.gedcomIndividual.count({ where: { fileUuid, individualSources: { some: {} } } }),
    prisma.gedcomIndividual.count({
      where: {
        fileUuid,
        individualMedia: { none: {} },
        profileMediaSelection: { is: null },
      },
    }),
    prisma.gedcomIndividual.count({
      where: {
        fileUuid,
        parentAsChild: { none: {} },
        familyChildAsChild: { none: {} },
        husbandInFamilies: { none: {} },
        wifeInFamilies: { none: {} },
      },
    }),
    treeRow
      ? prisma.story.count({ where: { treeId: treeRow.id, deletedAt: null, status: "draft" } })
      : Promise.resolve(0),
    prisma.gedcomIndividual.count({ where: { fileUuid, createdAt: { gte: sevenDaysAgo } } }),
    prisma.gedcomMedia.count({ where: { fileUuid, createdAt: { gte: sevenDaysAgo } } }),
    prisma.gedcomEvent.count({ where: { fileUuid, createdAt: { gte: sevenDaysAgo } } }),
    prisma.gedcomSurname.findMany({
      where: { fileUuid },
      orderBy: { frequency: "desc" },
      take: 10,
      select: { surname: true, frequency: true },
    }),
    prisma.$queryRaw<{ decade_start: number; c: bigint }[]>`
      SELECT (FLOOR(g.birth_year / 10) * 10)::int AS decade_start, COUNT(*)::bigint AS c
      FROM gedcom_individuals_v2 g
      WHERE g.file_uuid = ${fileUuid}::uuid
        AND g.birth_year IS NOT NULL
        AND g.birth_year >= 1700
        AND g.birth_year <= 2035
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ label: string; c: bigint }[]>`
      SELECT COALESCE(NULLIF(TRIM(g.birth_place_display), ''), '—') AS label, COUNT(*)::bigint AS c
      FROM gedcom_individuals_v2 g
      WHERE g.file_uuid = ${fileUuid}::uuid
      GROUP BY 1
      ORDER BY COUNT(*) DESC NULLS LAST
      LIMIT 8
    `,
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', cl.created_at AT TIME ZONE 'UTC')::date AS d,
             COUNT(*)::bigint AS c
      FROM change_log cl
      WHERE cl.file_uuid = ${fileUuid}::uuid
        AND cl.undone_at IS NULL
        AND cl.created_at >= (NOW() AT TIME ZONE 'UTC' - INTERVAL '90 days')
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COALESCE(SUM(x.c - 1), 0)::bigint AS n
      FROM (
        SELECT COUNT(*)::bigint AS c
        FROM gedcom_individuals_v2 i
        WHERE i.file_uuid = ${fileUuid}::uuid
          AND i.primary_surname_lower IS NOT NULL
          AND i.primary_surname_lower <> ''
          AND i.birth_year IS NOT NULL
        GROUP BY i.primary_surname_lower, i.birth_year
        HAVING COUNT(*) > 1
      ) x
    `,
    treeRow
      ? prisma.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(DISTINCT si.individual_id)::bigint AS c
          FROM story_individuals si
          INNER JOIN stories s ON s.id = si.story_id
          WHERE s.tree_id = ${treeRow.id}::uuid AND s.deleted_at IS NULL
        `
      : Promise.resolve([{ c: BigInt(0) }]),
    prisma.placeResolutionSuggestion.count({ where: { fileUuid, status: "pending" } }),
  ]);

  const messageRows = treeId ? await loadRecentMessages(userId, treeId, 14) : [];
  const activity = mergeActivity(changelogRows, messageRows, 12);

  const linkedMedia = Math.max(0, media - unlinkedMedia);
  const linkedMediaPct = pctRatio(linkedMedia, media);
  const datedEventsPct = pctRatio(eventsWithDate, events);
  const geocodedPlacesPct = pctRatio(placesGeocoded, placesTotal);
  const sourcedFactsPct = pctRatio(individualsSourced, individuals);
  const peopleWithPhotosPct = pctRatio(individuals - individualsNoPhoto, individuals);
  const peopleInStories = Number(peopleInStoriesRow[0]?.c ?? BigInt(0));
  const peopleWithStoriesPct = pctRatio(peopleInStories, individuals);

  const archiveHealth: DashboardArchiveHealth = {
    score: meanRounded([
      linkedMediaPct,
      datedEventsPct,
      geocodedPlacesPct,
      sourcedFactsPct,
      peopleWithPhotosPct,
      peopleWithStoriesPct,
    ]),
    linkedMediaPct,
    datedEventsPct,
    geocodedPlacesPct,
    sourcedFactsPct,
    peopleWithPhotosPct,
    peopleWithStoriesPct,
  };

  const dupCount = Number(duplicateCandidates[0]?.n ?? BigInt(0));

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
      id: "people-no-photo",
      label: "People without photos",
      count: individualsNoPhoto,
      href: "/admin/individuals",
      description: "Profile and linked portraits bring the archive to life.",
    },
    {
      id: "unlinked-media",
      label: "Media not linked to records",
      count: unlinkedMedia,
      href: "/admin/media",
      description: "Link photos and documents to people, families, or events.",
    },
    {
      id: "duplicates",
      label: "Possible duplicate clusters",
      count: dupCount,
      href: "/admin/merge-records?tab=duplicates",
      description: "Same surname and birth year groups worth a second look.",
    },
    {
      id: "disconnected",
      label: "People without family links",
      count: disconnectedPeople,
      href: "/admin/individuals",
      description: "No recorded parents, spouse, or children yet.",
    },
    {
      id: "draft-stories",
      label: "Stories still in draft",
      count: draftStoriesCount,
      href: "/admin/stories",
      description: "Publish when you are ready to share narrative work.",
    },
    {
      id: "place-resolution",
      label: "Place groups needing resolution",
      count: pendingPlaceGroups,
      href: "/admin/place-resolution",
      description: "Possible duplicate or related place entries found by the scanner.",
    },
  ];

  const needsAttentionTotal = needsAttention.reduce((s, r) => s + r.count, 0);

  const lastImportAt =
    gedcomFile?.parsedAt?.toISOString() ??
    gedcomFile?.updatedAt?.toISOString() ??
    gedcomFile?.createdAt?.toISOString() ??
    null;

  const heatmap = buildHeatmapSeries(heatmapRows);

  const topSurnames = topSurnameRows.map((r) => ({
    name: r.surname.trim() || "—",
    count: r.frequency,
  }));

  const birthsByDecade = birthsByDecadeRows.map((r) => ({
    decade: r.decade_start,
    count: Number(r.c),
  }));

  const branchTop = topSurnameRows.slice(0, 5);
  const branchSum = branchTop.reduce((s, r) => s + r.frequency, 0);
  const branchOther = Math.max(0, individuals - branchSum);
  const branchSlices =
    branchTop.length > 0
      ? [
          ...branchTop.map((r) => ({ label: r.surname.trim() || "—", count: r.frequency })),
          ...(branchOther > 0 ? [{ label: "Other surnames", count: branchOther }] : []),
        ]
      : [];

  const topBirthPlaces = topBirthPlaceRows
    .filter((r) => r.label !== "—")
    .map((r) => ({ label: r.label, count: Number(r.c) }));

  const insights: DashboardInsightsPayload = {
    topSurnames,
    birthsByDecade,
    branchSlices,
    topBirthPlaces,
    mediaCoverage: [
      { label: "People with photos", pct: peopleWithPhotosPct },
      { label: "Linked media", pct: linkedMediaPct },
      { label: "Dated events", pct: datedEventsPct },
      { label: "Individuals with sources", pct: sourcedFactsPct },
    ],
    generationCoverage: [],
  };

  const [latestMedia, latestOpenQuestion] = await Promise.all([
    prisma.gedcomMedia.findFirst({
      where: {
        fileUuid,
        fileRef: { not: null },
        OR: [
          { individualMedia: { some: {} } },
          { familyMedia: { some: {} } },
          { eventMedia: { some: {} } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, fileRef: true, form: true },
    }),
    prisma.openQuestion.findFirst({
      where: { fileUuid, status: "open" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, question: true },
    }),
  ]);

  const discoveries: DashboardDiscoveryItem[] = [];

  if (latestMedia?.fileRef) {
    discoveries.push({
      id: `media-${latestMedia.id}`,
      kind: "media",
      title: "Recently linked media",
      description: truncate(latestMedia.title?.trim() || "A new object in the archive.", 140),
      href: `/admin/media/${latestMedia.id}`,
      ctaLabel: "Open in media",
      imageFileRef: latestMedia.fileRef,
      imageForm: latestMedia.form,
    });
  }

  const topChangelog = changelogRows[0];
  if (topChangelog) {
    discoveries.push({
      id: `changelog-${topChangelog.batchId}`,
      kind: "changelog",
      title: "Latest tree activity",
      description: truncate(topChangelog.summary?.trim() || "Edits recorded in the changelog.", 160),
      href: `/admin/changelog/${encodeURIComponent(topChangelog.batchId)}`,
      ctaLabel: "Review batch",
      imageFileRef: null,
      imageForm: null,
    });
  }

  if (latestOpenQuestion) {
    discoveries.push({
      id: `oq-${latestOpenQuestion.id}`,
      kind: "open_question",
      title: "Open research question",
      description: truncate(latestOpenQuestion.question, 160),
      href: "/admin/open-questions",
      ctaLabel: "Open questions",
      imageFileRef: null,
      imageForm: null,
    });
  }

  if (topBirthPlaces[0]) {
    discoveries.push({
      id: `place-${topBirthPlaces[0].label}`,
      kind: "place",
      title: "Place spotlight",
      description: `${topBirthPlaces[0].count.toLocaleString()} birth records mention “${topBirthPlaces[0].label}”.`,
      href: "/admin/places",
      ctaLabel: "Browse places",
      imageFileRef: null,
      imageForm: null,
    });
  }

  if (dupCount > 0) {
    discoveries.push({
      id: "merge-hint",
      kind: "merge",
      title: "Possible matches in the tree",
      description: `${dupCount.toLocaleString()} extra individuals sit in same-name, same-birth-year groups.`,
      href: "/admin/merge-records?tab=duplicates",
      ctaLabel: "Review merge tools",
      imageFileRef: null,
      imageForm: null,
    });
  }

  const discoveriesTrimmed = discoveries.slice(0, 4);

  return {
    totals: { individuals, families, events, media, notes, sources, stories },
    recentUpdatesCount,
    activity,
    needsAttention,
    needsAttentionTotal,
    lastImportAt,
    newThisWeek: {
      individuals: newIndividualsWeek,
      media: newMediaWeek,
      events: newEventsWeek,
    },
    archiveHealth,
    heatmap,
    insights,
    discoveries: discoveriesTrimmed,
    pendingPlaceGroups,
  };
}
