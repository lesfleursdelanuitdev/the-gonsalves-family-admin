"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomTypeForm } from "@/components/admin/CustomTypeForm";
import { useCreateAttributeType } from "@/hooks/useAdminAttributeTypes";
import { ApiError } from "@/lib/infra/api";

export default function AdminNewAttributeTypePage() {
  const router = useRouter();
  const create = useCreateAttributeType();

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">New custom attribute type</h1>
        <p className="mt-1 text-muted-foreground">
          Define a tree-specific GEDCOM attribute tag that extends the standard set.
        </p>
      </div>
      <CustomTypeForm
        backHref="/admin/attribute-types"
        backLabel="Back to attribute types"
        isSubmitting={create.isPending}
        submitLabel="Create attribute type"
        onSubmit={(values) => {
          create.mutate(values, {
            onSuccess: () => {
              toast.success("Attribute type created.");
              router.push("/admin/attribute-types");
            },
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : "Failed to create attribute type."),
          });
        }}
      />
    </div>
  );
}
