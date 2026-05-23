"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomTypeForm } from "@/components/admin/CustomTypeForm";
import { useAdminAttributeTypes, useUpdateAttributeType } from "@/hooks/useAdminAttributeTypes";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { ApiError } from "@/lib/infra/api";

export default function AdminEditAttributeTypePage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const router = useRouter();
  const { data, isPending, error } = useAdminAttributeTypes();
  const update = useUpdateAttributeType();

  const attributeType = data?.attributeTypes.find((t) => t.id === id);

  if (!id) return <p className="text-sm text-muted-foreground">Missing id.</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !attributeType) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load this attribute type."}
      </p>
    );
  }
  if (!attributeType.isCustom) {
    return <p className="text-sm text-muted-foreground">Standard attribute types cannot be edited.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-medium text-muted-foreground">Edit attribute type</span>{" "}
          <span className="text-foreground">{attributeType.label}</span>
        </h1>
      </div>
      <CustomTypeForm
        backHref="/admin/attribute-types"
        backLabel="Back to attribute types"
        initialValues={{
          tag: attributeType.tag,
          label: attributeType.label,
          ownerScope: attributeType.ownerScope,
          color: attributeType.color,
          sortOrder: attributeType.sortOrder,
        }}
        disableTag
        isSubmitting={update.isPending}
        submitLabel="Save changes"
        onSubmit={(values) => {
          update.mutate(
            { id, ...values },
            {
              onSuccess: () => {
                toast.success("Attribute type saved.");
                router.push("/admin/attribute-types");
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? err.message : "Failed to save attribute type."),
            },
          );
        }}
      />
    </div>
  );
}
