"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminMessageRecipients } from "@/hooks/useAdminMessageRecipients";
import { useSendMessage } from "@/hooks/useAdminMessages";
import { toast } from "sonner";

export default function NewAdminMessagePage() {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const { data: recipientsData, isLoading: usersLoading } = useAdminMessageRecipients();
  const send = useSendMessage();

  const options = useMemo(
    () =>
      (recipientsData?.users ?? []).map((u) => ({
        id: u.id,
        label: u.name?.trim() ? `${u.name} (${u.username})` : u.username,
      })),
    [recipientsData],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim()) { toast.error("Choose a recipient"); return; }
    if (!content.trim()) { toast.error("Message body is required"); return; }
    send.mutate(
      { recipientId: recipientId.trim(), subject: subject.trim() || undefined, content: content.trim() },
      {
        onSuccess: () => {
          toast.success("Message sent");
          router.push("/admin/messages");
        },
        onError: () => toast.error("Could not send message"),
      },
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-base-content/[0.08] bg-base-100 px-4 py-3">
        <Link
          href="/admin/messages"
          className="btn btn-ghost btn-sm btn-square -ml-1"
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-bold text-base-content leading-tight">New message</h1>
          <p className="text-xs text-muted-foreground">
            Recipients are limited to users tied to this admin tree.
          </p>
        </div>
      </div>

      {/* Scrollable form body */}
      <form
        id="compose-form"
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-6">
          {/* To */}
          <div className="space-y-2">
            <Label htmlFor="recipient">To</Label>
            <select
              id="recipient"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              disabled={usersLoading}
              required
            >
              <option value="">{usersLoading ? "Loading users…" : "Select recipient…"}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject{" "}
              <span className="font-normal text-muted-foreground">— optional</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              maxLength={255}
              autoComplete="off"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <textarea
              id="content"
              className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message…"
              required
            />
          </div>
        </div>
      </form>

      {/* Sticky send bar */}
      <div className="shrink-0 border-t border-base-content/[0.08] bg-base-100/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="submit"
            form="compose-form"
            disabled={send.isPending || !recipientId || !content.trim()}
            className={cn(
              "btn btn-primary gap-2",
              (!recipientId || !content.trim()) && "opacity-50 cursor-not-allowed",
            )}
          >
            {send.isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="size-4" /> Send message</>
            )}
          </button>
          <Link
            href="/admin/messages"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Discard
          </Link>
        </div>
      </div>
    </div>
  );
}
