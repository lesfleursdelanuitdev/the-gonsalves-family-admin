"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/infra/api";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { useAdminRelationship, useUpdateAdminRelationship } from "@/hooks/useAdminRelationships";
import { AssociationForm, type AssociationFormInitialData } from "@/app/admin/associations/_components/AssociationForm";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export default function AdminEditAssociationPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const router = useRouter();
  const { data, isPending, error } = useAdminRelationship(id);
  const { mutate: update, isPending: isUpdating } = useUpdateAdminRelationship();

  if (!id) return <p className="text-sm text-muted-foreground">Missing id.</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data?.relationship) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load this association."}
      </p>
    );
  }

  const rel = data.relationship;

  const initialData: AssociationFormInitialData = {
    relationshipTypeId: rel.relationshipType.id,
    notes: rel.notes,
    participants: rel.participants.map((p) => ({
      individualId: p.individualId,
      displayLabel: stripSlashesFromName(p.individual.fullName ?? "") || p.individual.xref,
      roleId: p.roleId,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-medium text-muted-foreground">Edit association</span>{" "}
          <span className="text-foreground">{rel.relationshipType.label}</span>
        </h1>
      </div>

      <AssociationForm
        mode="edit"
        initialData={initialData}
        isSubmitting={isUpdating}
        onSubmit={(values) => {
          update(
            { id, ...values },
            {
              onSuccess: () => {
                toast.success("Association saved.");
                router.push("/admin/associations");
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? err.message : "Could not save association."),
            },
          );
        }}
      />
    </div>
  );
}
