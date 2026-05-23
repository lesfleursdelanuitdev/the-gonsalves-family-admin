"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomTypeForm } from "@/components/admin/CustomTypeForm";
import { useAdminEventTypes, useUpdateEventType } from "@/hooks/useAdminEventTypes";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { ApiError } from "@/lib/infra/api";

export default function AdminEditEventTypePage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const router = useRouter();
  const { data, isPending, error } = useAdminEventTypes();
  const update = useUpdateEventType();

  const eventType = data?.eventTypes.find((t) => t.id === id);

  if (!id) return <p className="text-sm text-muted-foreground">Missing id.</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !eventType) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load this event type."}
      </p>
    );
  }
  if (!eventType.isCustom) {
    return <p className="text-sm text-muted-foreground">Standard event types cannot be edited.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-medium text-muted-foreground">Edit event type</span>{" "}
          <span className="text-foreground">{eventType.label}</span>
        </h1>
      </div>
      <CustomTypeForm
        backHref="/admin/event-types"
        backLabel="Back to event types"
        initialValues={{
          tag: eventType.tag,
          label: eventType.label,
          ownerScope: eventType.ownerScope,
          color: eventType.color,
          sortOrder: eventType.sortOrder,
        }}
        disableTag
        isSubmitting={update.isPending}
        submitLabel="Save changes"
        onSubmit={(values) => {
          update.mutate(
            { id, ...values },
            {
              onSuccess: () => {
                toast.success("Event type saved.");
                router.push("/admin/event-types");
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? err.message : "Failed to save event type."),
            },
          );
        }}
      />
    </div>
  );
}
