import type { Prisma } from "@ligneous/prisma";
import { StoryCoverMediaKind as PrismaStoryCoverMediaKind, StoryKind, StoryStatus } from "@ligneous/prisma";
import type {
  StoryAuthorPrefixMode,
  StoryBlock,
  StoryCoverMediaKind,
  StoryDocument,
  StoryDocumentKind,
  StoryImageMediaRef,
  StoryLifecycleStatus,
  StorySection,
} from "@/lib/admin/story-creator/story-types";
import { normalizeStorySlugInput } from "@/lib/admin/story-creator/story-slug";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { formatPlaceSuggestionLabel } from "@/lib/forms/admin-place-suggestions";

/** Envelope stored in `StorySection.content_json` (explicit `blocks` array). */
export type StorySectionContentEnvelope = { blocks: StoryBlock[] };

export const STORY_DB_READ_INCLUDE = {
  author: { select: { id: true, name: true, username: true } },
  chapters: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      sections: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  storyIndividuals: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      individual: { select: { id: true, fullName: true, xref: true } },
    },
  },
  storyFamilies: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      family: { select: { id: true, xref: true } },
    },
  },
  storyEvents: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      event: { select: { id: true, eventType: true, customType: true } },
    },
  },
  storyPlaces: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      place: {
        select: {
          id: true,
          original: true,
          name: true,
          county: true,
          state: true,
          country: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  albumStories: {
    orderBy: { sortOrder: "asc" as const },
    include: { album: { select: { id: true, name: true } } },
  },
} satisfies Prisma.StoryInclude;

export type StoryWithChaptersAndSections = Prisma.StoryGetPayload<{ include: typeof STORY_DB_READ_INCLUDE }>;

export type StoryDbSerializedPayload = {
  story: {
    title: string;
    excerpt: string | null;
    kind: StoryKind;
    status: StoryStatus;
    isPublished: boolean;
    tags: string[];
    coverMediaId: string | null;
    coverMediaKind: PrismaStoryCoverMediaKind | null;
    profileMediaId: string | null;
    profileMediaKind: PrismaStoryCoverMediaKind | null;
    contentVersion: number;
    slug: string | null;
    body: string;
  };
  chapters: Array<{
    title: string;
    sortOrder: number;
    slug: string | null;
    sections: Array<{
      title: string;
      sortOrder: number;
      slug: string | null;
      isChapter: boolean;
      contentJson: StorySectionContentEnvelope;
    }>;
  }>;
  junctions: {
    individualIds: string[];
    familyIds: string[];
    eventIds: string[];
    placeIds: string[];
    albumIds: string[];
    tagNames: string[];
  };
};

function parseSectionContentJson(json: unknown): StoryBlock[] {
  if (!json || typeof json !== "object") return [];
  const blocks = (json as { blocks?: unknown }).blocks;
  return Array.isArray(blocks) ? (blocks as StoryBlock[]) : [];
}

const STORY_META_BODY_V = "ligneous-story-meta/1" as const;

/** Persists author / prefix fields (no dedicated columns yet). */
function serializeStoryBodyMeta(doc: StoryDocument): string {
  return JSON.stringify({
    v: STORY_META_BODY_V,
    author: doc.author ?? null,
    authorPrefixMode: doc.authorPrefixMode ?? null,
    authorPrefixCustom: doc.authorPrefixCustom ?? null,
  });
}

function parseStoryBodyMeta(body: string): Partial<
  Pick<StoryDocument, "author" | "authorPrefixMode" | "authorPrefixCustom">
> {
  const t = (body ?? "").trim();
  if (!t.startsWith("{")) return {};
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    if (o.v !== STORY_META_BODY_V) return {};
    const out: Partial<Pick<StoryDocument, "author" | "authorPrefixMode" | "authorPrefixCustom">> = {};
    if (typeof o.author === "string") out.author = o.author;
    if (
      o.authorPrefixMode === "by" ||
      o.authorPrefixMode === "author_label" ||
      o.authorPrefixMode === "custom" ||
      o.authorPrefixMode === "none"
    ) {
      out.authorPrefixMode = o.authorPrefixMode as StoryAuthorPrefixMode;
    }
    if (typeof o.authorPrefixCustom === "string") out.authorPrefixCustom = o.authorPrefixCustom;
    return out;
  } catch {
    return {};
  }
}

function slugFromDoc(doc: StoryDocument): string | null {
  const n = normalizeStorySlugInput(doc.slug ?? "");
  return n.length > 0 ? n : null;
}

