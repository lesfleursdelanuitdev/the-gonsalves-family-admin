"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buildEditorSubmitBody, type IndividualEditorFormSeed } from "@/lib/forms/individual-editor-form";
import { validateIndividualEditorSubmitSeed } from "@/lib/forms/individual-editor-submit-validators";
import { ApiError, postJson } from "@/lib/infra/api";
import { useCreateIndividual, useUpdateIndividual } from "@/hooks/useAdminIndividuals";

type UseIndividualEditorSubmitArgs = {
  mode: "create" | "edit";
  individualId: string;
  seed: IndividualEditorFormSeed;
  linkUserId: string | null;
};

export function useIndividualEditorSubmit(args: UseIndividualEditorSubmitArgs) {
  const { mode, individualId, seed, linkUserId } = args;
  const router = useRouter();
  const createIndividual = useCreateIndividual();
  const updateIndividual = useUpdateIndividual();

  const pending = createIndividual.isPending || updateIndividual.isPending;
  const err = createIndividual.error ?? updateIndividual.error;
  const errMsg = err instanceof Error ? err.message : "";
  const errStatus = err instanceof ApiError ? err.status : undefined;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const validationError = validateIndividualEditorSubmitSeed(seed);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      const body = buildEditorSubmitBody(seed);
      try {
        if (mode === "create") {
          const res = (await createIndividual.mutateAsync(body)) as { individual?: { id: string; xref: string } };
          const newId = res?.individual?.id;
          const xref = res?.individual?.xref ?? "";
          if (linkUserId && xref) {
            try {
              await postJson(`/api/admin/users/${linkUserId}/links`, { individualXref: xref });
            } catch {
              window.alert(
                "The person was created, but linking the user account failed. You can link from the user admin screen.",
              );
            }
          }
          if (newId) router.push(`/admin/individuals/${newId}`);
          else router.push("/admin/individuals");
          return;
        }

        await updateIndividual.mutateAsync({ id: individualId, ...body });
        router.push(`/admin/individuals/${individualId}`);
      } catch {
        // Mutation hooks keep the user-visible error state.
      }
    },
    [seed, mode, createIndividual, updateIndividual, individualId, router, linkUserId],
  );

  return { pending, errMsg, errStatus, handleSubmit };
}
