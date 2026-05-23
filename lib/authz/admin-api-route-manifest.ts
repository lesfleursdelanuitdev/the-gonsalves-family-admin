/**
 * Admin API Route Permission Manifest
 *
 * Documents the permission requirement for every admin API route.
 * Used as a reference for auditing and as the basis for the manifest
 * coverage test in admin-api-route-manifest.test.ts.
 *
 * Each entry maps a route-pattern (relative to /api/admin/, using `:param`
 * notation) to one of:
 *   - { kind: "requireCan", entity, action, scope }  — explicit permission check
 *   - { kind: "requireWebsiteOwner" }                 — website-owner-only
 *   - { kind: "inlinePermissionCheck" }               — inline can() call in route body
 *   - { kind: "authOnly", reason }                    — withAdminAuth sufficient; documented why
 */

export type RouteMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type PermissionRequirement =
  | { kind: "requireCan"; entity: string; action: string; scope: string }
  | { kind: "requireWebsiteOwner" }
  | { kind: "inlinePermissionCheck" }
  | { kind: "authOnly"; reason: string };

export type RouteManifestEntry = {
  pattern: string;
  methods: RouteMethod[];
  permission: PermissionRequirement;
};

export const ADMIN_API_ROUTE_MANIFEST: RouteManifestEntry[] = [
  // ── Setup / system ─────────────────────────────────────────────────────────
  {
    pattern: "setup",
    methods: ["GET"],
    permission: { kind: "requireWebsiteOwner" },
  },
  {
    pattern: "authz/crud",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "Helper that checks caller's own permissions; only reveals what the requester can do.",
    },
  },

  // ── Dashboard / analytics ───────────────────────────────────────────────────
  {
    pattern: "dashboard",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "analytics/:segment",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "statistics-analytics",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },

  // ── Individuals ─────────────────────────────────────────────────────────────
  {
    pattern: "individuals",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/events",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "event", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/references",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/user-links",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/notes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "note", action: "update", scope: "tree" },
  },
  {
    pattern: "individuals/:id/profile-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },
  {
    pattern: "individuals/:id/relationships",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/associates",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individuals/:id/add-child",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },

  // ── Families ────────────────────────────────────────────────────────────────
  {
    pattern: "families",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "family", action: "read", scope: "tree" },
  },
  {
    pattern: "families/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "family", action: "read", scope: "tree" },
  },
  {
    pattern: "families/:id/events",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "event", action: "read", scope: "tree" },
  },
  {
    pattern: "families/:id/membership",
    methods: ["GET", "POST", "DELETE"],
    permission: { kind: "requireCan", entity: "family", action: "update", scope: "tree" },
  },
  {
    pattern: "families/:id/notes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "note", action: "update", scope: "tree" },
  },
  {
    pattern: "families/:id/profile-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "family", action: "update", scope: "tree" },
  },

  // ── Events ──────────────────────────────────────────────────────────────────
  {
    pattern: "events",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "event", action: "read", scope: "tree" },
  },
  {
    pattern: "events/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "event", action: "read", scope: "tree" },
  },
  {
    pattern: "events/:id/notes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "note", action: "update", scope: "tree" },
  },
  {
    pattern: "events/:id/profile-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "event", action: "update", scope: "tree" },
  },

  // ── Places ──────────────────────────────────────────────────────────────────
  {
    pattern: "places",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "place", action: "read", scope: "tree" },
  },
  {
    pattern: "places/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "place", action: "read", scope: "tree" },
  },

  // ── Dates ───────────────────────────────────────────────────────────────────
  {
    pattern: "dates",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "date", action: "read", scope: "tree" },
  },
  {
    pattern: "dates/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "date", action: "read", scope: "tree" },
  },

  // ── Names ───────────────────────────────────────────────────────────────────
  {
    pattern: "given-names",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "givenName", action: "read", scope: "tree" },
  },
  {
    pattern: "given-names/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "givenName", action: "read", scope: "tree" },
  },
  {
    pattern: "surnames",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "lastName", action: "read", scope: "tree" },
  },
  {
    pattern: "surnames/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "lastName", action: "read", scope: "tree" },
  },

  // ── Notes ───────────────────────────────────────────────────────────────────
  {
    pattern: "notes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "note", action: "read", scope: "tree" },
  },
  {
    pattern: "notes/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "note", action: "read", scope: "tree" },
  },
  {
    pattern: "notes/:id/events",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "note", action: "update", scope: "tree" },
  },

  // ── Sources ─────────────────────────────────────────────────────────────────
  {
    pattern: "sources",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "sources/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "sources/:id/individual-sources",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "sources/:id/individual-sources/:linkId",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "source", action: "update", scope: "tree" },
  },
  {
    pattern: "sources/:id/family-sources",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "sources/:id/family-sources/:linkId",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "source", action: "update", scope: "tree" },
  },
  {
    pattern: "sources/:id/event-sources",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "sources/:id/event-sources/:linkId",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "source", action: "update", scope: "tree" },
  },
  {
    pattern: "sources/:id/notes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },

  // ── Repositories ────────────────────────────────────────────────────────────
  {
    pattern: "repositories",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },
  {
    pattern: "repositories/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "source", action: "read", scope: "tree" },
  },

  // ── Media ───────────────────────────────────────────────────────────────────
  {
    pattern: "media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "tree" },
  },
  {
    pattern: "media/upload",
    methods: ["POST"],
    permission: {
      kind: "inlinePermissionCheck",
    },
  },
  {
    pattern: "media/thumb/**",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "File serving endpoint; auth-protection prevents public file access. Permission granularity not needed for reads.",
    },
  },
  {
    pattern: "media/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "tree" },
  },
  {
    pattern: "media/:id/individual-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/individual-media/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/family-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/family-media/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/event-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/event-media/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/place-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/place-media/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/source-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/source-media/:linkId",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/date-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/date-media/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/album-links",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/album-links/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/app-tags",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media/:id/app-tags/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "tree" },
  },
  {
    pattern: "media-set-count",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "Lightweight count helper; tree-scoped via fileUuid, no sensitive data returned.",
    },
  },

  // ── Site media ──────────────────────────────────────────────────────────────
  {
    pattern: "site-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "site" },
  },
  {
    pattern: "site-media/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "site" },
  },
  {
    pattern: "site-media/:id/album-links",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "site" },
  },
  {
    pattern: "site-media/:id/album-links/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "site" },
  },
  {
    pattern: "site-media/:id/app-tags",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "site" },
  },
  {
    pattern: "site-media/:id/app-tags/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "site" },
  },

  // ── User media ──────────────────────────────────────────────────────────────
  {
    pattern: "user-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "user" },
  },
  {
    pattern: "user-media/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "read", scope: "user" },
  },
  {
    pattern: "user-media/:id/album-links",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "user" },
  },
  {
    pattern: "user-media/:id/album-links/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "user" },
  },
  {
    pattern: "user-media/:id/app-tags",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "user" },
  },
  {
    pattern: "user-media/:id/app-tags/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "media", action: "update", scope: "user" },
  },

  // ── Albums ──────────────────────────────────────────────────────────────────
  {
    pattern: "albums",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "album", action: "read", scope: "tree" },
  },
  {
    pattern: "albums/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "album", action: "read", scope: "tree" },
  },
  {
    pattern: "albums/:id/export",
    methods: ["GET"],
    // Owner check is enforced via DB query (userId: user.id); only user's own albums exported.
    permission: { kind: "requireCan", entity: "album", action: "read", scope: "user" },
  },
  {
    pattern: "album-view",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "Read-only display helper; curated albums are user-scoped via userId DB filter; generated albums have no sensitive scope.",
    },
  },

  // ── Tags ────────────────────────────────────────────────────────────────────
  {
    pattern: "tags",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "tag", action: "read", scope: "tree" },
  },
  {
    pattern: "tags/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "tag", action: "read", scope: "tree" },
  },
  {
    pattern: "tags/:id/profile-media",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "tag", action: "update", scope: "tree" },
  },
  {
    pattern: "tagged-items/batch",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "tag", action: "update", scope: "tree" },
  },

  // ── Stories ─────────────────────────────────────────────────────────────────
  {
    pattern: "stories",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "story", action: "read", scope: "tree" },
  },
  {
    pattern: "stories/:storyId",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "story", action: "read", scope: "tree" },
  },
  {
    pattern: "stories/check-slug",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "story", action: "read", scope: "tree" },
  },

  // ── Glossary ────────────────────────────────────────────────────────────────
  {
    pattern: "glossary",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "story", action: "read", scope: "tree" },
  },
  {
    pattern: "glossary/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "story", action: "read", scope: "tree" },
  },

  // ── Recipes ─────────────────────────────────────────────────────────────────
  {
    pattern: "recipes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "recipe", action: "read", scope: "tree" },
  },
  {
    pattern: "recipes/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "recipe", action: "read", scope: "tree" },
  },

  // ── Open questions ──────────────────────────────────────────────────────────
  {
    pattern: "open-questions",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "openQuestion", action: "read", scope: "tree" },
  },
  {
    pattern: "open-questions/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "openQuestion", action: "read", scope: "tree" },
  },
  {
    pattern: "open-questions/by-entity",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "openQuestion", action: "read", scope: "tree" },
  },

  // ── Attributes ──────────────────────────────────────────────────────────────
  {
    pattern: "attributes",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "attributes/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "attribute-types",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "attribute-types/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },

  // ── Event types ─────────────────────────────────────────────────────────────
  {
    pattern: "event-types",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "event", action: "read", scope: "tree" },
  },
  {
    pattern: "event-types/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "event", action: "update", scope: "tree" },
  },

  // ── Relationship types ───────────────────────────────────────────────────────
  {
    pattern: "relationship-types",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "relationship-types/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },

  // ── Individual relationships ─────────────────────────────────────────────────
  {
    pattern: "individual-relationships",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "individual-relationships/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },

  // ── GEDCOM import/export ────────────────────────────────────────────────────
  {
    pattern: "imports/gedcom",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "imports/gedcom/:id",
    methods: ["GET", "DELETE"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "imports/gedcom/:id/compare",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "imports/gedcom/:id/apply",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "imports/gedcom/:id/apply-stream",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "imports/gedcom/:id/discard",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "gedcom/validate",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "gedcom/validate/tree",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_tree", scope: "gedcom" },
  },
  {
    pattern: "gedcom/validation-context",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_external", scope: "gedcom" },
  },
  {
    pattern: "gedcom/cleanup-empty-families",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "validate_tree", scope: "gedcom" },
  },
  {
    pattern: "export",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "export", scope: "gedcom" },
  },
  {
    pattern: "export/bundle",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "export", scope: "gedcom" },
  },

  // ── Merge records ───────────────────────────────────────────────────────────
  {
    pattern: "merge-records/scans",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/run",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/:id/apply",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/:id/apply-stream",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/:id/discard",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "merge-records/scans/:id/resolutions",
    methods: ["PATCH"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },

  // ── Reconciliation ──────────────────────────────────────────────────────────
  {
    pattern: "reconciliation/sessions",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "reconciliation/sessions/:id/apply",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "reconciliation/jobs/:id",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },
  {
    pattern: "reconciliation/jobs/:id/run",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "gedcom", action: "merge_records", scope: "gedcom" },
  },

  // ── Place resolution ─────────────────────────────────────────────────────────
  {
    pattern: "place-resolution/links",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/links/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/links/batch-move",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/resolved",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/resolved/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/resolved/:id/aliases",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/aliases/:id",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/suggestions",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/suggestions/:id",
    methods: ["PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },
  {
    pattern: "place-resolution/scan",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "place", action: "update", scope: "tree" },
  },

  // ── Backups ──────────────────────────────────────────────────────────────────
  {
    pattern: "backups",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "backups/:id",
    methods: ["GET", "PATCH"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "backups/:id/download",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },

  // ── Changelog ────────────────────────────────────────────────────────────────
  {
    pattern: "changelog",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "changelog", action: "read", scope: "tree" },
  },
  {
    pattern: "changelog/:batchId",
    methods: ["GET", "DELETE"],
    permission: { kind: "requireCan", entity: "changelog", action: "read", scope: "tree" },
  },
  {
    pattern: "changelog/:batchId/undo",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "changelog", action: "update", scope: "tree" },
  },

  // ── Site health ──────────────────────────────────────────────────────────────
  {
    pattern: "site-health/run",
    methods: ["POST"],
    // Runs all health checks across tree data; requires read access as minimum.
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "site-health/latest",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "site-health/checks/:checkKey/records",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "site-health/checks/:checkKey/batch",
    methods: ["POST"],
    // Destructive: can delete or archive records in bulk. Requires delete permission.
    permission: { kind: "requireCan", entity: "individual", action: "delete", scope: "tree" },
  },
  {
    pattern: "site-health/suppress",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },
  {
    pattern: "site-health/suppress/:id",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },

  // ── Site settings ────────────────────────────────────────────────────────────
  {
    pattern: "site-settings",
    methods: ["GET", "PATCH"],
    permission: { kind: "requireWebsiteOwner" },
  },

  // ── Users / roles / permissions ──────────────────────────────────────────────
  {
    pattern: "users",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "users/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "users/:id/role",
    methods: ["POST"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },
  {
    pattern: "users/:id/roles",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },
  {
    pattern: "users/:id/roles/:userRoleId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },
  {
    pattern: "users/:id/links",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },
  {
    pattern: "users/:id/links/:linkId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },
  {
    pattern: "roles",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "role", action: "read", scope: "tree" },
  },
  {
    pattern: "roles/:roleId",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "role", action: "read", scope: "tree" },
  },
  {
    pattern: "roles/:roleId/permissions",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "role", action: "update", scope: "tree" },
  },
  {
    pattern: "roles/:roleId/permissions/:permissionId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "role", action: "update", scope: "tree" },
  },
  {
    pattern: "permissions",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "permission", action: "read", scope: "tree" },
  },
  {
    pattern: "permissions/:permissionId",
    methods: ["DELETE"],
    permission: { kind: "requireCan", entity: "permission", action: "delete", scope: "tree" },
  },

  // ── Access requests / registration ───────────────────────────────────────────
  {
    pattern: "access-requests",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "access-requests/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "registration-requests",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "user", action: "read", scope: "tree" },
  },
  {
    pattern: "registration-requests/:id",
    methods: ["GET", "PATCH"],
    permission: { kind: "requireCan", entity: "user", action: "update", scope: "tree" },
  },

  // ── Messages ─────────────────────────────────────────────────────────────────
  {
    pattern: "messages",
    methods: ["GET", "POST"],
    permission: { kind: "requireCan", entity: "message", action: "read", scope: "user" },
  },
  {
    pattern: "messages/:id",
    methods: ["GET", "PATCH", "DELETE"],
    permission: { kind: "requireCan", entity: "message", action: "read", scope: "user" },
  },
  {
    pattern: "messages/recipients",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "Returns recipients scoped to this admin tree; only used within messaging UI. User's own context only.",
    },
  },
  {
    pattern: "messages/stream",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "SSE stream for user's own unread count; only emits data relevant to the authenticated user.",
    },
  },
  {
    pattern: "messages/unread-count",
    methods: ["GET"],
    permission: {
      kind: "authOnly",
      reason: "User's own unread count; no cross-user data exposure.",
    },
  },

  // ── Contact messages ─────────────────────────────────────────────────────────
  {
    pattern: "contact-messages",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "message", action: "read", scope: "user" },
  },
  {
    pattern: "contact-messages/:id",
    methods: ["GET", "PATCH"],
    permission: { kind: "requireCan", entity: "message", action: "read", scope: "user" },
  },

  // ── Contributions ────────────────────────────────────────────────────────────
  {
    pattern: "contributions",
    methods: ["GET"],
    permission: { kind: "requireCan", entity: "individual", action: "read", scope: "tree" },
  },
  {
    pattern: "contributions/:id",
    methods: ["GET", "PATCH"],
    permission: { kind: "requireCan", entity: "individual", action: "update", scope: "tree" },
  },
];