function docKindToPrisma(kind: StoryDocumentKind | undefined): StoryKind {
  const k = kind ?? "story";
  if (k === "article") return StoryKind.article;
  if (k === "post") return StoryKind.post;
  return StoryKind.story;
}

function prismaKindToDoc(kind: StoryKind): StoryDocumentKind {
  if (kind === StoryKind.article) return "article";
  if (kind === StoryKind.post) return "post";
  return "story";
}

function docStatusToPrisma(status: StoryLifecycleStatus): StoryStatus {
  return status === "published" ? StoryStatus.published : StoryStatus.draft;
}

function prismaStatusToDoc(status: StoryStatus): StoryLifecycleStatus {
  if (status === StoryStatus.published) return "published";
  return "draft";
}

function coverFromDoc(doc: StoryDocument): {
  coverMediaId: string | null;
  coverMediaKind: PrismaStoryCoverMediaKind | null;
  profileMediaId: string | null;
  profileMediaKind: PrismaStoryCoverMediaKind | null;
} {
  let coverMediaId: string | null = null;
  let coverMediaKind: PrismaStoryCoverMediaKind | null = null;
  if (doc.coverImage?.mediaId?.trim()) {
    coverMediaId = doc.coverImage.mediaId.trim();
    coverMediaKind = doc.coverImage.mediaKind as PrismaStoryCoverMediaKind;
  } else if (doc.coverMediaId?.trim()) {
    coverMediaId = doc.coverMediaId.trim();
    coverMediaKind = (doc.coverMediaKind as PrismaStoryCoverMediaKind | null) ?? null;
  }

  let profileMediaId: string | null = null;
  let profileMediaKind: PrismaStoryCoverMediaKind | null = null;
  if (doc.profileImage?.mediaId?.trim()) {
    profileMediaId = doc.profileImage.mediaId.trim();
    profileMediaKind = doc.profileImage.mediaKind as PrismaStoryCoverMediaKind;
  }

  return { coverMediaId, coverMediaKind, profileMediaId, profileMediaKind };
}

function readContentVersion(doc: StoryDocument): number {
  const raw = doc.contentVersion;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return 1;
}

/**
 * Maps a client `StoryDocument` into rows for Prisma (story scalars + chapter/section tree + junction inputs).
 * `treeId` / `authorId` are accepted for API symmetry; chapter tree is derived only from `doc.sections`.
 */
export function storyDocumentToDbPayload(doc: StoryDocument, _treeId: string, _authorId: string): StoryDbSerializedPayload {
  void _treeId;
  void _authorId;
  const cover = coverFromDoc(doc);
  const status = docStatusToPrisma(doc.status);
  const tagNames = Array.from(
    new Set(
      (doc.tags ?? [])
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean),
    ),
  );

  const linked = doc.linkedRecords ?? [];
  const individualIds = [...new Set(linked.filter((l) => l.kind === "individual").map((l) => l.id))];
  const familyIds = [...new Set(linked.filter((l) => l.kind === "family").map((l) => l.id))];
  const eventIds = [...new Set(linked.filter((l) => l.kind === "event").map((l) => l.id))];
  const placeIds = [...new Set((doc.placeLinks ?? []).map((p) => p.id).filter(Boolean))];
  const albumIds = [...new Set((doc.linkedAlbums ?? []).map((a) => a.id).filter(Boolean))];

  const chapters: StoryDbSerializedPayload["chapters"] = [];
  const roots = doc.sections ?? [];
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    const childList = root.children?.length ? root.children : null;
    if (childList) {
      const parentChapter = root.isChapter ?? false;
      chapters.push({
        title: root.title,
        sortOrder: i,
        slug: null,
        sections: childList.map((ch, j) => ({
          title: ch.title,
          sortOrder: j,
          slug: null,
          isChapter: j === 0 ? parentChapter : false,
          contentJson: { blocks: ch.blocks ?? [] },
        })),
      });
    } else {
      chapters.push({
        title: root.title,
        sortOrder: i,
        slug: null,
        sections: [
          {
            title: root.title,
            sortOrder: 0,
            slug: null,
            isChapter: root.isChapter ?? false,
            contentJson: { blocks: root.blocks ?? [] },
          },
        ],
      });
    }
  }

  return {
    story: {
      title: doc.title.trim() || "Untitled story",
      excerpt: doc.excerpt?.trim() ? doc.excerpt.trim().slice(0, 500) : null,
      kind: docKindToPrisma(doc.kind),
      status,
      isPublished: doc.status === "published",
      tags: tagNames,
      coverMediaId: cover.coverMediaId,
      coverMediaKind: cover.coverMediaKind,
      profileMediaId: cover.profileMediaId,
      profileMediaKind: cover.profileMediaKind,
      contentVersion: readContentVersion(doc),
      slug: slugFromDoc(doc),
      body: serializeStoryBodyMeta(doc),
    },
    chapters,
    junctions: {
      individualIds,
      familyIds,
      eventIds,
      placeIds,
      albumIds,
      tagNames,
    },
  };
}

