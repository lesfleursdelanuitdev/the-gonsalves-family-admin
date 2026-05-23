/**
 * Place resolution scan — groups GedcomPlace rows that likely refer to the same
 * real-world or historical place.  Results are stored as PlaceResolutionSuggestion
 * + PlaceResolutionSuggestionItem rows.  Nothing is altered on gedcom_places_v2.
 *
 * Five detection phases (run in priority order; a place ID is assigned to at most
 * one suggestion group):
 *   1. exact_normalized   — same lowercased/stripped string, different IDs
 *   2. prefix_match       — one original string is a prefix/suffix component of another
 *   3. component_match    — same country+state, different name component
 *   4. coordinate_proximity — lat/lon within 2 km (in-memory Haversine)
 *   5. fuzzy              — pg_trgm similarity ≥ 0.70 (skipped if extension absent)
 */
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlaceResolutionMatchReason =
  | "exact_normalized"
  | "prefix_match"
  | "component_match"
  | "coordinate_proximity"
  | "fuzzy";

export type PlaceResolutionScanSummary = {
  totalPlaces: number;
  unlinkedPlaces: number;
  suggestionsCreated: number;
  byReason: Record<PlaceResolutionMatchReason, number>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Union-Find ────────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();

  private root(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    const p = this.parent.get(id)!;
    if (p !== id) {
      const r = this.root(p);
      this.parent.set(id, r);
      return r;
    }
    return id;
  }

  union(a: string, b: string): void {
    this.root(a);
    this.root(b);
    this.parent.set(this.root(a), this.root(b));
  }

  groups(): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const id of this.parent.keys()) {
      const r = this.root(id);
      if (!m.has(r)) m.set(r, new Set());
      m.get(r)!.add(id);
    }
    return m;
  }
}

// ── Main scan ─────────────────────────────────────────────────────────────────

type PlaceRow = {
  id: string;
  original: string;
  name: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  normalised: string;
};

