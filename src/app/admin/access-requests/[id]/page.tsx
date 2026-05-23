"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { AccessRequestStatusBadge } from "@/components/admin/AccessRequestStatusBadge";
import {
  useAdminAccessRequest,
  useSetAccessRequestStatus,
  useSaveAccessRequestResponseNotes,
  type AdminAccessRequestDetail,
} from "@/hooks/useAdminAccessRequests";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import type { AccessRequestStatus } from "@ligneous/prisma";

const textareaClassName =
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  basic_access: "Basic access",
  individual_link: "Individual link",
  contributor_role: "Contributor role",
  maintainer_role: "Maintainer role",
  owner_role: "Owner role",
};

type ButtonVariant = "default" | "outline" | "destructive" | "secondary";

interface StatusAction {
  label: string;
  status: AccessRequestStatus;
  variant: ButtonVariant;
}

function RequesterCard({ r }: { r: AdminAccessRequestDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4 text-muted-foreground" aria-hidden />
          Requester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{r.user.name?.trim() || r.user.username}</p>
        <p className="text-muted-foreground">@{r.user.username}</p>
        <p className="text-muted-foreground">{r.user.email}</p>
        <p className="text-xs text-muted-foreground">
          Member since{" "}
          {new Date(r.user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  r,
  onSetStatus,
  isUpdating,
}: {
  r: AdminAccessRequestDetail;
  onSetStatus: (s: AccessRequestStatus) => void;
  isUpdating: boolean;
}) {
  const allActions: StatusAction[] = [
    { label: "Approve", status: "approved", variant: "default" },
    { label: "Reject", status: "rejected", variant: "destructive" },
    { label: "Cancel", status: "cancelled", variant: "outline" },
    { label: "Reset to pending", status: "pending", variant: "outline" },
  ];
  const actions = allActions.filter((a) => a.status !== r.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AccessRequestStatusBadge status={r.status} />
        {r.respondedAt ? (
          <p className="text-xs text-muted-foreground">
            Responded{" "}
            {new Date(r.respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {r.responder ? ` by ${r.responder.name ?? r.responder.username}` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.status} variant={a.variant} size="sm" disabled={isUpdating} onClick={() => onSetStatus(a.status)}>
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResponseNotesCard({ r, id }: { r: AdminAccessRequestDetail; id: string }) {
  const [notes, setNotes] = useState(r.responseNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const saveNotes = useSaveAccessRequestResponseNotes();

  const handleSave = useCallback(async () => {
    try {
      await saveNotes.mutateAsync({ id, notes });
      setDirty(false);
      toast.success("Response notes saved.");
    } catch {
      toast.error("Could not save notes.");
    }
  }, [id, notes, saveNotes]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Response notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Visible to admins only.</p>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          placeholder="Add notes about this decision…"
          rows={3}
          className={textareaClassName}
        />
        {dirty ? (
          <Button size="sm" onClick={handleSave} disabled={saveNotes.isPending}>
            {saveNotes.isPending ? "Saving…" : "Save notes"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminAccessRequestDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const { data, isLoading, error } = useAdminAccessRequest(id ?? "");
  const r = data?.request;
  const setStatus = useSetAccessRequestStatus();

  const handleSetStatus = useCallback(
    (status: AccessRequestStatus) => {
      if (!id) return;
      setStatus.mutate(
        { id, status },
        {
          onSuccess: () => toast.success(`Request ${status}.`),
          onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
        },
      );
    },
    [id, setStatus],
  );

  return (
    <DetailPageShell
      backHref="/admin/access-requests"
      backLabel="Access requests"
      isLoading={Boolean(id) && isLoading}
      error={error}
      data={r}
      notFoundMessage="Access request not found."
    >
      {r ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-content/[0.08] pb-6">
            <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-base-content">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 leading-tight">
                {REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}
              </span>
            </h1>
            <AccessRequestStatusBadge status={r.status} />
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <RequesterCard r={r} />
            <StatusCard r={r} onSetStatus={handleSetStatus} isUpdating={setStatus.isPending} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Request details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
                <p className="mt-0.5 font-medium">{REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}</p>
              </div>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Requested</p>
                <p className="mt-0.5 font-medium">
                  {new Date(r.requestedAt).toLocaleString("en-US", {
                    month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </p>
              </div>
              {r.resourceType ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Resource type</p>
                  <p className="mt-0.5 font-medium capitalize">{r.resourceType}</p>
                </div>
              ) : null}
              {r.resourceId ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Resource ID</p>
                  <p className="mt-0.5 font-mono text-xs font-medium">{r.resourceId}</p>
                </div>
              ) : null}
              {r.requestedPermissionType ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Permission requested</p>
                  <p className="mt-0.5 font-medium capitalize">{r.requestedPermissionType}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {r.notes ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes from requester</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{r.notes}</CardContent>
            </Card>
          ) : null}

          <ResponseNotesCard r={r} id={id!} />
        </>
      ) : null}
    </DetailPageShell>
  );
}
