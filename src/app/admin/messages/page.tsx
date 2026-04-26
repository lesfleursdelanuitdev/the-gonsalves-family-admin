"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, Loader2, MailPlus, Send, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAdminMessages,
  useMarkMessageRead,
  useDeleteMessage,
  useSendMessage,
  type AdminMessageListItem,
} from "@/hooks/useAdminMessages";
import { useAdminMessagesRealtime } from "@/hooks/useAdminMessagesRealtime";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "sonner";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { LexicalMessageComposer } from "@/components/admin/messaging/LexicalMessageComposer";

/* ── Types ────────────────────────────────────────────────────────────── */

interface Conversation {
  /** Stable id for selection: peer user id (1:1) or `conv:${conversationId}` (multi-recipient thread). */
  threadKey: string;
  conversationId: string | null;
  /** Who receives a reply in this thread (everyone except you). */
  replyRecipientIds: string[];
  userName: string;
  userUsername: string;
  messages: AdminMessageListItem[];
  lastMessage: AdminMessageListItem;
  unreadCount: number;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function getDisplayName(user: { name: string | null; username: string }): string {
  return user.name?.trim() || user.username;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(d: string | Date): string {
  const now = Date.now();
  const date = new Date(d).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function readReceiptTooltip(readAt: string | null | undefined): string {
  if (!readAt) return "Read";
  try {
    const d = new Date(readAt);
    return `Read ${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  } catch {
    return "Read";
  }
}

function groupByDate(messages: AdminMessageListItem[]): Record<string, AdminMessageListItem[]> {
  const groups: Record<string, AdminMessageListItem[]> = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  messages.forEach((m) => {
    const d = new Date(m.createdAt);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else label = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    (groups[label] ??= []).push(m);
  });
  return groups;
}

function buildUserMapFromMessages(msgs: AdminMessageListItem[]): Map<string, { name: string | null; username: string }> {
  const map = new Map<string, { name: string | null; username: string }>();
  for (const m of msgs) {
    map.set(m.sender.id, m.sender);
    if (m.recipient) map.set(m.recipient.id, m.recipient);
  }
  return map;
}

/** Other people in this thread (not `myId`). */
function collectOtherParticipantIds(msgs: AdminMessageListItem[], myId: string): string[] {
  const ids = new Set<string>();
  for (const m of msgs) {
    if (m.senderId !== myId) ids.add(m.senderId);
    if (m.recipientId && m.recipientId !== myId) ids.add(m.recipientId);
  }
  return [...ids];
}

function groupConversations(messages: AdminMessageListItem[], myId: string): Conversation[] {
  const byConversationId = new Map<string, AdminMessageListItem[]>();
  const byPair = new Map<string, AdminMessageListItem[]>();

  for (const m of messages) {
    if (m.conversationId) {
      if (!byConversationId.has(m.conversationId)) byConversationId.set(m.conversationId, []);
      byConversationId.get(m.conversationId)!.push(m);
      continue;
    }
    const otherId =
      m.senderId === myId ? (m.recipientId ?? "unknown") : m.senderId;
    if (otherId === "unknown") continue;
    const otherUser = m.senderId === myId ? m.recipient : m.sender;
    if (!otherUser) continue;
    if (!byPair.has(otherId)) byPair.set(otherId, []);
    byPair.get(otherId)!.push(m);
  }

  const out: Conversation[] = [];

  for (const [cid, msgs] of byConversationId) {
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const userMap = buildUserMapFromMessages(sorted);
    const otherIds = collectOtherParticipantIds(sorted, myId);
    otherIds.sort((a, b) =>
      getDisplayName(userMap.get(a)!).localeCompare(getDisplayName(userMap.get(b)!), undefined, {
        sensitivity: "base",
      }),
    );
    const names = otherIds.map((id) => getDisplayName(userMap.get(id)!));
    const usernames = otherIds.map((id) => userMap.get(id)!.username);
    const userName =
      names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    out.push({
      threadKey: `conv:${cid}`,
      conversationId: cid,
      replyRecipientIds: otherIds,
      userName,
      userUsername: usernames.join(", "),
      messages: sorted,
      lastMessage: sorted[sorted.length - 1]!,
      unreadCount: msgs.filter((m) => m.senderId !== myId && !m.isRead).length,
    });
  }

  for (const [peerId, msgs] of byPair) {
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const otherUser = sorted[0]!.senderId === myId ? sorted[0]!.recipient : sorted[0]!.sender;
    if (!otherUser) continue;
    out.push({
      threadKey: peerId,
      conversationId: null,
      replyRecipientIds: [peerId],
      userName: getDisplayName(otherUser),
      userUsername: otherUser.username,
      messages: sorted,
      lastMessage: sorted[sorted.length - 1]!,
      unreadCount: msgs.filter((m) => m.senderId !== myId && !m.isRead).length,
    });
  }

  return out.sort(
    (a, b) =>
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────── */

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "size-8 text-[10px]", md: "size-10 text-xs", lg: "size-12 text-sm" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary", sizeClass)}>
      {getInitials(name)}
    </span>
  );
}

/* ── ConversationItem ──────────────────────────────────────────────────── */

function ConversationItem({
  conv,
  isActive,
  myId,
  onClick,
}: {
  conv: Conversation;
  isActive: boolean;
  myId: string;
  onClick: () => void;
}) {
  const last = conv.lastMessage;
  const isLastMine = last.senderId === myId;
  const preview =
    last.content.length > 58 ? last.content.slice(0, 58) + "…" : last.content;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-base-content/[0.06] px-4 py-3 text-left transition-colors hover:bg-base-200/60",
        isActive && "bg-primary/[0.08] hover:bg-primary/[0.1]",
      )}
    >
      <div className="relative shrink-0">
        <Avatar name={conv.userName} />
        {conv.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-base-200 bg-primary text-[9px] font-bold text-primary-content">
            {conv.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", conv.unreadCount > 0 ? "font-bold text-base-content" : "font-medium text-base-content/90")}>
            {conv.userName}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(last.createdAt)}</span>
        </div>
        {last.subject && (
          <p className="truncate text-xs font-medium text-muted-foreground">{last.subject}</p>
        )}
        <p className={cn("truncate text-xs", conv.unreadCount > 0 ? "text-base-content/80" : "text-muted-foreground")}>
          {isLastMine && <span className="text-muted-foreground/60">You: </span>}
          {preview}
        </p>
      </div>
    </button>
  );
}

/* ── MessageBubble ─────────────────────────────────────────────────────── */

function MessageBubble({ msg, isMine }: { msg: AdminMessageListItem; isMine: boolean }) {
  const readTip = readReceiptTooltip(msg.readAt);
  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isMine
            ? "rounded-br-sm bg-primary text-primary-content"
            : "rounded-bl-sm bg-base-300/80 text-base-content",
        )}
      >
        {msg.content}
      </div>
      <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/60">
        <span>{new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
        {isMine ? (
          <span
            className="inline-flex items-center gap-0.5"
            title={msg.isRead ? readTip : "Delivered — waiting to be read"}
          >
            {msg.isRead ? (
              <CheckCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
            ) : (
              <Check className="size-3.5 shrink-0 text-muted-foreground/55" aria-hidden />
            )}
            <span className="sr-only">{msg.isRead ? readTip : "Delivered"}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── ThreadView ────────────────────────────────────────────────────────── */

function ThreadView({
  conv,
  myId,
  onBack,
  onDelete,
}: {
  conv: Conversation;
  myId: string;
  onBack?: () => void;
  onDelete: () => void;
}) {
  const [reply, setReply] = useState("");
  const [composerReset, setComposerReset] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textGetterRef = useRef<(() => string) | null>(null);
  const send = useSendMessage();
  const grouped = useMemo(() => groupByDate(conv.messages), [conv.messages]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 60);
  }, [conv.messages.length]);

  const handleSend = useCallback(() => {
    if (send.isPending) return;
    if (
      conv.replyRecipientIds.length === 0 ||
      conv.replyRecipientIds.some((id) => id === myId)
    ) {
      toast.error("You cannot message yourself");
      return;
    }
    const content = (textGetterRef.current?.() ?? reply).trim();
    if (!content) {
      toast.error("Write a message first");
      return;
    }
    send.mutate(
      {
        recipientIds: conv.replyRecipientIds,
        subject: conv.lastMessage.subject ?? undefined,
        content,
        ...(conv.conversationId ? { conversationId: conv.conversationId } : {}),
      },
      {
        onSuccess: () => {
          setReply("");
          setComposerReset((n) => n + 1);
        },
        onError: () => toast.error("Could not send message"),
      },
    );
  }, [reply, send, conv, myId]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-base-content/[0.08] bg-base-100 px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} className="btn btn-ghost btn-sm btn-square -ml-1" aria-label="Back">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <Avatar name={conv.userName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base-content leading-tight">{conv.userName}</p>
          <p className="text-xs text-muted-foreground">{conv.userUsername} · {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-ghost btn-sm gap-1.5 text-muted-foreground hover:text-error"
          aria-label="Delete conversation"
        >
          <Trash2 className="size-3.5" /> <span className="hidden sm:inline text-xs">Delete</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
        {Object.entries(grouped).map(([label, msgs]) => (
          <div key={label}>
            <div className="my-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              {label}
            </div>
            <div className="flex flex-col gap-1">
              {msgs.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isMine={msg.senderId === myId} />
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="shrink-0 border-t border-base-content/[0.08] bg-base-100 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-base-content/[0.12] bg-base-200/40 px-3 py-2">
          <LexicalMessageComposer
            resetKey={composerReset}
            variant="compact"
            placeholder={`Reply to ${conv.userName}…`}
            onChangeText={setReply}
            textGetterRef={textGetterRef}
            onSubmitOnEnter={handleSend}
            disabled={send.isPending}
            aria-label={`Reply to ${conv.userName}`}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={send.isPending}
            className="btn btn-primary btn-sm btn-square shrink-0"
            aria-label="Send"
          >
            {send.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground/50">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */

function EmptyThread() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-base-200/60">
        <MailPlus className="size-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="font-semibold text-base-content">No conversation selected</p>
        <p className="mt-1 text-sm text-muted-foreground">Choose a conversation or start a new one.</p>
      </div>
      <Link href="/admin/messages/new" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
        <MailPlus className="size-3.5" /> New message
      </Link>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AdminMessagesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "inbox" | "sent">("all");
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");

  const { data: currentUser } = useCurrentUser();
  const myId = currentUser?.id ?? "";

  const { data, isLoading } = useAdminMessages({
    filter,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  // Enable SSE real-time updates
  useAdminMessagesRealtime(true);

  const markRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();

  const allMessages = useMemo(() => data?.messages ?? [], [data]);

  const conversations = useMemo(
    () => (myId ? groupConversations(allMessages, myId) : []),
    [allMessages, myId],
  );

  const filteredConvs = useMemo(() =>
    conversations.filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.userName.toLowerCase().includes(q) ||
        c.userUsername.toLowerCase().includes(q) ||
        c.messages.some(
          (m) =>
            m.subject?.toLowerCase().includes(q) ||
            m.content.toLowerCase().includes(q),
        )
      );
    }),
    [conversations, search],
  );

  const activeConv = activeThreadKey
    ? conversations.find((c) => c.threadKey === activeThreadKey) ?? null
    : null;

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // Mark messages as read when a thread is open (including new inbound messages while viewing).
  useEffect(() => {
    if (!activeThreadKey || !myId || !activeConv) return;
    const unread = allMessages.filter((m) => {
      if (m.isRead || m.recipientId !== myId || m.senderId === myId) return false;
      if (activeConv.conversationId) return m.conversationId === activeConv.conversationId;
      return !m.conversationId && m.senderId === activeConv.threadKey;
    });
    unread.forEach((m) => markRead.mutate({ id: m.id, isRead: true }, { onError: () => {} }));
  }, [activeThreadKey, myId, allMessages, markRead, activeConv]);

  const handleDeleteConv = useCallback(async () => {
    if (!activeConv) return;
    const ids = activeConv.messages.map((m) => m.id);
    try {
      await Promise.all(ids.map((id) => deleteMessage.mutateAsync(id)));
      toast.success("Conversation deleted");
      setActiveThreadKey(null);
    } catch {
      toast.error("Could not delete conversation");
    }
  }, [activeConv, deleteMessage]);

  // Mobile: show list or thread
  const showList = !isMobile || !activeThreadKey;
  const showThread = !isMobile || !!activeThreadKey;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: conversation list ── */}
      {showList && (
        <div
          className={cn(
            "flex flex-col border-r border-base-content/[0.08] bg-base-200/40",
            isMobile ? "w-full" : "w-[300px] shrink-0",
          )}
        >
          {/* List header */}
          <div className="shrink-0 border-b border-base-content/[0.08] px-4 pb-3 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-base-content">Messages</h1>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-content">
                    {totalUnread}
                  </span>
                )}
              </div>
              <Link
                href="/admin/messages/new"
                className="btn btn-primary btn-xs gap-1"
                aria-label="New message"
              >
                <MailPlus className="size-3" /> Compose
              </Link>
            </div>

            {/* Search */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="input input-sm w-full bg-base-100/60 border-base-content/[0.12] text-sm"
            />

            {/* Filter tabs */}
            <div className="flex gap-1" role="tablist">
              {(["all", "inbox", "sent"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex-1 rounded-md py-1 text-xs font-semibold capitalize transition-colors",
                    filter === f
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-base-content",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && filteredConvs.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? "No matches found." : "No messages yet."}
              </p>
            )}
            {filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.threadKey}
                conv={conv}
                isActive={activeThreadKey === conv.threadKey}
                myId={myId}
                onClick={() => setActiveThreadKey(conv.threadKey)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Right: thread view ── */}
      {showThread && (
        <div className={cn("flex flex-col overflow-hidden", isMobile ? "w-full" : "flex-1")}>
          {activeConv ? (
            <ThreadView
              conv={activeConv}
              myId={myId}
              onBack={isMobile ? () => setActiveThreadKey(null) : undefined}
              onDelete={handleDeleteConv}
            />
          ) : (
            <EmptyThread />
          )}
        </div>
      )}
    </div>
  );
}
