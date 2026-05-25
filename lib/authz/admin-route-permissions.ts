export type CrudAction = "read" | "create" | "update" | "delete" | string;
export type CrudScope = "site" | "tree" | "user" | "other_users" | "gedcom";

export interface AdminRoutePermissionRequirement {
  mode: "all" | "any";
  checks: Array<{
    entity: string;
    action: CrudAction;
    scope: CrudScope;
  }>;
}

const ADMIN_SECTION_ENTITY_SCOPE: Record<string, { entity: string; scope: CrudScope }> = {
  individuals: { entity: "individual", scope: "tree" },
  families: { entity: "family", scope: "tree" },
  events: { entity: "event", scope: "tree" },
  places: { entity: "place", scope: "tree" },
  notes: { entity: "note", scope: "tree" },
  sources: { entity: "source", scope: "tree" },
  "relationship-types": { entity: "individual", scope: "tree" },
  "open-questions": { entity: "openQuestion", scope: "tree" },
  media: { entity: "media", scope: "tree" },
  tags: { entity: "tag", scope: "tree" },
  albums: { entity: "album", scope: "tree" },
  dates: { entity: "date", scope: "tree" },
  "given-names": { entity: "givenName", scope: "tree" },
  surnames: { entity: "lastName", scope: "tree" },
  users: { entity: "user", scope: "tree" },
  roles: { entity: "role", scope: "tree" },
  permissions: { entity: "permission", scope: "tree" },
  messages: { entity: "message", scope: "user" },
  stories: { entity: "story", scope: "tree" },
  changelog: { entity: "changelog", scope: "tree" },
  "whats-new": { entity: "whatsNew", scope: "site" },
};

const OTHER_USER_SCOPED_ENTITIES = new Set(["media", "tag", "album", "story"]);

function normalizePath(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return "";
  const pathOnly = href.split("?")[0] ?? href;
  return pathOnly.replace(/\/+$/, "") || "/";
}

export function resolveAdminRoutePermission(rawHref: string): AdminRoutePermissionRequirement | null {
  const path = normalizePath(rawHref);
  if (!path.startsWith("/admin")) return null;

  if (path === "/admin/gedcom/export") {
    return { mode: "all", checks: [{ entity: "gedcom", action: "export", scope: "gedcom" }] };
  }
  if (path === "/admin/merge-records") {
    return { mode: "all", checks: [{ entity: "gedcom", action: "merge_records", scope: "gedcom" }] };
  }
  if (path === "/admin/gedcom/validator") {
    return {
      mode: "any",
      checks: [
        { entity: "gedcom", action: "validate_external", scope: "gedcom" },
        { entity: "gedcom", action: "validate_tree", scope: "gedcom" },
      ],
    };
  }

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const section = parts[1] ?? "";
  const base = ADMIN_SECTION_ENTITY_SCOPE[section];
  if (!base) return null;

  if (OTHER_USER_SCOPED_ENTITIES.has(base.entity)) {
    const lastPart = parts[parts.length - 1] ?? "";
    if (lastPart === "new") {
      return {
        mode: "any",
        checks: [
          { entity: base.entity, action: "create", scope: "tree" },
          { entity: base.entity, action: "create", scope: "user" },
        ],
      };
    }
    if (lastPart === "edit") {
      return {
        mode: "any",
        checks: [
          { entity: base.entity, action: "update", scope: "tree" },
          { entity: base.entity, action: "update", scope: "user" },
          { entity: base.entity, action: "update", scope: "other_users" },
        ],
      };
    }
    return {
      mode: "any",
      checks: [
        { entity: base.entity, action: "read", scope: "tree" },
        { entity: base.entity, action: "read", scope: "user" },
        { entity: base.entity, action: "read", scope: "other_users" },
      ],
    };
  }

  const last = parts[parts.length - 1] ?? "";
  if (last === "new") return { mode: "all", checks: [{ ...base, action: "create" }] };
  if (last === "edit") return { mode: "all", checks: [{ ...base, action: "update" }] };

  // Roles edit route is /admin/roles/[id] (without /edit).
  if (section === "roles" && parts.length === 3) return { mode: "all", checks: [{ ...base, action: "update" }] };

  return { mode: "all", checks: [{ ...base, action: "read" }] };
}