export async function runPlaceResolutionScan(fileUuid: string): Promise<PlaceResolutionScanSummary> {
  const allPlaces = await prisma.gedcomPlace.findMany({
    where: { fileUuid },
    include: { resolvedLink: { select: { id: true } } },
  });

  // Only operate on places not yet linked to a ResolvedPlace
  const unlinked = allPlaces.filter((p) => !p.resolvedLink);

  const rows: PlaceRow[] = unlinked.map((p) => ({
    id: p.id,
    original: p.original,
    name: p.name,
    county: p.county,
    state: p.state,
    country: p.country,
    latitude: p.latitude,
    longitude: p.longitude,
    normalised: normalise(p.original),
  }));

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const unlinkedIds = new Set(rows.map((r) => r.id));

  const ufExact     = new UnionFind();
  const ufPrefix    = new UnionFind();
  const ufComponent = new UnionFind();
  const ufCoord     = new UnionFind();
  const ufFuzzy     = new UnionFind();

  // ── Phase 1: exact_normalized ─────────────────────────────────────────────

  const byNorm = new Map<string, PlaceRow[]>();
  for (const r of rows) {
    const bucket = byNorm.get(r.normalised);
    if (bucket) bucket.push(r);
    else byNorm.set(r.normalised, [r]);
  }
  for (const group of byNorm.values()) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) ufExact.union(group[0].id, group[i].id);
  }

  // ── Phase 2: prefix_match ─────────────────────────────────────────────────
  // One normalised string is a proper prefix (followed by comma/space) or suffix
  // component of another.  e.g., "trinidad" ⊂ "port of spain  trinidad".

  const sortedByLen = [...rows].sort((a, b) => a.normalised.length - b.normalised.length);
  for (let i = 0; i < sortedByLen.length; i++) {
    const shorter = sortedByLen[i].normalised;
    for (let j = i + 1; j < sortedByLen.length; j++) {
      const longer = sortedByLen[j].normalised;
      if (longer.length === shorter.length) continue;
      if (
        longer.startsWith(shorter + " ") ||
        longer.startsWith(shorter + ",") ||
        longer.endsWith(" " + shorter) ||
        longer.endsWith(", " + shorter)
      ) {
        ufPrefix.union(sortedByLen[i].id, sortedByLen[j].id);
      }
    }
  }

  // ── Phase 3: component_match ──────────────────────────────────────────────
  // Places with the same country+state but distinct normalised strings.
  // Capped at 8 members to avoid spurious mega-groups (e.g., all of "New York").

  const byCountryState = new Map<string, PlaceRow[]>();
  for (const r of rows) {
    if (!r.country || !r.state) continue;
    const key = `${r.country.toLowerCase()}|||${r.state.toLowerCase()}`;
    const bucket = byCountryState.get(key);
    if (bucket) bucket.push(r);
    else byCountryState.set(key, [r]);
  }
  for (const group of byCountryState.values()) {
    const distinct = group.filter(
      (r, i, arr) => arr.findIndex((x) => x.normalised === r.normalised) === i,
    );
    if (distinct.length < 2 || distinct.length > 8) continue;
    for (let i = 1; i < distinct.length; i++) ufComponent.union(distinct[0].id, distinct[i].id);
  }

  // ── Phase 4: coordinate_proximity (in-memory Haversine ≤ 2 km) ───────────

  const withCoords = rows.filter((r) => r.latitude !== null && r.longitude !== null);
  for (let i = 0; i < withCoords.length; i++) {
    const a = withCoords[i];
    for (let j = i + 1; j < withCoords.length; j++) {
      const b = withCoords[j];
      const km = haversineKm(
        Number(a.latitude), Number(a.longitude),
        Number(b.latitude), Number(b.longitude),
      );
      if (km <= 2) ufCoord.union(a.id, b.id);
    }
  }

  // ── Phase 5: fuzzy (pg_trgm, graceful skip if unavailable) ───────────────

  type FuzzyRow = { id_a: string; id_b: string; sim: number };
  let fuzzyRows: FuzzyRow[] = [];
  try {
    fuzzyRows = await prisma.$queryRaw<FuzzyRow[]>`
      SELECT
        a.id                               AS id_a,
        b.id                               AS id_b,
        similarity(a.original, b.original) AS sim
      FROM gedcom_places_v2 a
      JOIN gedcom_places_v2 b
        ON  a.file_uuid = b.file_uuid
        AND a.id < b.id
        AND similarity(a.original, b.original) >= 0.70
      WHERE a.file_uuid = ${fileUuid}::uuid
      ORDER BY sim DESC
      LIMIT 1000
    `;
  } catch {
    // pg_trgm extension not installed — skip this phase
  }
  for (const row of fuzzyRows) {
    if (unlinkedIds.has(row.id_a) && unlinkedIds.has(row.id_b)) {
      ufFuzzy.union(row.id_a, row.id_b);
    }
  }

  // ── Collect groups (priority order — each ID assigned to at most one group) ─

  type SuggestionGroup = {
    ids: string[];
    reason: PlaceResolutionMatchReason;
    confidence: number;
  };

  const assigned = new Set<string>();
  const suggestions: SuggestionGroup[] = [];

  function collectGroups(uf: UnionFind, reason: PlaceResolutionMatchReason, confidence: number) {
    for (const group of uf.groups().values()) {
      const fresh = [...group].filter((id) => unlinkedIds.has(id) && !assigned.has(id));
      if (fresh.length < 2) continue;
      suggestions.push({ ids: fresh, reason, confidence });
      for (const id of fresh) assigned.add(id);
    }
  }

  collectGroups(ufExact,     "exact_normalized",     95);
  collectGroups(ufPrefix,    "prefix_match",         75);
  collectGroups(ufComponent, "component_match",      65);
  collectGroups(ufCoord,     "coordinate_proximity", 70);
  collectGroups(ufFuzzy,     "fuzzy",                60);

  // ── Build group label ─────────────────────────────────────────────────────

  function groupLabel(group: SuggestionGroup): string {
    const originals = group.ids.map((id) => rowById.get(id)?.original ?? id);
    const count = originals.length;
    if (count === 2) return `${originals[0]} / ${originals[1]}`;
    const shortest = originals.reduce((a, b) => (a.length <= b.length ? a : b));
    return `${shortest} (${count} variants)`;
  }

  // ── Load ignored suggestion sets so re-discovered groups stay ignored ────────
  //
  // If every place ID in a new group was already in the same ignored suggestion,
  // recreate the suggestion as "ignored" rather than surfacing it as "pending" again.

  const ignoredSuggestions = await prisma.placeResolutionSuggestion.findMany({
    where: { fileUuid, status: "ignored" },
    include: { items: { select: { gedcomPlaceId: true } } },
  });
  const ignoredSets = ignoredSuggestions.map((s) => new Set(s.items.map((i) => i.gedcomPlaceId)));

  function wasAlreadyIgnored(ids: string[]): boolean {
    return ignoredSets.some((ignoredSet) => ids.every((id) => ignoredSet.has(id)));
  }

  // ── Persist: replace pending suggestions, create new ones ─────────────────

  await prisma.$transaction(async (tx) => {
    const oldIds = (
      await tx.placeResolutionSuggestion.findMany({
        where: { fileUuid, status: "pending" },
        select: { id: true },
      })
    ).map((s) => s.id);

    if (oldIds.length > 0) {
      await tx.placeResolutionSuggestionItem.deleteMany({ where: { suggestionId: { in: oldIds } } });
      await tx.placeResolutionSuggestion.deleteMany({ where: { id: { in: oldIds } } });
    }

    for (const group of suggestions) {
      const status = wasAlreadyIgnored(group.ids) ? "ignored" : "pending";
      const suggestion = await tx.placeResolutionSuggestion.create({
        data: {
          fileUuid,
          matchReason: group.reason,
          groupLabel: groupLabel(group),
          confidence: group.confidence,
          status,
        },
      });

      // Primary = longest original string (most specific / most detailed entry)
      const members = group.ids.map((id) => rowById.get(id)!).filter(Boolean);
      const primaryId = members.reduce(
        (best, r) => (r.original.length > (rowById.get(best)?.original.length ?? 0) ? r.id : best),
        members[0].id,
      );

      await tx.placeResolutionSuggestionItem.createMany({
        data: group.ids.map((id) => ({
          suggestionId: suggestion.id,
          gedcomPlaceId: id,
          confidence: group.confidence,
          isPrimary: id === primaryId,
        })),
      });
    }
  }, { timeout: 30_000 });

  const byReason: Record<PlaceResolutionMatchReason, number> = {
    exact_normalized:     suggestions.filter((s) => s.reason === "exact_normalized").length,
    prefix_match:         suggestions.filter((s) => s.reason === "prefix_match").length,
    component_match:      suggestions.filter((s) => s.reason === "component_match").length,
    coordinate_proximity: suggestions.filter((s) => s.reason === "coordinate_proximity").length,
    fuzzy:                suggestions.filter((s) => s.reason === "fuzzy").length,
  };

  return {
    totalPlaces: allPlaces.length,
    unlinkedPlaces: unlinked.length,
    suggestionsCreated: suggestions.length,
    byReason,
  };
}
