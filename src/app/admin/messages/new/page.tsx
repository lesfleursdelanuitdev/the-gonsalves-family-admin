"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminMessageRecipients } from "@/hooks/useAdminMessageRecipients";
import { useSendMessage } from "@/hooks/useAdminMessages";
import { toast } from "sonner";
import { LexicalMessageComposer } from "@/components/admin/messaging/LexicalMessageComposer";

export default function NewAdminMessagePage() {
  const router = useRouter();
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [composerReset, setComposerReset] = useState(0);
  const textGetterRef = useRef<(() => string) | null>(null);
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
    if (recipientIds.length === 0) {
      toast.error("Choose at least one recipient");
      return;
    }
    const body = (textGetterRef.current?.() ?? content).trim();
    if (!body) {
      toast.error("Message body is required");
      return;
    }
    send.mutate(
      { recipientIds, subject: subject.trim() || undefined, content: body },
      {
        onSuccess: (_, vars) => {
          setContent("");
          setRecipientIds([]);
          setComposerReset((n) => n + 1);
          const n = vars.recipientIds.length;
          toast.success(n === 1 ? "Message sent" : `Message sent to ${n} people`);
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
            Choose who should receive this message. You cannot include yourself.
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
            <Label id="recipients-label">To</Label>
            <p id="recipients-hint" className="text-xs text-muted-foreground">
              Select one or more people. Each recipient gets their own copy in their inbox.
            </p>
            <div
              role="group"
              aria-labelledby="recipients-label"
              aria-describedby="recipients-hint"
              className="max-h-[min(40vh,280px)] overflow-y-auto rounded-md border border-input bg-transparent px-2 py-2 shadow-xs"
            >
              {usersLoading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Loading users…</p>
              ) : options.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No other users in this tree yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {options.map((o) => {
                    const checked = recipientIds.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-base-200/80"
                      >
                        <Checkbox
                          id={`recipient-${o.id}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v === true) {
                              setRecipientIds((p) => (p.includes(o.id) ? p : [...p, o.id]));
                            } else {
                              setRecipientIds((p) => p.filter((x) => x !== o.id));
                            }
                          }}
                          className="size-4"
                        />
                        <Label
                          htmlFor={`recipient-${o.id}`}
                          className="min-w-0 flex-1 cursor-pointer truncate font-normal"
                        >
                          {o.label}
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {recipientIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {recipientIds.length} recipient{recipientIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
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
            <Label>Message</Label>
            <div className="rounded-md border border-input bg-transparent shadow-xs outline-none focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
              <LexicalMessageComposer
                resetKey={composerReset}
                variant="tall"
                placeholder="Write your message…"
                onChangeText={setContent}
                textGetterRef={textGetterRef}
                disabled={send.isPending}
                aria-label="Message body"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Sticky send bar */}
      <div className="shrink-0 border-t border-base-content/[0.08] bg-base-100/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="submit"
            form="compose-form"
            disabled={send.isPending || recipientIds.length === 0}
            className={cn(
              "btn btn-primary gap-2",
              recipientIds.length === 0 && "opacity-50 cursor-not-allowed",
            )}
          >
            {send.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="size-4" /> Send message
              </>
            )}
          </button>
          <Link href="/admin/messages" className={cn(buttonVariants({ variant: "outline" }))}>
            Discard
          </Link>
        </div>
      </div>
    </div>
  );
}
