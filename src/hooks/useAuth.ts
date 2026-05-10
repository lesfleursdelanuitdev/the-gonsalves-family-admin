"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchJson, postJson } from "@/lib/infra/api";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string | null;
  isWebsiteOwner: boolean;
}

export const AUTH_KEYS = {
  me: ["auth", "me"] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_KEYS.me,
    queryFn: () => fetchJson<{ user: AuthUser | null }>("/api/auth/me").then((r) => r.user),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      postJson<{ user: AuthUser }>("/api/auth/login", body),
    onSuccess: async (data) => {
      qc.setQueryData(AUTH_KEYS.me, data.user);
      await qc.invalidateQueries({ queryKey: AUTH_KEYS.me });
      const url = new URL(window.location.href);
      const requested = url.searchParams.get("redirect");
      const safeRedirect =
        requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : null;
      if (safeRedirect) {
        router.push(safeRedirect);
        return;
      }
      router.push(
        window.location.hostname === "storycreator.gonsalvesfamily.com" ? "/storycreator" : "/admin",
      );
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => postJson("/api/auth/logout"),
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });
}
