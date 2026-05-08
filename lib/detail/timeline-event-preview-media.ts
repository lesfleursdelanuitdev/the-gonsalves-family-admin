import type { PrismaClient } from "@ligneous/prisma";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";

/** Server-side raster check aligned with `isLikelyRasterImage` in `lib/admin/mediaPreview.ts`. */
function isLikelyRasterFileRef(fileRef: string, formStr: string | null | undefined): boolean {
  const f = fileRef.trim().toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|bmp|heic|heif)(\?|$)/i.test(f)) return true;
  const fm = (formStr ?? "").toLowerCase();
  if (/\b(jpe?g|png|gif|webp|avif|bmp|heic|heif)\b/.test(fm)) return true;
  return false;
}

function pickRandomRef(pool: { fileRef: string; form: string | null }[]): string | undefined {
  if (!pool.length) return undefined;
  return pool[Math.floor(Math.random() * pool.length)]!.fileRef;
}

/**
 * On a **person** timeline: after event-linked media, whose individual gallery do we search?
 * - Norman’s own rows (`individual`) → Norman (`anchorId`).
 * - Pamela’s birth (`childBirth`) → Pamela (`childIndividualId`).
 * - Family-record rows (`family`) → no person fallback (only images on that family event).
 */
export function previewMediaFallbackIndividualId(
  e: IndividualDetailEvent,
  anchorPersonId: string,
): string | null {
  if (e.source === "family") return null;
  switch (e.source) {
    case "individual":
      return anchorPersonId;
    case "spouseBirth":
    case "spouseDeath":
      return e.spouseIndividualId?.trim() ? e.spouseIndividualId : null;
    case "childBirth":
    case "childDeath":
    case "childMarriage":
    case "grandchildBirth":
    case "grandchildDeath":
      return e.childIndividualId?.trim() ? e.childIndividualId : null;
    case "parentDeath":
    case "grandparentDeath":
      return e.spouseIndividualId?.trim() ? e.spouseIndividualId : null;
    case "siblingDeath":
      return e.childIndividualId?.trim() ? e.childIndividualId : null;
    default:
      return null;
  }
}

export type AttachTimelinePreviewMediaOpts = {
  /**
   * `individual` — event media (+ event profile) first, then the **principal person’s** profile media.
   * `family` — event-linked media (+ event profile) only (no person fallback).
   */
  mode: "individual" | "family";
  /** Timeline subject (e.g. Norman); used for `source === "individual"` rows only. */
  anchorIndividualId?: string | null;
};

/**
 * Sets `previewMediaFileRef` on each row:
 * 1. Raster images tied to the **event**: junction (`gedcom_event_media`) plus optional event
 *    profile/cover (`gedcom_event_profile_media`). If several, one is chosen at random.
 * 2. Person timeline (`individual` mode): if none, use that row’s **principal person’s** profile
 *    picture only (`gedcom_individual_profile_media`), not their full media gallery.
 * 3. Family timeline / note mode (`family`): step 1 only (no person fallback).
 */
export async function attachTimelineEventPreviewMedia(
  prisma: PrismaClient,
  fileUuid: string,
  events: IndividualDetailEvent[],
  opts: AttachTimelinePreviewMediaOpts,
): Promise<void> {
  const eventIds = [...new Set(events.map((e) => e.eventId).filter(Boolean))] as string[];

  function pushEventRaster(eventId: string, fileRef: string, form: string | null) {
    const list = byEvent.get(eventId) ?? [];
    if (list.some((x) => x.fileRef === fileRef)) return;
    list.push({ fileRef, form });
    byEvent.set(eventId, list);
  }

  const byEvent = new Map<string, { fileRef: string; form: string | null }[]>();
  if (eventIds.length > 0) {
    const links = await prisma.gedcomEventMedia.findMany({
      where: { fileUuid, eventId: { in: eventIds } },
      select: {
        eventId: true,
        media: { select: { fileRef: true, form: true } },
      },
    });
    for (const row of links) {
      const ref = row.media.fileRef?.trim();
      if (!ref || !isLikelyRasterFileRef(ref, row.media.form)) continue;
      pushEventRaster(row.eventId, ref, row.media.form);
    }

    const eventProfiles = await prisma.gedcomEventProfileMedia.findMany({
      where: { fileUuid, eventId: { in: eventIds } },
      select: {
        eventId: true,
        media: { select: { fileRef: true, form: true } },
      },
    });
    for (const row of eventProfiles) {
      const ref = row.media.fileRef?.trim();
      if (!ref || !isLikelyRasterFileRef(ref, row.media.form)) continue;
      pushEventRaster(row.eventId, ref, row.media.form);
    }
  }

  /** At most one profile media row per individual (schema: `individualId` unique). */
  const byIndividualProfile = new Map<string, { fileRef: string; form: string | null }>();
  if (opts.mode === "individual" && opts.anchorIndividualId) {
    const anchorId = opts.anchorIndividualId;
    const fallbackIds = [
      ...new Set(
        events
          .map((e) => previewMediaFallbackIndividualId(e, anchorId))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (fallbackIds.length > 0) {
      const profRows = await prisma.gedcomIndividualProfileMedia.findMany({
        where: { fileUuid, individualId: { in: fallbackIds } },
        select: {
          individualId: true,
          media: { select: { fileRef: true, form: true } },
        },
      });
      for (const row of profRows) {
        const ref = row.media.fileRef?.trim();
        if (!ref || !isLikelyRasterFileRef(ref, row.media.form)) continue;
        byIndividualProfile.set(row.individualId, { fileRef: ref, form: row.media.form });
      }
    }
  }

  for (const e of events) {
    const eventPool = e.eventId ? byEvent.get(e.eventId) : undefined;
    const fromEvent = pickRandomRef(eventPool ?? []);
    if (fromEvent) {
      e.previewMediaFileRef = fromEvent;
      continue;
    }

    if (opts.mode !== "individual" || !opts.anchorIndividualId) continue;
    const fbId = previewMediaFallbackIndividualId(e, opts.anchorIndividualId);
    if (!fbId) continue;
    const prof = byIndividualProfile.get(fbId);
    if (prof) e.previewMediaFileRef = prof.fileRef;
  }
}
