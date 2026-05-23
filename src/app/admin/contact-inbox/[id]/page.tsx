"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, MessageSquare, Reply, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { PublicIntakeStatusBadge } from "@/components/admin/PublicIntakeStatusBadge";
import {
  useAdminContactMessage,
  useSetContactMessageStatus,
  useSaveContactMessageNotes,
  useSendContactMessageReply,
  type AdminContactMessageDetail,
} from "@/hooks/useAdminContactMessages";
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

function SenderCard({ msg }: { msg: AdminContactMessageDetail }) {
  const name = [msg.firstName, msg.lastName].filter(Boolean).join(" ") || "—";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4 text-muted-foreground" aria-hidden />
          Sender
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{msg.email}</p>
        <p className="text-xs text-muted-foreground">
          Received{" "}
          {new Date(msg.createdAt).toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  msg,
  onSetStatus,
  isUpdating,
}: {
  msg: AdminContactMessageDetail;
  onSetStatus: (s: PublicIntakeStatus) => void;
  isUpdating: boolean;
}) {
  const allActions: StatusAction[] = [
    { label: "Mark reviewed", status: "reviewed", variant: "default" },
    { label: "Archive", status: "archived", variant: "outline" },
    { label: "Mark spam", status: "spam", variant: "outline" },
    { label: "Reset to pending", status: "pending", variant: "outline" },
  ];
  const actions = allActions.filter((a) => a.status !== msg.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PublicIntakeStatusBadge status={msg.status} />
        {msg.reviewedAt ? (
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {new Date(msg.reviewedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {msg.reviewer ? ` by ${msg.reviewer.name ?? msg.reviewer.username}` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.status}
              variant={a.variant}
              size="sm"
              disabled={isUpdating}
              onClick={() => onSetStatus(a.status)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NotesCard({ msg, id }: { msg: AdminContactMessageDetail; id: string }) {
  const [notes, setNotes] = useState(msg.reviewNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const saveNotes = useSaveContactMessageNotes();

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

function ReplyCard({ msg, id }: { msg: AdminContactMessageDetail; id: string }) {
  const defaultSubject = msg.subject ? `Re: ${msg.subject}` : "Re: your message";
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const sendReply = useSendContactMessageReply();

  const handleSend = useCallback(async () => {
    if (!body.trim()) { toast.error("Reply body cannot be empty."); return; }
    if (!subject.trim()) { toast.error("Subject cannot be empty."); return; }
    try {
      await sendReply.mutateAsync({ id, subject: subject.trim(), body: body.trim() });
      setBody("");
      toast.success(`Reply sent to ${msg.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply.");
    }
  }, [id, subject, body, sendReply, msg.email]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Reply className="size-4 text-muted-foreground" aria-hidden />
          Reply to {msg.email}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reply-subject">Subject</Label>
          <Input
            id="reply-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reply-body">Message</Label>
          <textarea
            id="reply-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your reply…"
            rows={6}
            className={`${textareaClassName} min-h-[120px]`}
          />
        </div>
        <Button onClick={handleSend} disabled={sendReply.isPending || !body.trim()}>
          {sendReply.isPending ? "Sending…" : "Send reply"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RepliesCard({ msg }: { msg: AdminContactMessageDetail }) {
  if (msg.replies.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
          Sent replies ({msg.replies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {msg.replies.map((r) => (
          <div key={r.id} className="py-4 first:pt-0 last:pb-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{r.subject}</p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {new Date(r.sentAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                {r.repliedBy.name ?? r.repliedBy.username}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminContactMessageDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const { data, isLoading, error } = useAdminContactMessage(id ?? "");
  const msg = data?.message;
  const setStatus = useSetContactMessageStatus();

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
      backHref="/admin/contact-inbox"
      backLabel="Contact inbox"
      isLoading={Boolean(id) && isLoading}
      error={error}
      data={msg}
      notFoundMessage="Message not found."
    >
      {msg ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-content/[0.08] pb-6">
            <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-base-content">
              <Mail className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 leading-tight">{msg.subject ?? "(no subject)"}</span>
            </h1>
            <PublicIntakeStatusBadge status={msg.status} />
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <SenderCard msg={msg} />
            <StatusCard msg={msg} onSetStatus={handleSetStatus} isUpdating={setStatus.isPending} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Message</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.message}
            </CardContent>
          </Card>

          <NotesCard msg={msg} id={id!} />
          <ReplyCard msg={msg} id={id!} />
          <RepliesCard msg={msg} />
        </>
      ) : null}
    </DetailPageShell>
  );
}
