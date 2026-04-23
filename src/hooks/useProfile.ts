"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson } from "@/lib/infra/api";
import { AUTH_KEYS } from "./useAuth";

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  researchSurnames: string[];
  researchLocations: string[];
  researchTimePeriods: string[];
  researchGoals: string | null;
  yearsResearching: number | null;
  specializations: string[];
  certifications: string[];
  languages: string[];
  profileVisibility: string;
  activityVisibility: string;
  allowDirectMessages: boolean;
  allowFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

export const PROFILE_KEYS = {
  my: ["auth", "me", "profile"] as const,
};

export function useMyProfile() {
  return useQuery({
    queryKey: PROFILE_KEYS.my,
    queryFn: () =>
      fetchJson<{ user: unknown; profile: UserProfile | null }>("/api/auth/me/profile").then(
        (r) => r.profile,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UserProfile>) =>
      patchJson<{ profile: UserProfile }>("/api/auth/me/profile", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEYS.my });
    },
  });
}

export function useUpdateMyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; email?: string }) =>
      patchJson<{ user: unknown }>("/api/auth/me/account", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTH_KEYS.me });
      qc.invalidateQueries({ queryKey: PROFILE_KEYS.my });
    },
  });
}

/** Change sign-in password while logged in (no email). */
export function useChangeMyPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      patchJson<{ user: unknown }>("/api/auth/me/account", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTH_KEYS.me });
    },
  });
}
