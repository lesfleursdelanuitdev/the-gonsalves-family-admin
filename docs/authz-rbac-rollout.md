# RBAC Auth Rollout Checklist

This app now has additive RBAC tables (`roles`, `role_permissions`, `user_roles`) and route guards using `requireCan(...)`.

Use this checklist per environment (dev, staging, prod).

## 1) Apply Prisma Migrations

From repo root or `packages/ligneous-prisma`:

```bash
cd /apps/gonsalves-genealogy/packages/ligneous-prisma
npx prisma migrate deploy
```

Expected: migration `20260517130000_add_rbac_roles_tables` is applied.

## 2) Seed Default Roles

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
npm run seed-authz-roles
```

Expected roles:

- `site_admin`
- `tree_owner`
- `tree_maintainer`
- `tree_contributor`
- `viewer`

## 3) Backfill Legacy Tree Memberships

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
npm run backfill-user-roles
```

This maps legacy `tree_owners`, `tree_maintainers`, and `tree_contributors` to `user_roles`.

## 4) Verify Core Access Paths

Test at least these users:

- Website owner (`isWebsiteOwner = true`) -> full access bypass.
- Site admin role -> can manage users/roles and site-scoped admin routes.
- Tree owner role -> full tree CRUD.
- Tree maintainer role -> create/read/update tree entities, no delete.
- Tree contributor role -> read tree entities + contributor media/tag/album behavior.
- Viewer role -> read-only tree access.

## 5) Smoke API Checks

Use a non-owner account and confirm:

- Protected route without permission returns `403`.
- Same route with assigned permission returns `200`/`201`.
- Role management endpoints enforce `role:manage:site`.

## 6) Post-Deploy Monitoring

- Monitor for unexpected `403` spikes.
- Confirm admin role UI can:
  - list roles,
  - create/edit/delete roles,
  - add/remove permissions,
  - assign/remove user roles.

## 7) Future Cleanup (After Stability Window)

After confidence in RBAC rollout:

- remove legacy fallbacks in `lib/authz/authorize.ts`,
- deprecate legacy tree role checks in user endpoints/UI,
- remove legacy role tables only in a dedicated migration plan.
