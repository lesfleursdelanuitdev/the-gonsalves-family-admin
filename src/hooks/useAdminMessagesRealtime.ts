"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ADMIN_MESSAGES_UNREAD_KEY } from "@/hooks/useAdminMessages";

/**
 * Subscribes to admin message SSE (same-origin cookies). Updates unread badge and list caches.
 * Reconnects with exponential backoff if the connection drops.
 */
export function useAdminMessagesRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const backoffRef = useRef(1_000);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnect();
      if (cancelled) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      clearReconnect();
      es?.close();
      es = new EventSource("/api/admin/messages/stream");

      es.onopen = () => {
        backoffRef.current = 1_000;
      };

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { unreadCount?: number };
          if (typeof data.unreadCount === "number") {
            qc.setQueryData(ADMIN_MESSAGES_UNREAD_KEY, data.unreadCount);
          }
          void qc.invalidateQueries({ queryKey: ["admin", "messages"] });
        } catch {
          /* ignore malformed */
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!cancelled) scheduleReconnect();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnect();
      es?.close();
    };
  }, [enabled, qc]);
}
