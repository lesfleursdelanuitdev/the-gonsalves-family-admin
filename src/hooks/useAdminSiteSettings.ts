"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson } from "@/lib/infra/api";

export interface AdminSiteSettings {
  id: string | null;
  treeId: string;
  publicBaseUrl: string | null;
  siteName: string | null;
  siteTagline: string | null;
  contactEmail: string | null;
  logoMediaId: string | null;
  logoMediaKind: string | null;
  socialLinks: Record<string, string> | null;
  defaultLanguage: string | null;
  updatedAt: string | null;
}

export interface AdminSiteSettingsResponse {
  settings: AdminSiteSettings;
}

const KEY = ["admin", "site-settings"] as const;
const BASE = "/api/admin/site-settings";

export function useAdminSiteSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminSiteSettingsResponse>(BASE),
    staleTime: 60_000,
  });
}

export function useUpdateSiteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<AdminSiteSettings, "id" | "treeId" | "updatedAt">>) =>
      patchJson<AdminSiteSettingsResponse>(BASE, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
