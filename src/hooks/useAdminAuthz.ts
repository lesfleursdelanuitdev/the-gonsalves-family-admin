"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import {
  resolveAdminRoutePermission,
  type CrudScope,
} from "@/lib/authz/admin-route-permissions";

interface CrudResponse {
  entity: string;
  scope: CrudScope;
  permissions: Record<string, boolean>;
}

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  read: false,
  create: false,
  update: false,
  delete: false,
};

export function useAdminCrudPermissions(entity: string | null, scope: CrudScope = "tree") {
  const keyEntity = entity?.trim() ?? "";
  const enabled = keyEntity.length > 0;

  const query = useQuery({
    queryKey: ["admin", "authz", "crud", keyEntity, scope],
    queryFn: () =>
      fetchJson<CrudResponse>(
        `/api/admin/authz/crud?entity=${encodeURIComponent(keyEntity)}&scope=${encodeURIComponent(scope)}`,
      ),
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  const permissions = useMemo(
    () => (query.data?.permissions ? { ...DEFAULT_PERMISSIONS, ...query.data.permissions } : DEFAULT_PERMISSIONS),
    [query.data],
  );

  return {
    ...query,
    permissions,
    canRead: permissions.read,
    canCreate: permissions.create,
    canUpdate: permissions.update,
    canDelete: permissions.delete,
  };
}

interface CrudTarget {
  entity: string;
  scope: CrudScope;
}

export function useAdminCrudPermissionsBatch(targets: CrudTarget[]) {
  const normalizedTargets = useMemo(() => {
    const dedup = new Map<string, CrudTarget>();
    for (const target of targets) {
      const entity = target.entity.trim();
      if (!entity) continue;
      const key = `${entity}:${target.scope}`;
      if (!dedup.has(key)) dedup.set(key, { entity, scope: target.scope });
    }
    return Array.from(dedup.values());
  }, [targets]);

  const queries = useQueries({
    queries: normalizedTargets.map((target) => ({
      queryKey: ["admin", "authz", "crud", target.entity, target.scope] as const,
      queryFn: () =>
        fetchJson<CrudResponse>(
          `/api/admin/authz/crud?entity=${encodeURIComponent(target.entity)}&scope=${encodeURIComponent(target.scope)}`,
        ),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const permissionsByKey = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    normalizedTargets.forEach((target, index) => {
      const data = queries[index]?.data;
      map.set(
        `${target.entity}:${target.scope}`,
        data?.permissions ? { ...DEFAULT_PERMISSIONS, ...data.permissions } : DEFAULT_PERMISSIONS,
      );
    });
    return map;
  }, [normalizedTargets, queries]);

  const isLoading = queries.some((q) => q.isLoading);

  return {
    isLoading,
    permissionsFor(entity: string, scope: CrudScope = "tree") {
      return permissionsByKey.get(`${entity.trim()}:${scope}`) ?? DEFAULT_PERMISSIONS;
    },
  };
}

export function useAdminHrefPermissions(hrefs: string[]) {
  const requirementsByHref = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveAdminRoutePermission>>();
    for (const href of hrefs) map.set(href, resolveAdminRoutePermission(href));
    return map;
  }, [hrefs]);

  const targets = useMemo(() => {
    const out: CrudTarget[] = [];
    for (const req of requirementsByHref.values()) {
      if (!req) continue;
      for (const check of req.checks) {
        out.push({ entity: check.entity, scope: check.scope });
      }
    }
    return out;
  }, [requirementsByHref]);

  const batch = useAdminCrudPermissionsBatch(targets);

  return {
    isLoading: batch.isLoading,
    canAccessHref(href: string) {
      const req = requirementsByHref.get(href);
      if (!req) return true;
      const checks = req.checks.map((check) => {
        const permissions = batch.permissionsFor(check.entity, check.scope);
        return Boolean(permissions[check.action]);
      });
      if (checks.length === 0) return true;
      return req.mode === "any" ? checks.some(Boolean) : checks.every(Boolean);
    },
  };
}
