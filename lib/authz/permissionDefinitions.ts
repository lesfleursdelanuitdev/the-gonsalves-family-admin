const DEFINITION_ACTIONS = new Set(["read", "create", "update", "delete", "manage", "reply"]);
const UI_CREATE_ACTIONS = ["read", "create", "update", "delete"] as const;

function humanizeEntity(entity: string): string {
  return entity
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

function actionVerb(action: string): string {
  if (action === "read") return "Read";
  if (action === "create") return "Create";
  if (action === "update") return "Edit";
  if (action === "delete") return "Delete";
  if (action === "reply") return "Reply to";
  if (action === "use") return "Use";
  if (action === "validate_external") return "Validate uploaded GEDCOM files";
  if (action === "validate_tree") return "Validate and repair this tree database";
  if (action === "merge_records") return "Merge records";
  if (action === "export") return "Export";
  return "Manage";
}

export function normalizePermissionAction(input: string): string {
  const action = input.trim().toLowerCase();
  if (action === "edit") return "update";
  return action;
}

export function isAllowedPermissionDefinitionAction(input: string): boolean {
  return DEFINITION_ACTIONS.has(normalizePermissionAction(input));
}

export function permissionDescription(entity: string, action: string, scope: string): string {
  const safeEntity = humanizeEntity(entity) || "resource";
  const normalizedScope = scope.trim().toLowerCase() || "tree";
  const safeScope = normalizedScope === "other_users" ? "other users" : normalizedScope;
  return `${actionVerb(action)} ${safeEntity} records at ${safeScope} scope.`;
}

export function uiCreatePermissionActions(): ReadonlyArray<{ value: string; label: string }> {
  return UI_CREATE_ACTIONS.map((value) => ({
    value,
    label: value === "update" ? "Edit" : value[0]!.toUpperCase() + value.slice(1),
  }));
}
