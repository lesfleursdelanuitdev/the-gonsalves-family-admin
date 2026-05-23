"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomTypeForm } from "@/components/admin/CustomTypeForm";
import { useCreateEventType } from "@/hooks/useAdminEventTypes";
import { ApiError } from "@/lib/infra/api";

export default function AdminNewEventTypePage() {
  const router = useRouter();
  const create = useCreateEventType();

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">New custom event type</h1>
        <p className="mt-1 text-muted-foreground">
          Define a tree-specific GEDCOM event tag that extends the standard set.
        </p>
      </div>
      <CustomTypeForm
        backHref="/admin/event-types"
        backLabel="Back to event types"
        isSubmitting={create.isPending}
        submitLabel="Create event type"
        onSubmit={(values) => {
          create.mutate(values, {
            onSuccess: () => {
              toast.success("Event type created.");
              router.push("/admin/event-types");
            },
            onError: (err) =>
              toast.error(err instanceof ApiError ? err.message : "Failed to create event type."),
          });
        }}
      />
    </div>
  );
}
