"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "@/lib/infra/api";
import { ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/useAdminFamilies";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";

export function useFamilyMembershipMutation(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      postJson<{ family: unknown }>(`/api/admin/families/${familyId}/membership`, body),
    onSuccess: (res) => {
      qc.setQueryData([...ADMIN_FAMILIES_QUERY_KEY, "detail", familyId], res);
      qc.invalidateQueries({ queryKey: ADMIN_FAMILIES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ADMIN_INDIVIDUALS_QUERY_KEY });
    },
  });
}
