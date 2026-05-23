"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { File, FileAudio, FileImage, FileText, FileVideo, Layers, Link, MapPin, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { PublicIntakeStatusBadge } from "@/components/admin/PublicIntakeStatusBadge";
import { ContributionTypeBadge } from "@/components/admin/ContributionTypeBadge";
import {
  useAdminContribution,
  useSetContributionStatus,
  useSaveContributionNotes,
  type AdminContributionDetail,
  type AdminContributionAttachment,
} from "@/hooks/useAdminContributions";
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

function formatBytes(bytes: string | null): string {
  if (!bytes) return "";
  const n = Number(bytes);
  if (Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTACHMENT_ICONS: Record<string, typeof File> = {
  image: FileImage,
  document: FileText,
  audio: FileAudio,
  video: FileVideo,
};

function ContributorCard({ c }: { c: AdminContributionDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4 text-muted-foreground" aria-hidden />
          Contributor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{c.contributorFirstName} {c.contributorLastName}</p>
        <p className="text-muted-foreground">{c.contributorEmail}</p>
        <p className="text-xs text-muted-foreground">
          Submitted{" "}
          {new Date(c.createdAt).toLocaleString("en-US", {
            month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  c,
  onSetStatus,
  isUpdating,
}: {
  c: AdminContributionDetail;
  onSetStatus: (s: PublicIntakeStatus) => void;
  isUpdating: boolean;
}) {
  const allActions: StatusAction[] = [
    { label: "Approve", status: "approved", variant: "default" },
    { label: "Mark reviewed", status: "reviewed", variant: "outline" },
    { label: "Reject", status: "rejected", variant: "destructive" },
    { label: "Archive", status: "archived", variant: "outline" },
    { label: "Mark spam", status: "spam", variant: "outline" },
    { label: "Reset to pending", status: "pending", variant: "outline" },
  ];
  const actions = allActions.filter((a) => a.status !== c.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PublicIntakeStatusBadge status={c.status} />
        {c.reviewedAt ? (
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {new Date(c.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {c.reviewer ? ` by ${c.reviewer.name ?? c.reviewer.username}` : ""}
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

function RelatedCard({ c }: { c: AdminContributionDetail }) {
  const rows = [
    { label: "Individual XREF", value: c.relatedIndividualXref },
    { label: "Family XREF", value: c.relatedFamilyXref },
    { label: "Place", value: c.relatedPlace },
    { label: "Date", value: c.relatedDate },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          Related records
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{r.label}</p>
            <p className="mt-0.5 text-sm font-medium">{r.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LinkedIndividualsCard({ c }: { c: AdminContributionDetail }) {
  if (c.individuals.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          Linked individuals ({c.individuals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {c.individuals.map((ind) => (
          <div key={ind.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">
                {ind.individualNameSnapshot ?? ind.individualXref}
              </p>
              {ind.birthDateSnapshot && (
                <p className="text-xs text-muted-foreground">b. {ind.birthDateSnapshot}</p>
              )}
            </div>
            <a
              href={`/admin/individuals/${ind.individual.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              <Link className="size-3" aria-hidden />
              View
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({ attachments }: { attachments: AdminContributionAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <File className="size-4 text-muted-foreground" aria-hidden />
          Attachments ({attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {attachments.map((a) => {
          const Icon = ATTACHMENT_ICONS[a.kind] ?? File;
          const size = formatBytes(a.byteSize);
          return (
            <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.fileName ?? `${a.kind} file`}</p>
                <p className="text-xs text-muted-foreground">
                  {a.kind}{a.mimeType ? ` · ${a.mimeType}` : ""}{size ? ` · ${size}` : ""}
                </p>
                {a.caption && <p className="mt-0.5 text-xs text-muted-foreground">{a.caption}</p>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NotesCard({ c, id }: { c: AdminContributionDetail; id: string }) {
  const [notes, setNotes] = useState(c.reviewNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const saveNotes = useSaveContributionNotes();

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

export default function AdminContributionDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const { data, isLoading, error } = useAdminContribution(id ?? "");
  const c = data?.contribution;
  const setStatus = useSetContributionStatus();

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
      backHref="/admin/contributions"
      backLabel="Contributions"
      isLoading={Boolean(id) && isLoading}
      error={error}
      data={c}
      notFoundMessage="Contribution not found."
    >
      {c ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-content/[0.08] pb-6">
            <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-base-content">
              <Layers className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 leading-tight">
                {c.contributorFirstName} {c.contributorLastName}
              </span>
            </h1>
            <div className="flex items-center gap-2">
              <ContributionTypeBadge type={c.type} />
              <PublicIntakeStatusBadge status={c.status} />
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <ContributorCard c={c} />
            <StatusCard c={c} onSetStatus={handleSetStatus} isUpdating={setStatus.isPending} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</CardContent>
          </Card>

          <RelatedCard c={c} />
          <LinkedIndividualsCard c={c} />
          <AttachmentsCard attachments={c.attachments} />
          <NotesCard c={c} id={id!} />
        </>
      ) : null}
    </DetailPageShell>
  );
}
