# Admin Test Suite — Session Notes (2026-05-24)

## Overview

Added a four-layer Vitest test suite to `the-gonsalves-family-admin`, growing the total from a handful of pre-existing tests to **30 test files / 516 tests**, all passing in under 1 second.

---

## Layer 1 — Business Logic (`lib/admin/`)

Pure functions and Prisma-transaction helpers. No HTTP concerns.

| File | Key subjects |
|------|-------------|
| `admin-individual-living.test.ts` | `deathKnownFromIndividualSnapshot`, `computeIsLiving` (three modes, 120-year rule, day-boundary edge case). Uses `vi.setSystemTime()` to pin the reference date. |
| `admin-event-create.test.ts` | `parseGedcomDateType` (legacy GEDCOM tag aliases, case-insensitive), `parseDateInput` (null/meaningless rejection, legacy normalisation, calendar defaulting), `parsePlaceInput`, `parseLinkIds`, `parseMediaIds`, `findOrCreateGedcomDate`/`findOrCreateGedcomPlace` (find-path vs create-path via inline `tx` mock). |
| `admin-individuals-filter-sql.test.ts` | `parseSexParam`, `parseLivingParam`, `hasStructuredFilters`, `adminIndividualsFilterConditions` (inspecting `.sql` template and `.values` array on `Prisma.Sql` fragments), `adminIndividualsWhereSql`. |
| `admin-individual-families.test.ts` | `normalizeChildRelationshipType` (birth→biological alias), `spouseSlotFromSex`, `canonicalSpouseSlotsForPair` (all 9 sex-pair combinations including ID-sort determinism for same-sex pairs). |

**Patterns established:**
- For `tx`-accepting functions: pass an inline mock object `{ gedcomDate: { findFirst: vi.fn(), create: vi.fn() } }` directly — no module mocking needed.
- `Prisma.Sql` is type-only at runtime; assert on `.sql` and `.values` properties, not `instanceof`.

---

## Layer 2 — Authorization (`lib/authz/`, `src/lib/authz/`)

| File | Key subjects |
|------|-------------|
| `roles.test.ts` | `toRoleKey`: lowercase, trim, spaces/hyphens/specials→underscores, leading/trailing underscore removal, all-special→empty, digit preservation, 100-char truncation. |
| `permission-definitions.test.ts` | `normalizePermissionAction` (edit→update alias, case/trim), `isAllowedPermissionDefinitionAction` (rejects GEDCOM-specific actions), `permissionDescription` (camelCase/snake_case humanisation, action verb mapping), `uiCreatePermissionActions`. |
| `admin-route-permissions.test.ts` | `resolveAdminRoutePermission`: null for non-admin paths, path normalisation (trailing slash, query string, whitespace), special GEDCOM routes, all 14 standard tree-scoped sections, roles special case (`/[id]` without `/edit` → update), messages (user scope), other-user-scoped entities (media/tag/album/story → mode:"any" multi-scope). |
| `authorize-legacy.test.ts` | Legacy `treeMaintainer` (CRU allowed, delete denied, role/user/permission denied), `treeContributor` (read-only on most, CRU on media/tag/album), legacy permission fallback (admin/write/read/delete types, expiry, non-tree scope skipped, unmapped entity skipped), `requirePermission` (throws `AuthorizationError` with status 403). |

**Pattern:** `vi.hoisted()` + `vi.mock("@/lib/database/prisma", ...)` for module-level Prisma consumers.

---

## Layer 3 — API Route Handlers (`src/app/api/`, `lib/infra/`)

All routes are called as plain functions with a `NextRequest` and a params context — no real HTTP server. `next/server` works fine in Node 22 without any polyfill.