function eventLabel(ev: { eventType: string; customType: string | null }): string {
  const t = ev.customType?.trim() || ev.eventType?.trim() || "Event";
  return t;
}

/** Inverse of {@link storyDocumentToDbPayload}: rebuilds `StoryDocument` from a Prisma story + includes. */
export function dbRecordToStoryDocument(story: StoryWithChaptersAndSections): StoryDocument {
  const coverImage: StoryImageMediaRef | undefined =
    story.coverMediaId && story.coverMediaKind
      ? { mediaId: story.coverMediaId, mediaKind: story.coverMediaKind as StoryCoverMediaKind }
      : undefined;

  const profileImage: StoryImageMediaRef | undefined =
    story.profileMediaId && story.profileMediaKind
      ? { mediaId: story.profileMediaId, mediaKind: story.profileMediaKind as StoryCoverMediaKind }
      : undefined;

  const roots: StorySection[] = [];
  const chapters = [...story.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const ch of chapters) {
    const secs = [...ch.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    if (secs.length === 1 && secs[0].title === ch.title) {
      const s0 = secs[0];
      roots.push({
        id: s0.id,
        title: s0.title,
        collapsed: false,
        isChapter: s0.isChapter ?? false,
        blocks: parseSectionContentJson(s0.contentJson),
      });
    } else {
      const chapterFlag = secs[0]?.isChapter ?? false;
      roots.push({
        id: ch.id,
        title: ch.title,
        collapsed: false,
        isChapter: chapterFlag,
        blocks: [],
        children: secs.map((s) => ({
          id: s.id,
          title: s.title,
          collapsed: false,
          blocks: parseSectionContentJson(s.contentJson),
        })),
      });
    }
  }

  const linkedRecords: SelectedNoteLink[] = [];
  for (const row of story.storyIndividuals) {
    const ind = row.individual;
    const label = ind.fullName?.trim() || ind.xref?.trim() || row.individualId;
    linkedRecords.push({ kind: "individual", id: row.individualId, label });
  }
  for (const row of story.storyFamilies) {
    const fam = row.family;
    const label = fam.xref?.trim() || row.familyId;
    linkedRecords.push({ kind: "family", id: row.familyId, label });
  }
  for (const row of story.storyEvents) {
    const ev = row.event;
    linkedRecords.push({ kind: "event", id: row.eventId, label: eventLabel(ev) });
  }

  const placeLinks = story.storyPlaces.map((sp) => {
    const pl = sp.place;
    return {
      id: sp.placeId,
      label: formatPlaceSuggestionLabel({
        id: pl.id,
        original: pl.original,
        name: pl.name,
        county: pl.county,
        state: pl.state,
        country: pl.country,
        latitude: pl.latitude,
        longitude: pl.longitude,
      }),
      name: pl.name,
      original: pl.original,
      county: pl.county,
      state: pl.state,
      country: pl.country,
    };
  });

  const linkedAlbums = story.albumStories.map((as) => ({
    id: as.albumId,
    name: as.album.name?.trim() || as.albumId,
  }));

  const meta = parseStoryBodyMeta(story.body ?? "");
  const authorFallback = story.author?.name?.trim() || story.author?.username?.trim();
  const authorResolved =
    typeof meta.author === "string" && meta.author.trim().length > 0 ? meta.author.trim() : authorFallback || undefined;

  const doc: StoryDocument = {
    version: 1,
    id: story.id,
    title: story.title,
    slug: story.slug ?? undefined,
    excerpt: story.excerpt ?? undefined,
    status: prismaStatusToDoc(story.status),
    kind: prismaKindToDoc(story.kind),
    tags: [...story.tags],
    coverImage,
    profileImage,
    coverMediaId: story.coverMediaId ?? undefined,
    coverMediaKind: story.coverMediaKind ?? undefined,
    linkedAlbums,
    linkedRecords,
    placeLinks,
    sections: roots,
    updatedAt: story.updatedAt.toISOString(),
    contentVersion: story.contentVersion,
    author: authorResolved,
    authorPrefixMode: meta.authorPrefixMode,
    authorPrefixCustom: meta.authorPrefixCustom,
  };

  return doc;
}
