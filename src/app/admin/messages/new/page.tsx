"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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

  const options = useMemo(() => {
    return (recipientsData?.users ?? []).map((u) => ({
      id: u.id,
      label: u.name?.trim() ? `${u.name} (${u.username})` : u.username,
    }));
  }, [recipientsData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim()) {
      toast.error("Choose a recipient");
      return;
    }
    if (!content.trim()) {
      toast.error("Message body is required");
      return;
    }
    send.mutate(
      {
        recipientId: recipientId.trim(),
        subject: subject.trim() || undefined,
        content: content.trim(),
      },
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
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/messages"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compose message</h1>
          <p className="text-sm text-muted-foreground">
            Recipients are limited to users tied to this admin tree (roles or individual links).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipient">To</Label>
          <select
            id="recipient"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            disabled={usersLoading}
            required
          >
            <option value="">{usersLoading ? "Loading users…" : "Select recipient…"}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject (optional)</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Message</Label>
          <textarea
            id="content"
            className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
          <Link
            href="/admin/messages"
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "inline-flex items-center justify-center")}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
