import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/infra/auth";
import { subscribeAdminMessagesChanged } from "@/lib/realtime/admin-messages-events";
import { countUnreadTreeInboxForUser } from "@/lib/admin/admin-message-unread";

/**
 * SSE stream: pushes `{ unreadCount }` on connect and whenever messages change in this process.
 * Client uses cookies (same-origin); no WebSocket server required.
 */
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return new Response("Unauthorized", { status: 401 });
    }
    throw e;
  }

  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return new Response("ADMIN_TREE_ID not configured", { status: 503 });
  }

  const encoder = new TextEncoder();
  const state = {
    closed: false,
    unsubscribe: null as null | (() => void),
    pingTimer: null as null | ReturnType<typeof setInterval>,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const write = (data: unknown) => {
        if (state.closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const ping = () => {
        if (state.closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      };

      const pushSnapshot = async () => {
        if (state.closed) return;
        try {
          const unreadCount = await countUnreadTreeInboxForUser(user.id, treeId);
          write({ unreadCount });
        } catch (err) {
          console.error("[messages stream] snapshot error:", err);
        }
      };

      await pushSnapshot();

      state.unsubscribe = subscribeAdminMessagesChanged(() => {
        void pushSnapshot();
      });

      state.pingTimer = setInterval(ping, 25_000);

      const close = () => {
        if (state.closed) return;
        state.closed = true;
        if (state.pingTimer) clearInterval(state.pingTimer);
        state.pingTimer = null;
        state.unsubscribe?.();
        state.unsubscribe = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", close);
    },
    cancel() {
      state.closed = true;
      if (state.pingTimer) clearInterval(state.pingTimer);
      state.pingTimer = null;
      state.unsubscribe?.();
      state.unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
