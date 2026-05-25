"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/infra/api";
import { useCreateAdminRelationship } from "@/hooks/useAdminRelationships";
import { AssociationForm } from "@/app/admin/associations/_components/AssociationForm";

export default function AdminNewAssociationPage() {
  const router = useRouter();
  const { mutate: create, isPending } = useCreateAdminRelationship();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New association</h1>
        <p className="mt-1 text-muted-foreground">
          Record a non-family relationship between two or more individuals.
        </p>
      </div>

      <AssociationForm
        mode="create"
        isSubmitting={isPending}
        onSubmit={(values) => {
          create(values, {
            onSuccess: () => {
              toast.success("Association created.");
              router.push("/admin/associations");
            },
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : "Could not create association."),
          });
        }}
      />
    </div>
  );
}
