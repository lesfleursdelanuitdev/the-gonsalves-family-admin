"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { PublicIntakeStatusBadge } from "@/components/admin/PublicIntakeStatusBadge";
import {
  useAdminRegistrationRequest,
  useSetRegistrationRequestStatus,
  useSaveRegistrationRequestNotes,
  type AdminRegistrationRequestDetail,
} from "@/hooks/useAdminRegistrationRequests";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import type { PublicIntakeStatus } from "@ligneous/prisma";

const textareaClassName =
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y";

type ButtonVariant = "default" | "outline" | "destructive" | "secondary";

interface StatusAction {
  label: string;
  status: PublicIntakeStatus;
  variant: ButtonVariant;
}

function ApplicantCard({ r }: { r: AdminRegistrationRequestDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Applicant</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Name</p>
          <p className="mt-0.5 font-medium">{r.firstName} {r.lastName}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
          <p className="mt-0.5 font-medium">{r.email}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Preferred username</p>
          <p className="mt-0.5 font-mono text-sm">@{r.preferredUsername}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</p>
          <p className="mt-0.5 font-medium">
            {new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  r,
  onSetStatus,
  isUpdating,
}: {
  r: AdminRegistrationRequestDetail;
  onSetStatus: (s: PublicIntakeStatus) => void;
  isUpdating: boolean;
}) {
  const allActions: StatusAction[] = [
    { label: "Approve", status: "approved", variant: "default" },
    { label: "Reject", status: "rejected", variant: "destructive" },
    { label: "Archive", status: "archived", variant: "outline" },
    { label: "Mark spam", status: "spam", variant: "outline" },
    { label: "Reset to pending", status: "pending", variant: "outline" },
  ];
  const actions = allActions.filter((a) => a.status !== r.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PublicIntakeStatusBadge status={r.status} />
        {r.reviewedAt ? (
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {new Date(r.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {r.reviewer ? ` by ${r.reviewer.name ?? r.reviewer.username}` : ""}
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

function NotesCard({ r, id }: { r: AdminRegistrationRequestDetail; id: string }) {
  const [notes, setNotes] = useState(r.reviewNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const saveNotes = useSaveRegistrationRequestNotes();

  const handleSave = useCallback(async () => {
    try {
      await saveNotes.mutateAsync({ id, notes });
      setDirty(false);
      toast.success("Notes saved.");
    } catch {
      toast.error("Could not save notes.");
    }
  }, [id, notes, saveNotes]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Internal notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          placeholder="Add internal notes visible only to admins…"
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

export default function AdminRegistrationRequestDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const { data, isLoading, error } = useAdminRegistrationRequest(id ?? "");
  const r = data?.request;
  const setStatus = useSetRegistrationRequestStatus();

  const handleSetStatus = useCallback(
    (status: PublicIntakeStatus) => {
      if (!id) return;
      setStatus.mutate(
        { id, status },
        {
          onSuccess: () => toast.success(`Status updated to ${status}.`),
          onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
        },
      );
    },
    [id, setStatus],
  );

  return (
    <DetailPageShell
      backHref="/admin/registration-requests"
      backLabel="Registration requests"
      isLoading={Boolean(id) && isLoading}
      error={error}
      data={r}
      notFoundMessage="Registration request not found."
    >
      {r ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-content/[0.08] pb-6">
            <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-base-content">
              <UserPlus className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 leading-tight">{r.firstName} {r.lastName}</span>
            </h1>
            <PublicIntakeStatusBadge status={r.status} />
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <ApplicantCard r={r} />
            <StatusCard r={r} onSetStatus={handleSetStatus} isUpdating={setStatus.isPending} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why they want to join</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{r.requestDetails}</CardContent>
          </Card>

          <NotesCard r={r} id={id!} />
        </>
      ) : null}
    </DetailPageShell>
  );
}
