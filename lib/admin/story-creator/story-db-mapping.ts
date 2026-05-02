import type { Prisma } from "@ligneous/prisma";
import { StoryCoverMediaKind as PrismaStoryCoverMediaKind, StoryKind, StoryStatus } from "@ligneous/prisma";
import type {
  StoryBlock,
  StoryCoverMediaKind,
  StoryDocument,
  StoryDocumentKind,
  StoryImageMediaRef,
  StoryLifecycleStatus,
  StorySection,
} from "@/lib/admin/story-creator/story-types";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { formatPlaceSuggestionLabel } from "@/lib/forms/admin-place-suggestions";

/** Envelope stored in `StorySection.content_json` (explicit `blocks` array). */
export type StorySectionContentEnvelope = { blocks: StoryBlock[] };

export const STORY_DB_READ_INCLUDE = {
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
  const raw = (doc as unknown as Record<string, unknown>).contentVersion;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
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
      chapters.push({
        title: root.title,
        sortOrder: i,
        slug: null,
        sections: childList.map((ch, j) => ({
          title: ch.title,
          sortOrder: j,
          slug: null,
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
      body: "",
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
        blocks: parseSectionContentJson(s0.contentJson),
      });
    } else {
      roots.push({
        id: ch.id,
        title: ch.title,
        collapsed: false,
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

  const doc: StoryDocument = {
    version: 1,
    id: story.id,
    title: story.title,
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
  };

  return doc;
}