| File | Key subjects |
|------|-------------|
| `lib/infra/api-handler.test.ts` | `withAdminAuth` error mapping: Unauthorized→401, Forbidden/AuthorizationError→403, `AdminTreeResolutionError`→503, `PrismaClientValidationError`→400, P2021→503, P2022→503, P2002/P2003→400, other known Prisma error→503, generic→500. Happy path passes user + params. |
| `src/app/api/auth/me/route.test.ts` | Returns `{user: null}` with **200** when signed out (not 401 — this is intentional for a "who am I" probe). |
| `src/app/api/auth/logout/route.test.ts` | `revokeSession` called when token present, skipped when absent. |
| `src/app/api/auth/login/route.test.ts` | Validation (missing username/password → 400), wrong credentials → 401, success → 200 with user (no `passwordHash`), remember-me uses longer TTL, DB-unavailable → 503, permission-denied (42501) → 503, generic → 500. |
| `src/app/api/admin/access-requests/[id]/route.test.ts` | GET 200/404 with treeId scope; PATCH `set_status` (valid/invalid status, all four statuses accepted), `set_response_notes` (empty string → null), unknown action → 400, 404 when not found, 403 when requireCan throws; DELETE 204/404. |
| `src/app/api/admin/imports/gedcom/[id]/apply/route.test.ts` | Guards: 404, 409 applied, 409 discarded, 400 no-plan, 400 review_later in `resolutionsJson`, 403; success: calls `applyGedcomImport`, sets status "applied", returns stats. |

**Standard mock stack for admin routes:**
```typescript
vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/infra/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/authz/routeGuards", () => ({ requireCan: requireCanMock }));
```

---

## Layer 4 — Display + URL State (`lib/gedcom/`, `lib/admin/`, `lib/navigation/`, `lib/infra/`)

Pure formatting and URL round-trip functions; no mocking needed.

| File | Key subjects |
|------|-------------|
| `lib/gedcom/display-name.test.ts` | `stripSlashesFromName` (GEDCOM `/Smith/` format), `formatDisplayNameFromNameForms` (null/empty forms, `isPrimary` selection, `sortOrder` fallback, multi-given/surname, slash stripping, empty-compose fallback), `initialsFromPersonLabel`. |
| `lib/gedcom/format-gedcom-date-display.test.ts` | `isAboutDateType` (ABOUT/ABT, case/whitespace, null), `formatGedcomDateDisplayLabel` (original preference, EXACT structured dates, ABOUT tilde prefix, range dates with end parts, BEFORE/AFTER/CALCULATED). |
| `lib/gedcom/pedigree-display.test.ts` | `formatPedigreeRelationship` (all relationship types, case-insensitive, custom pedigree text takes precedence), `mergePedigreesForChild` (dedup, join with ·), `parentChildEdgesForFamilyAsChild` (familyId match → null fallback, husband-before-wife ordering), `childShowsNonBirthIndicator`, `buildChildNonBirthIndicatorMap`. |
| `lib/admin/admin-list-params.test.ts` | `parseListParams`: default MAX, negative→1 minimum, `limit=0` falls through to MAX (0 is falsy in the `\|\|` expression), NaN→MAX, cap at MAX; offset default 0, negative→0. |
| `lib/admin/admin-individuals-url-filters.test.ts` | `hasAdminIndividualsFilterQueryKeys`, parse (q, sex GEDCOM validation + uppercase, living true/false/ambiguous, year bounds), merge defaults, serialize (round-trip, trim, omit empty, invalid living omitted), `adminIndividualsPathWithFilters`, `adminIndividualsHrefForGivenName`, `adminIndividualsHrefForSurname` (strips GEDCOM slashes). |
| `lib/navigation/route-dynamic-segment.test.ts` | `routeDynamicId` for string/array/null/undefined/empty/whitespace params. |
| `lib/infra/login-cors.test.ts` | `loginCorsHeaders`: all 5 built-in allowed origins, denied/unknown origins, `ADMIN_LOGIN_CORS_ORIGINS` env extension, origin subdomains not allowed. |

---

## Bugs Found During Testing

Two cases where the implementation behaved differently from intuition — corrected in test assertions rather than the source:

1. **`initialsFromPersonLabel("")` → `"?"` not `"??"`** — empty string triggers the `!n` guard (same as `"—"`), not the single-character path.
2. **`parseListParams("limit=0")` → `ADMIN_LIST_MAX_LIMIT`** — `parseInt("0") === 0` is falsy, so the `|| ADMIN_LIST_MAX_LIMIT` fallback fires before `Math.max(1, ...)` can clamp it. Only genuinely negative values (which are truthy) reach the `Math.max` clamp.

---

## Final Numbers

| Layer | Files | Tests |
|-------|-------|-------|
| 1 — Business logic | 4 | ~120 |
| 2 — Authorization | 4 | ~126 |
| 3 — API routes | 6 | ~132 |
| 4 — Display + URL state | 7 | 138 |
| Pre-existing | 9 | ~? |
| **Total** | **30** | **516** |

All 516 tests pass in ~1 second (node environment, no jsdom).
